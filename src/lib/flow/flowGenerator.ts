import { getBedrockClient, converseWithModel } from "@/lib/aws/bedrockClient";
import type { BlockSchemaLibrary, } from "@/types/flowSchema";
import type { JourneyConfig, GenerationResult, VerificationResult } from "@/types/experience";

function buildGenerationSystemPrompt(
  journeyConfig: JourneyConfig,
  library: BlockSchemaLibrary
): string {
  const schemaJson = JSON.stringify(library.schemas, null, 2);
  const rulesText = journeyConfig.routingRules
    .map((r) => {
      const target =
        r.action === "agent"
          ? `route to agent "${r.targetAgentName}" (repeat the CreateWisdomSession + UpdateContactData + ConnectParticipantWithLexBot pattern)`
          : r.action === "queue"
          ? `transfer to queue "${r.targetQueueName}" (UpdateContactTargetQueue then TransferContactToQueue)`
          : "disconnect (DisconnectParticipant)";
      return `   - If $.Lex.SessionAttributes.${r.attributeKey} equals "${r.condition}": ${target}`;
    })
    .join("\n");

  return `You are generating an Amazon Connect Contact Flow JSON document.
Use ONLY the block types and shapes provided in DISCOVERED BLOCK SCHEMAS below — do not invent block types.
Return ONLY valid JSON matching the Connect flow format. No explanation, no markdown, no prose.

IMPORTANT — HOW AMAZON Q IN CONNECT AI AGENTS WORK IN A CONTACT FLOW:
Q Connect AI agents are NOT invoked with a single block. The correct pattern is always THREE steps:
  Step A: "CreateWisdomSession" block — creates the session and attaches the AI agent ARN via OrchestrationAIAgentConfiguration or LexSessionAttributes
  Step B: "UpdateContactData" block — stores $.Wisdom.SessionArn back onto the contact
  Step C: "ConnectParticipantWithLexBot" block — starts the conversation; set LexSessionAttributes["x-amz-lex:q-in-connect:ai-agent-arn"] to the agent ARN format: {AIAssistantArn}/{agentId}:$LATEST

IMPORTANT — ROUTING AFTER AN AI AGENT:
After ConnectParticipantWithLexBot, the AI agent signals its routing decision by setting $.Lex.SessionAttributes.Tool.
Use a "Compare" block checking $.Lex.SessionAttributes.Tool to branch, NOT $.Attributes.agentOutput.intent.
Typical values: "Escalate" (route to human queue) and "Complete" (disconnect). These are set by the agent prompt.

DISCOVERED BLOCK SCHEMAS (use these shapes for parameters and transitions):
${schemaJson}

TARGET FLOW STRUCTURE:
1. UpdateFlowLoggingBehavior — enable logging
2. CreateWisdomSession — attach agent "${journeyConfig.entryAgentName}" via OrchestrationAIAgentConfiguration
3. UpdateContactData — store session ARN ($.Wisdom.SessionArn)
4. ConnectParticipantWithLexBot — invoke agent "${journeyConfig.entryAgentName}"; welcome text: "${journeyConfig.welcomeMessage}"; set x-amz-lex:q-in-connect:ai-agent-arn session attribute
5. Compare — check $.Lex.SessionAttributes.Tool:
${rulesText}
6. Default / NoMatchingCondition fallback: UpdateContactTargetQueue to "${journeyConfig.fallbackQueueName}", then TransferContactToQueue
7. On any error: UpdateContactTargetQueue to "${journeyConfig.fallbackQueueName}", then TransferContactToQueue`;
}

export async function generateFlow(args: {
  journeyConfig: JourneyConfig;
  library: BlockSchemaLibrary;
  modelId: string;
  region: string;
}): Promise<GenerationResult> {
  const { journeyConfig, library, modelId, region } = args;
  const client = getBedrockClient(region);
  const systemPrompt = buildGenerationSystemPrompt(journeyConfig, library);
  const messages = [
    { role: "user" as const, content: [{ text: "Generate the contact flow JSON now." }] },
  ];

  let response: string;
  try {
    response = await converseWithModel(client, modelId, messages, systemPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bedrock call failed";
    return { status: "manual_review", error: msg };
  }

  try {
    JSON.parse(response);
    return { status: "success", flowJson: response };
  } catch {
    const retryMessages = [
      ...messages,
      { role: "assistant" as const, content: [{ text: response }] },
      {
        role: "user" as const,
        content: [
          {
            text: "That response was not valid JSON. Please return ONLY valid JSON with no additional text.",
          },
        ],
      },
    ];
    try {
      const retry = await converseWithModel(client, modelId, retryMessages, systemPrompt);
      JSON.parse(retry);
      return { status: "success", flowJson: retry };
    } catch (retryErr: unknown) {
      const msg = retryErr instanceof Error ? retryErr.message : "JSON parse failed after retry";
      return { status: "manual_review", error: msg };
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
