import { getBedrockClient, converseWithModel } from "@/lib/aws/bedrockClient";
import type { BlockSchemaLibrary, } from "@/types/flowSchema";
import type { JourneyConfig, GenerationResult, GenerationLogEntry, VerificationResult } from "@/types/experience";

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  // Accept any whitespace (space or newline) between the fence/language tag and the content
  const match = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (match) return match[1].trim();
  return trimmed;
}

export interface AgentContext {
  name: string;
  description: string;
  promptTemplate: string;
  tools: Array<{ name: string; description?: string }>;
}

function buildAgentContextSection(ctx: AgentContext): string {
  const toolLines = ctx.tools.length > 0
    ? ctx.tools.map((t) => `  - ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n")
    : "  (none configured)";

  // Strip the raw YAML prompt down to just the system block for readability
  const systemMatch = ctx.promptTemplate.match(/^system:\s*\|\s*\n([\s\S]*?)(?=\nmessages:|\s*$)/m);
  const systemContent = systemMatch
    ? systemMatch[1].replace(/^ {2}/gm, "").trim()
    : ctx.promptTemplate.slice(0, 3000).trim();

  return `
ENTRY AGENT CONTEXT
===================
The Q Connect AI Agent this flow hands the customer to is: "${ctx.name}"

Purpose: ${ctx.description || "(no description provided)"}

Tools this agent can invoke (these are the exact values it signals via $.Lex.SessionAttributes.AuthResult —
use these names verbatim in the Compare block Conditions):
${toolLines}

Agent system prompt (understand this to know what goal the flow must serve, what the agent can and
cannot do, and why certain routing conditions are meaningful):
--- BEGIN AGENT PROMPT ---
${systemContent}
--- END AGENT PROMPT ---
`;
}

function buildGenerationSystemPrompt(
  journeyConfig: JourneyConfig,
  library: BlockSchemaLibrary,
  agentContext?: AgentContext
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

  if (!journeyConfig.lexBotAliasArn) {
    throw new Error("Missing lexBotAliasArn. Cannot generate flow without a valid Lex Bot ARN.");
  }
  const lexBotAliasArn = journeyConfig.lexBotAliasArn;

  // Each "queue" routing rule transfers to that specific queue (real handoff).
  // Each "disconnect" or "agent" rule ends the call.
  const rulesText = journeyConfig.routingRules
    .map((r) => {
      if (r.action === "queue") {
        return `   - Condition "${r.condition}": TransferContactToQueue (Parameters: {}, Transitions to fallback on NextAction/QueueAtCapacity/NoMatchingError)`;
      }
      return `   - Condition "${r.condition}": MessageParticipant (Parameters: { "Text": "Thank you. Your request has been processed successfully. Goodbye!" }) -> Transitions to DisconnectParticipant`;
    })
    .join("\n");

  const agentContextSection = agentContext ? buildAgentContextSection(agentContext) : "";

  return `You are generating an Amazon Connect Contact Flow JSON document.
${agentContextSection}
STRICT OUTPUT RULES:
The generated output must be EXACTLY valid JSON, starting with { and ending with }. Do NOT wrap it in markdown block quotes.

The root structure of the JSON MUST be exactly:
{
  "Version": "2019-10-30",
  "StartAction": "<identifier-of-block-1>",
  "Actions": [
    // array of blocks
  ]
}

For all Blocks (Actions), generate standard UUIDs for their 'Identifier' fields (e.g. "b0000001-0000-0000-0000-000000000001")., "b0000001-0000-0000-0000-000000000002", etc.
4. Every action MUST have all four keys: "Parameters" (use {} if none), "Identifier", "Type", "Transitions".
5. Do NOT invent template variables. Use the literal ARN/ID strings provided below.

RESOURCE VALUES (use these exact strings):
  Wisdom Assistant ARN               : "${assistantArn}"
  Q Connect AI Agent ARN (versioned) : "${versionedAgentArn}"
  Fallback Queue ARN/ID              : "${fallbackQueueId}"
  Lex Bot Alias ARN                  : "${lexBotAliasArn}"

MANDATORY BLOCK SEQUENCE — generate exactly these blocks in this order:

Block 1 — UpdateFlowLoggingBehavior:
  Parameters: { "FlowLoggingBehavior": "Enabled" }
  Transitions: { "NextAction": "<block1a>" }
  *** No Errors array — Connect rejects it on this block type ***

Block 1a — UpdateContactTextToSpeechVoice (set the language for Lex to recognise chat sessions properly):
  Parameters: {
    "TextToSpeechVoice": "${journeyConfig.voiceId ?? 'Joanna'}"
  }
  Transitions: { "NextAction": "<block2>", "Errors": [{ "NextAction": "<block2>", "ErrorType": "NoMatchingError" }] }

Block 2 — UpdateContactTargetQueue (set fallback queue upfront so all error paths are safe):
  Parameters: { "QueueId": "${fallbackQueueId}" }
  Transitions: { "NextAction": "<block3>", "Errors": [{ "NextAction": "<fallback_message>", "ErrorType": "NoMatchingError" }] }

Block 3 — CreateWisdomSession (initialise Q Connect — the AI agent is configured on the assistant, NOT here):
  *** Only WisdomAssistantArn is accepted. Do NOT add OrchestrationAIAgentConfiguration or any other key. ***
  Parameters: { "WisdomAssistantArn": "${assistantArn}" }
  Transitions: { "NextAction": "<block4>", "Errors": [{ "NextAction": "<fallback_message>", "ErrorType": "NoMatchingError" }] }

Block 4 — UpdateContactAttributes (link the Q Connect session to the contact):
  Parameters: {
    "Attributes": {
      "x-amz-lex:q-in-connect:session-arn": "$.Wisdom.SessionArn"
    },
    "TargetContact": "Current"
  }
  Transitions: { "NextAction": "<block5>", "Errors": [{ "NextAction": "<fallback_transfer>", "ErrorType": "NoMatchingError" }] }

Block 5 — GetParticipantInput (invoke the Q Connect AI agent via the Lex bot):
  *** THIS IS THE BLOCK THAT RUNS THE AI AGENT CONVERSATION ***
  The block type is GetParticipantInput (NOT ConnectParticipantWithLexBot — that is a UI-only name).
  Parameters: {
    "Text": "${journeyConfig.welcomeMessage}",
    "LexTimeoutSeconds": {
      "Text": "300"
    },
    "LexV2Bot": {
      "AliasArn": "${lexBotAliasArn}"
    }
  }
  Transitions: { "NextAction": "<block6>", "Errors": [{ "NextAction": "<block5_error>", "ErrorType": "NoMatchingCondition" }, { "NextAction": "<block5_error>", "ErrorType": "InputTimeLimitExceeded" }, { "NextAction": "<block5_error>", "ErrorType": "NoMatchingError" }] }

Block 5_error — MessageParticipant (inform user if Lex fails):
  Type: MessageParticipant
  Parameters: {
    "Text": "Sorry, we're having trouble connecting you to the AI agent. I'll connect you to someone who can help."
  }
  Transitions: { "NextAction": "<fallback_transfer>", "Errors": [{ "NextAction": "<fallback_transfer>", "ErrorType": "NoMatchingError" }] }

Block 6 — Compare (read the tool signal set by the AI agent and route accordingly):
  Parameters: { "ComparisonValue": "$.Lex.SessionAttributes.AuthResult" }
  Transitions:
    "NextAction": "<fallback>"  (default — no condition matched)
    "Conditions": [ one entry per routing rule below ]
    "Errors": [{ "NextAction": "<fallback>", "ErrorType": "NoMatchingCondition" }]

ROUTING CONDITIONS for the Compare block (generate one block per rule after block 6):
${rulesText}
  Default (NextAction, no condition matched) → <fallback_message>
  Errors (NoMatchingCondition) → <fallback_message>

FALLBACK SEQUENCE (shared terminal for all unmatched/error paths):
  Block fallback_message (route all Error paths and default Compare conditions here):
    Type: MessageParticipant
    Parameters: { "Text": "Sorry, we're having trouble processing your request. I'll connect you to someone who can help." }
    Transitions: { "NextAction": "<fallback_transfer>", "Errors": [{ "NextAction": "<fallback_transfer>", "ErrorType": "NoMatchingError" }] }
    
  Block fallback_transfer (route fallback messages and specific errors here):
    Type: TransferContactToQueue
    Parameters: {}
    Transitions: { "NextAction": "<fatal_error_message>", "Errors": [{ "NextAction": "<fatal_error_message>", "ErrorType": "QueueAtCapacity" }, { "NextAction": "<fatal_error_message>", "ErrorType": "NoMatchingError" }] }
    
  Block fatal_error_message (tell the user we cannot connect them before disconnecting):
    Type: MessageParticipant
    Parameters: { "Text": "We are currently experiencing technical difficulties and cannot complete your call. Please try again later. Goodbye." }
    Transitions: { "NextAction": "<disconnect>", "Errors": [{ "NextAction": "<disconnect>", "ErrorType": "NoMatchingError" }] }
    
  Block disconnect (only referenced by fatal_error_message and specific rules):
    Type: DisconnectParticipant, Parameters: {}, Transitions: {}

TERMINAL BLOCK RULES:
  TransferContactToQueue: NOT terminal. MUST have Parameters: {}. Transitions MUST include NextAction, and Errors for "QueueAtCapacity" and "NoMatchingError". Route all of these to <fallback_message>.
  DisconnectParticipant: terminal — MUST have Parameters: {} and Transitions: {}.
  GetParticipantInput (Lex bot block): NOT terminal — it continues to the Compare block when the bot session ends.

ERRORS RULES:
  Every non-terminal block MUST have an Errors array in its Transitions.
  Compare block errors: ErrorType = "NoMatchingCondition".
  All other blocks: ErrorType = "NoMatchingError".
  UpdateFlowLoggingBehavior is the ONLY exception — no Errors array.

DISCOVERED BLOCK SCHEMAS (reference for parameter/transition shapes):
${schemaJson}`;
}

function buildFeedbackSection(feedback: {
  issues: unknown[];
  suggestions: unknown[];
  previousFlowJson: string;
}): string {
  const fmt = (item: unknown): string => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const parts = [o.severity ?? o.priority, o.issue ?? o.summary ?? o.suggestion ?? o.title, o.description ?? o.details ?? o.detail]
        .filter(Boolean)
        .map(String);
      return parts.length > 0 ? parts.join(" — ") : JSON.stringify(item);
    }
    return String(item);
  };

  const issueLines = feedback.issues.map((v, i) => `${i + 1}. ${fmt(v)}`).join("\n");
  const suggestionLines = feedback.suggestions.map((v, i) => `${i + 1}. ${fmt(v)}`).join("\n");

  return `PREVIOUS GENERATION FEEDBACK — you MUST address every point below in your new flow:

ISSUES TO FIX:
${issueLines || "(none)"}

SUGGESTIONS TO INCORPORATE:
${suggestionLines || "(none)"}

PREVIOUS FLOW JSON (for reference — do NOT copy it verbatim; rewrite it fixing all issues above):
${feedback.previousFlowJson}`;
}

export async function generateFlow(args: {
  journeyConfig: JourneyConfig;
  library: BlockSchemaLibrary;
  modelId: string;
  region: string;
  agentContext?: AgentContext;
  verificationFeedback?: { issues: unknown[]; suggestions: unknown[]; previousFlowJson: string };
}): Promise<GenerationResult> {
  const { journeyConfig, library, modelId, region, agentContext, verificationFeedback } = args;
  const logs: GenerationLogEntry[] = [];
  const client = getBedrockClient(region);
  const systemPrompt = buildGenerationSystemPrompt(journeyConfig, library, agentContext);

  const userText = verificationFeedback
    ? `Generate an improved contact flow JSON now.\n\n${buildFeedbackSection(verificationFeedback)}`
    : "Generate the contact flow JSON now.";

  const messages = [
    { role: "user" as const, content: [{ text: userText }] },
  ];

  logs.push({
    level: "INFO",
    message: verificationFeedback ? "Sending regeneration request with feedback to Bedrock" : "Sending generation request to Bedrock",
    details: {
      modelId, region,
      entryAgent: journeyConfig.entryAgentName,
      ruleCount: journeyConfig.routingRules.length,
      withAgentContext: !!agentContext,
      agentToolCount: agentContext?.tools.length ?? 0,
      withFeedback: !!verificationFeedback,
    },
  });

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
    const parsed = JSON.parse(cleaned) as { explanation?: string; issues?: unknown[]; suggestions?: unknown[] };

    const toStrings = (arr: unknown[] | undefined): string[] =>
      Array.isArray(arr)
        ? arr.map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
              const o = item as Record<string, unknown>;
              // Handle {severity, issue, description} or similar object shapes
              const parts = [o.severity, o.issue ?? o.summary ?? o.title, o.description ?? o.detail]
                .filter(Boolean)
                .map(String);
              return parts.length > 0 ? parts.join(" — ") : JSON.stringify(item);
            }
            return String(item);
          })
        : [];

    return {
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : cleaned,
      issues: toStrings(parsed.issues),
      suggestions: toStrings(parsed.suggestions),
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
