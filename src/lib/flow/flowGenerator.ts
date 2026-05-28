import { getBedrockClient, converseWithModel } from "@/lib/aws/bedrockClient";
import type { BlockSchemaLibrary, } from "@/types/flowSchema";
import type { JourneyConfig, GenerationResult, GenerationLogEntry, VerificationResult } from "@/types/experience";

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/, "$1").trim();
}

function buildGenerationSystemPrompt(
  journeyConfig: JourneyConfig,
  library: BlockSchemaLibrary
): string {
  const schemaJson = JSON.stringify(library.schemas, null, 2);

  const agentArn = journeyConfig.wisdomAgentArn ?? "REPLACE_WITH_WISDOM_AGENT_ARN";
  const lexArn   = journeyConfig.lexBotAliasArn  ?? "REPLACE_WITH_LEX_BOT_ALIAS_ARN";
  const fallbackQueueId = journeyConfig.fallbackQueueId || "REPLACE_WITH_FALLBACK_QUEUE_ARN";

  // Derive assistant ARN from agent ARN: arn:aws:wisdom:region:account:assistant/assistantId
  // Agent ARN format:  arn:aws:wisdom:region:account:ai-agent/assistantId/agentId
  let assistantArn = "REPLACE_WITH_WISDOM_ASSISTANT_ARN";
  const agentArnMatch = agentArn.match(/^(arn:aws:wisdom:[^:]+:[^:]+):ai-agent\/([^/]+)\//);
  if (agentArnMatch) {
    assistantArn = `${agentArnMatch[1]}:assistant/${agentArnMatch[2]}`;
  }

  const rulesText = journeyConfig.routingRules
    .map((r) => {
      if (r.action === "agent") {
        return `   - Condition "${r.condition}": repeat the CreateWisdomSession + UpdateContactAttributes + ConnectParticipantWithLexBot pattern for agent "${r.targetAgentName}"`;
      }
      if (r.action === "queue") {
        const qId = r.targetQueueId || "REPLACE_WITH_QUEUE_ARN";
        return `   - Condition "${r.condition}": UpdateContactTargetQueue (QueueId = "${qId}") → TransferContactToQueue`;
      }
      return `   - Condition "${r.condition}": DisconnectParticipant`;
    })
    .join("\n");

  return `You are generating an Amazon Connect Contact Flow JSON document.

STRICT OUTPUT RULES:
1. Return ONLY valid JSON — no markdown fences, no comments, no prose.
2. The top-level "Version" field MUST be exactly "2019-10-30". Do not use any other version string.
3. Use ONLY block Type values that appear in DISCOVERED BLOCK SCHEMAS below.
4. Use sequential identifiers: "b0000001-0000-0000-0000-000000000001", "b0000001-0000-0000-0000-000000000002", etc.
5. Do NOT invent template variables like \${region} or \${account}. Use the literal ARN/ID strings provided below.

RESOURCE VALUES (use these exact strings — do not substitute or template them):
  Q Connect AI Agent ARN : "${agentArn}"
  Lex Bot Alias ARN      : "${lexArn}"
  Fallback Queue ARN/ID  : "${fallbackQueueId}"

Q CONNECT INTEGRATION — THREE MANDATORY SEQUENTIAL BLOCKS:
  Block A — CreateWisdomSession:
    Parameters.WisdomAssistantArn = "${assistantArn}" (assistant ARN, NOT the AI agent ARN — MUST use WisdomAssistantArn key)
    Transitions: NextAction → Block B; Errors → fallback handler

  Block B — UpdateContactAttributes:
    Parameters.Attributes = { "wisdomSessionArn": "$.Wisdom.SessionArn" }
    Transitions: NextAction → Block C; Errors → fallback handler

  Block C — ConnectParticipantWithLexBot:
    Parameters.Text = welcome message (the literal text, not a variable)
    Parameters.LexV2Bot.AliasArn = Lex Bot Alias ARN above
    Parameters.LexSessionAttributes["x-amz-lex:q-in-connect:ai-agent-arn"] = Q Connect AI Agent ARN above
    Transitions.NextAction → Compare block
    Transitions.Errors → fallback handler
    *** DO NOT add Conditions to ConnectParticipantWithLexBot — all routing belongs in the Compare block ***

ROUTING — Compare block:
  Parameters.ComparisonValue = "$.Lex.SessionAttributes.Tool"
  Each Condition: { "NextAction": "...", "Condition": { "Operator": "Equals", "Operands": ["VALUE"] } }
    — Operands contains exactly ONE string (the value to match), NOT the attribute path.
${rulesText}
  NoMatchingCondition fallback → UpdateContactTargetQueue (QueueId = "${fallbackQueueId}") → DisconnectParticipant
  Errors (ErrorType "NoMatchingCondition") → UpdateContactTargetQueue (QueueId = "${fallbackQueueId}") → DisconnectParticipant

TRANSFER PATTERN:
  Use "UpdateContactTargetQueue" to set the target queue, then "DisconnectParticipant" as the final step.
  Do NOT use "TransferToFlow" or "TransferContactToQueue" — these are not supported via the API.

CRITICAL — ERRORS ON ALL TRANSITIONS:
  Every block with transitions (except DisconnectParticipant) MUST include an "Errors" array.
  For Compare blocks: ErrorType must be "NoMatchingCondition" (not "NoMatchingError").
  For all other blocks: ErrorType must be "NoMatchingError".
  A missing Errors array will cause InvalidContactFlowException.

DISCOVERED BLOCK SCHEMAS (use these exact parameter and transition shapes):
${schemaJson}

TARGET FLOW STRUCTURE:
1. UpdateFlowLoggingBehavior (Parameters.FlowLoggingBehavior = "Enabled")
2. CreateWisdomSession (Block A — agent "${journeyConfig.entryAgentName}")
3. UpdateContactAttributes (Block B — store session ARN)
4. ConnectParticipantWithLexBot (Block C — welcome: "${journeyConfig.welcomeMessage}")
5. Compare (routing — checks $.Lex.SessionAttributes.Tool)
6. For each "queue" rule: UpdateContactTargetQueue → TransferContactToQueue
7. For each "disconnect" rule: DisconnectParticipant
8. Fallback/error path: UpdateContactTargetQueue ("${fallbackQueueId}") → TransferContactToQueue`;
}

export async function generateFlow(args: {
  journeyConfig: JourneyConfig;
  library: BlockSchemaLibrary;
  modelId: string;
  region: string;
}): Promise<GenerationResult> {
  const { journeyConfig, library, modelId, region } = args;
  const logs: GenerationLogEntry[] = [];
  const client = getBedrockClient(region);
  const systemPrompt = buildGenerationSystemPrompt(journeyConfig, library);
  const messages = [
    { role: "user" as const, content: [{ text: "Generate the contact flow JSON now." }] },
  ];

  logs.push({ level: "INFO", message: "Sending generation request to Bedrock", details: { modelId, region, entryAgent: journeyConfig.entryAgentName, ruleCount: journeyConfig.routingRules.length } });

  let rawResponse: string;
  try {
    rawResponse = await converseWithModel(client, modelId, messages, systemPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bedrock call failed";
    logs.push({ level: "ERROR", message: "Bedrock call failed", details: { error: msg } });
    return { status: "manual_review", error: msg, logs };
  }

  logs.push({ level: "INFO", message: "Received response from Bedrock", details: { responseLength: rawResponse.length, startsWithFence: rawResponse.startsWith("```") } });

  const cleaned = stripMarkdownFences(rawResponse);
  if (cleaned !== rawResponse) {
    logs.push({ level: "WARN", message: "Stripped markdown code fences from model response — model ignored 'no markdown' instruction" });
  }

  try {
    JSON.parse(cleaned);
    logs.push({ level: "INFO", message: "Flow JSON parsed successfully on first attempt" });
    return { status: "success", flowJson: cleaned, logs };
  } catch (parseErr: unknown) {
    const parseMsg = parseErr instanceof Error ? parseErr.message : "JSON parse failed";
    logs.push({ level: "WARN", message: "Initial parse failed, sending retry", details: { parseError: parseMsg, rawSnippet: rawResponse.slice(0, 200) } });

    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: [{ text: rawResponse }] },
      {
        role: "user" as const,
        content: [{ text: "That response was not valid JSON. Please return ONLY valid JSON with no additional text." }],
      },
    ];
    try {
      const retryRaw = await converseWithModel(client, modelId, retryMessages, systemPrompt);
      const retryCleaned = stripMarkdownFences(retryRaw);
      if (retryCleaned !== retryRaw) {
        logs.push({ level: "WARN", message: "Stripped markdown fences from retry response" });
      }
      JSON.parse(retryCleaned);
      logs.push({ level: "INFO", message: "Flow JSON parsed successfully on retry" });
      return { status: "success", flowJson: retryCleaned, logs };
    } catch (retryErr: unknown) {
      const msg = retryErr instanceof Error ? retryErr.message : "JSON parse failed after retry";
      logs.push({ level: "ERROR", message: "Flow generation failed after retry", details: { error: msg } });
      return { status: "manual_review", error: msg, logs };
    }
  }
}

