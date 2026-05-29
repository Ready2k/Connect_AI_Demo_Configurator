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
  lexBotAliasArn?: string;
  wisdomAgentArn?: string;
  languageCode?: string;
  voiceId?: string;
}

export type GenerationStatus = "idle" | "generating" | "success" | "manual_review";

export interface VerificationResult {
  explanation: string;
  issues: string[];
  suggestions: string[];
  verifiedAt: string;
  error?: string;
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

export interface GenerationLogEntry {
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  details?: unknown;
}

export interface GenerationResult {
  status: "success" | "manual_review";
  flowJson?: string;
  error?: string;
  logs?: GenerationLogEntry[];
}
