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
  const fallbackQueueId = journeyConfig.fallbackQueueId || "REPLACE_WITH_FALLBACK_QUEUE_ARN";

  // Derive assistant ARN from agent ARN: arn:aws:wisdom:region:account:assistant/assistantId
  // Agent ARN format:  arn:aws:wisdom:region:account:ai-agent/assistantId/agentId
  let assistantArn = "REPLACE_WITH_WISDOM_ASSISTANT_ARN";
  const agentArnMatch = agentArn.match(/^(arn:aws:wisdom:[^:]+:[^:]+):ai-agent\/([^/]+)\//);
  if (agentArnMatch) {
    assistantArn = `${agentArnMatch[1]}:assistant/${agentArnMatch[2]}`;
  }

  // Versioned agent ARN — Connect requires :$LATEST suffix on OrchestrationAIAgentConfiguration
  const versionedAgentArn = agentArn.endsWith(":$LATEST") ? agentArn : `${agentArn}:$LATEST`;

  // Each "queue" routing rule sets a specific queue then disconnects.
  // Each "disconnect" or "agent" rule just disconnects.
  // The queue is set upfront (block 2) so all error paths can safely use DisconnectParticipant.
  const rulesText = journeyConfig.routingRules
    .map((r) => {
      if (r.action === "queue") {
        const qId = r.targetQueueId || "REPLACE_WITH_QUEUE_ARN";
        return `   - Condition "${r.condition}": UpdateContactTargetQueue (QueueId = "${qId}") → DisconnectParticipant (Parameters: {}, Transitions: {})`;
      }
      return `   - Condition "${r.condition}": DisconnectParticipant (Parameters: {}, Transitions: {})`;
    })
    .join("\n");

  return `You are generating an Amazon Connect Contact Flow JSON document.

STRICT OUTPUT RULES:
1. Return ONLY valid JSON — no markdown fences, no comments, no prose.
2. The top-level "Version" field MUST be exactly "2019-10-30".
3. Use sequential identifiers: "b0000001-0000-0000-0000-000000000001", "b0000001-0000-0000-0000-000000000002", etc.
4. Every action MUST have all four keys: "Parameters" (use {} if none), "Identifier", "Type", "Transitions".
5. Do NOT invent template variables. Use the literal ARN/ID strings provided below.
6. Do NOT use TransferContactToQueue or ConnectParticipantWithLexBot — they are not in the required pattern.

RESOURCE VALUES (use these exact strings):
  Wisdom Assistant ARN               : "${assistantArn}"
  Q Connect AI Agent ARN (versioned) : "${versionedAgentArn}"
  Fallback Queue ARN/ID              : "${fallbackQueueId}"

MANDATORY BLOCK SEQUENCE — generate exactly these blocks in this order:

Block 1 — UpdateFlowLoggingBehavior:
  Parameters: { "FlowLoggingBehavior": "Enabled" }
  Transitions: { "NextAction": "<block2>" }
  *** No Errors array on this block — Connect rejects it ***

Block 2 — UpdateContactTargetQueue (set fallback queue upfront):
  Parameters: { "QueueId": "${fallbackQueueId}" }
  Transitions: { "NextAction": "<block3>", "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingError" }] }

Block 3 — CreateWisdomSession:
  Parameters: {
    "WisdomAssistantArn": "${assistantArn}",
    "OrchestrationAIAgentConfiguration": {
      "AgentAssistanceAgentVersionArn": "${versionedAgentArn}"
    }
  }
  Transitions: { "NextAction": "<block4>", "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingError" }] }

Block 4 — UpdateContactData (store Wisdom session ARN):
  Parameters: { "WisdomSessionArn": "$.Wisdom.SessionArn" }
  Transitions: { "NextAction": "<block5>", "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingError" }] }

Block 5 — UpdateContactAttributes (expose session ARN as contact attribute):
  Parameters: { "Attributes": { "wisdomSessionArn": "$.Wisdom.SessionArn" }, "TargetContact": "Current" }
  Transitions: { "NextAction": "<block6>", "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingError" }] }

Block 6 — MessageParticipant (welcome greeting):
  Parameters: { "Text": "${journeyConfig.welcomeMessage}", "SkipWhenDTMFBufferEnabled": "false" }
  Transitions: { "NextAction": "<block7_compare>", "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingError" }] }

Block 7 — Compare (route on Q Connect agent tool signal):
  Parameters: { "ComparisonValue": "$.Lex.SessionAttributes.Tool" }
  Transitions:
    "NextAction": "<fallback>"
    "Conditions": [ one entry per routing rule below ]
    "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingCondition" }]

ROUTING CONDITIONS for the Compare block (each generates one or two blocks after block 7):
${rulesText}
  Default (NextAction, no condition match) → <fallback>
  Errors (NoMatchingCondition) → <fallback>

FALLBACK BLOCK (shared by all error paths and the Compare default):
  Type: DisconnectParticipant, Parameters: {}, Transitions: {}

TERMINAL BLOCK RULES:
  DisconnectParticipant: MUST have Parameters: {} and Transitions: {} — never omit Parameters.
  UpdateContactTargetQueue before DisconnectParticipant: set QueueId, then next block is DisconnectParticipant.

ERRORS RULES:
  Every non-terminal block MUST have an Errors array in its Transitions.
  Compare block errors: ErrorType = "NoMatchingCondition".
  All other blocks: ErrorType = "NoMatchingError".
  UpdateFlowLoggingBehavior is the ONLY exception — no Errors array.

DISCOVERED BLOCK SCHEMAS (reference for parameter/transition shapes):
${schemaJson}`;
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
    return { explanation: "", issues: [], suggestions: [], verifiedAt: new Date().toISOString(), error: msg };
  }

  const cleaned = stripMarkdownFences(responseText);
  try {
    const parsed = JSON.parse(cleaned) as { explanation?: string; issues?: string[]; suggestions?: string[] };
    return {
      explanation: parsed.explanation ?? cleaned,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      verifiedAt: new Date().toISOString(),
    };
  } catch {
    return {
      explanation: cleaned,
      issues: [],
      suggestions: [],
      verifiedAt: new Date().toISOString(),
      error: "Model did not return valid JSON — treat this verification result as unreliable.",
    };
  }
}
