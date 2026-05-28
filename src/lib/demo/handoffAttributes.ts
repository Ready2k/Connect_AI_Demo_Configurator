import { HandoffAttribute } from "@/types/project";

export const defaultHandoffAttributes: HandoffAttribute[] = [
  {
    key: "customerIntent",
    description: "Classified customer intent",
    exampleValue: "lost_card",
    required: true
  },
  {
    key: "cardIssueType",
    description: "Lost, stolen, damaged, retained, freeze, block, or unknown",
    exampleValue: "lost",
    required: true
  },
  {
    key: "reasonForCall",
    description: "Short reason captured from the customer",
    exampleValue: "Customer has lost their debit card",
    required: true
  },
  {
    key: "fraudMentioned",
    description: "Whether fraud or suspicious activity was mentioned",
    exampleValue: "false",
    required: true
  },
  {
    key: "safetyConcernMentioned",
    description: "Whether vulnerability, coercion, threat, or safety concern was mentioned",
    exampleValue: "false",
    required: true
  },
  {
    key: "affectedCardDescriptor",
    description: "Safe descriptor only, never full card number",
    exampleValue: "debit card ending 1234",
    required: false
  },
  {
    key: "customerConfirmedBlocking",
    description: "Whether the customer explicitly confirmed permanent blocking",
    exampleValue: "true",
    required: false
  },
  {
    key: "selfServiceStage",
    description: "Last self-service stage reached",
    exampleValue: "block_card_attempted",
    required: true
  },
  {
    key: "handoffReason",
    description: "Reason the journey was handed to a human",
    exampleValue: "tool_failure",
    required: true
  },
  {
    key: "toolFailureCode",
    description: "Safe failure code from mock or real tool",
    exampleValue: "CARD_BLOCK_SERVICE_UNAVAILABLE",
    required: false
  },
  {
    key: "toolFailureSummary",
    description: "Short safe explanation of the tool failure",
    exampleValue: "The card block action failed during self-service",
    required: false
  },
  {
    key: "aiSummary",
    description: "Short summary for the colleague",
    exampleValue: "Customer reported a lost debit card and confirmed they wanted it blocked. Self-service could not complete the block.",
    required: true
  },
  {
    key: "recommendedNextAction",
    description: "Suggested next action for the colleague",
    exampleValue: "Manually block the card and arrange replacement",
    required: true
  }
];
