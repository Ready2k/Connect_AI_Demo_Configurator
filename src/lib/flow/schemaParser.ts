import type { DiscoveredBlockSchema, ParsedAction, ParsedFlow } from "@/types/flowSchema";

function getFriendlyName(type: string): string {
  // Exact-match first (most specific), then substring fallback.
  // Types sourced from aws-samples/sample-amazon-connect-agentic-ai-demo-setup-finance.
  switch (type) {
    case "CreateWisdomSession":            return "Connect Assistant (Create Session)";
    case "UpdateContactData":              return "Connect Assistant (Store Session)";
    case "ConnectParticipantWithLexBot":   return "Connect with AI Agent (Lex + Q Connect)";  // UI-only name
    case "Compare":                        return "Route by Condition";
    case "UpdateContactAttributes":        return "Set Contact Attributes";
    case "UpdateContactTargetQueue":       return "Set Target Queue";
    case "TransferContactToQueue":         return "Transfer to Queue";
    case "DisconnectParticipant":          return "Disconnect";
    case "InvokeLambdaFunction":           return "Invoke Lambda Function";
    case "UpdateFlowLoggingBehavior":      return "Enable Flow Logging";
    case "UpdateContactEventHooks":        return "Set Event Hooks (Screen Pop)";
    case "GetCustomerProfile":             return "Get Customer Profile";
    case "AssociateContactToCustomerProfile": return "Associate Customer Profile";
    case "UpdateContactRecordingAndAnalyticsBehavior": return "Contact Lens Recording";
    case "UpdateContactTextToSpeechVoice": return "Set Voice";
    case "StartExistingMessageProcessing": return "Process Existing Message";
    case "MessageParticipant":             return "Play Prompt";
    case "PlayPrompt":                     return "Play Prompt";
    case "GetParticipantInput":            return "Get Customer Input";
    case "StoreCustomerInput":             return "Get Customer Input";
  }
  // Substring fallback for undocumented variants
  const t = type.toLowerCase();
  if (t.includes("disconnect")) return "Disconnect";
  if (t.includes("transfer")) return "Transfer to Queue";
  if (t.includes("invokelambda") || t.includes("invokeexternalresource")) return "Invoke Lambda Function";
  if (t.includes("playprompt") || t.includes("messageparticipant")) return "Play Prompt";
  if (t.includes("setattributes") || t.includes("updatecontactattributes")) return "Set Contact Attributes";
  if (t.includes("getparticipantinput") || t.includes("storecustomerinput")) return "Get Customer Input";
  return type;
}

interface ConnectFlowJson {
  Version?: string;
  StartAction?: string;
  Actions?: Array<{
    Identifier?: string;
    Type?: string;
    Parameters?: Record<string, unknown>;
    Transitions?: Record<string, unknown>;
  }>;
}

export function parseFlowContent(flowJson: string): ParsedFlow {
  const raw: ConnectFlowJson = JSON.parse(flowJson);
  const actions: ParsedAction[] = [];
  const typeSet = new Set<string>();
  let hasConnectAssistantBlock = false;

  for (const action of raw.Actions ?? []) {
    const type = action.Type ?? "";
    const friendly = getFriendlyName(type);
    // Both blocks together constitute the Q Connect integration pattern
    if (
      type === "CreateWisdomSession" ||
      type === "ConnectParticipantWithLexBot" ||
      type === "GetParticipantInput"  // GetParticipantInput with LexV2Bot is the API equivalent
    ) hasConnectAssistantBlock = true;
    typeSet.add(friendly);
    actions.push({
      identifier: action.Identifier ?? "",
      type,
      parameters: action.Parameters ?? {},
      transitions: action.Transitions ?? {},
    });
  }

  return {
    id: "",
    name: "",
    type: "",
    actions,
    blockTypesFound: Array.from(typeSet),
    hasConnectAssistantBlock,
  };
}

export function extractBlockSchemas(
  flowId: string,
  flowName: string,
  parsedFlow: ParsedFlow
): Record<string, DiscoveredBlockSchema> {
  const schemas: Record<string, DiscoveredBlockSchema> = {};
  const discoveredAt = new Date().toISOString();

  for (const action of parsedFlow.actions) {
    const friendly = getFriendlyName(action.type);
    if (schemas[friendly]) continue;
    schemas[friendly] = {
      type: action.type,
      friendlyName: friendly,
      sampleParameters: action.parameters,
      sampleTransitions: action.transitions,
      sourceFlowId: flowId,
      sourceFlowName: flowName,
      discoveredAt,
    };
  }

  return schemas;
}

export function detectConnectAssistantBlock(parsedFlow: ParsedFlow): boolean {
  return parsedFlow.hasConnectAssistantBlock;
}
