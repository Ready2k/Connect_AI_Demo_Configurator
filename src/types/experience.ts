export type RoutingAction = "agent" | "queue" | "disconnect";

export interface RoutingRule {
  id: string;
  attributeKey: string;
  condition: string;
  action: RoutingAction;
  targetAgentName?: string;
  targetQueueId?: string;
  targetQueueName?: string;
}

export interface JourneyConfig {
  welcomeMessage: string;
  entryAgentName: string;
  routingRules: RoutingRule[];
  fallbackQueueId: string;
  fallbackQueueName: string;
}

export type GenerationStatus = "idle" | "generating" | "success" | "manual_review";

export interface VerificationResult {
  explanation: string;
  issues: string[];
  suggestions: string[];
  verifiedAt: string;
}

export interface ExperienceConfig {
  id: string;
  name: string;
  journeyConfig: JourneyConfig;
  generatedFlowJson?: string;
  generationStatus: GenerationStatus;
  generationError?: string;
  lastGeneratedAt?: string;
  verificationResult?: VerificationResult;
}

export interface GenerationResult {
  status: "success" | "manual_review";
  flowJson?: string;
  error?: string;
}
