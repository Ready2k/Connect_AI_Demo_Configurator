export type VisibilityStatus = "SAVED" | "PUBLISHED";

export type DeploymentMode =
  | "preview_only"
  | "create_prompts_only"
  | "create_agents_only"
  | "create_prompts_and_agents";

export type DemoFailureMode =
  | "tool_failure_at_list_cards"
  | "tool_failure_at_block_card"
  | "tool_failure_at_replacement"
  | "manual_success_simulation";

export interface ProjectConfig {
  projectName: string;
  environmentName: string;
  aws: AwsSettings;
  agents: AgentConfig[];
  handoff: HandoffConfig;
  tags: Record<string, string>;
  demoFailureMode: DemoFailureMode;
}

export interface AwsSettings {
  region: string;
  assistantId: string;
  connectInstanceId?: string;
  modelId: string;
  visibilityStatus: VisibilityStatus;
  deploymentMode: DeploymentMode;
  nameSuffixMode: "none" | "environment" | "timestamp" | "environment_and_timestamp";
  connectRegion: string;
  connectInstanceUrl: string;
  flowAssistantModelId: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  agentType: "ORCHESTRATION";
  promptType: "ORCHESTRATION";
  apiFormat: "MESSAGES" | "TEXT_COMPLETIONS";
  promptTemplate: string;
  sourceBase?: "SelfServiceOrchestrator";
  enabled: boolean;
}

export interface HandoffConfig {
  humanQueueId?: string;
  humanQueueArn?: string;
  lambdaRoutingFunctionName?: string;
  defaultHandoffReason: string;
  contactAttributes: HandoffAttribute[];
}

export interface HandoffAttribute {
  key: string;
  description: string;
  exampleValue: string;
  required: boolean;
}

export interface DeployedPrompt {
  id: string;
  arn?: string;
  version?: string;
  versionArn?: string;
  baseName: string;
  deployedName: string;
}

export interface DeployedAgent {
  id: string;
  arn?: string;
  version?: string;
  versionArn?: string;
  baseName: string;
  deployedName: string;
  error?: string;
}

export interface DeploymentManifest {
  deployedAt: string;
  region: string;
  assistantId: string;
  visibilityStatus: VisibilityStatus;
  prompts: DeployedPrompt[];
  agents: DeployedAgent[];
}