export async function verifyFlow(args: {
  journeyConfig: JourneyConfig;
  flowJson: string;
  modelId: string;
  region: string;
}): Promise<VerificationResult> {
  const { journeyConfig, flowJson, modelId, region } = args;
  const client = getBedrockClient(region);

  const systemPrompt =
    "You are reviewing an Amazon Connect Contact Flow JSON. Explain in plain English what this flow does, list any issues you see, and suggest improvements. Respond with JSON: { \"explanation\": \"...\", \"issues\": [...], \"suggestions\": [...] }";

  const messages = [
    {
      role: "user" as const,
      content: [
        {
          text: `Journey config: ${JSON.stringify(journeyConfig, null, 2)}\n\nFlow JSON:\n${flowJson}`,
        },
      ],
    },
  ];

  let responseText: string;
  try {
    responseText = await converseWithModel(client, modelId, messages, systemPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bedrock call failed";
    return { explanation: msg, issues: [], suggestions: [], verifiedAt: new Date().toISOString() };
  }

  try {
    const parsed = JSON.parse(responseText) as { explanation?: string; issues?: string[]; suggestions?: string[] };
    return {
      explanation: parsed.explanation ?? responseText,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      verifiedAt: new Date().toISOString(),
    };
  } catch {
    const explanationMatch = responseText.match(/explanation["\s:]+([^"]+)/i);
    return {
      explanation: explanationMatch ? explanationMatch[1] : responseText,
      issues: [],
      suggestions: [],
      verifiedAt: new Date().toISOString(),
    };
  }
}
