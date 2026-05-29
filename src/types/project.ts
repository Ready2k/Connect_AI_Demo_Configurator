export type VisibilityStatus = "SAVED" | "PUBLISHED";

export type DeploymentMode =
  | "preview_only"
  | "create_prompts_only"
  | "create_agents_only"
  | "create_prompts_and_agents";

export type DemoFailureMode =
  | "immediate_failure"
  | "lookup_stage_failure"
  | "action_stage_failure"
  | "fulfillment_stage_failure"
  | "full_success_simulation"
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
  lexBotAliasArn?: string;
}

export interface AgentToolConfig {
  name: string;
  toolType: "RETURN_TO_CONTROL" | "MODEL_CONTEXT_PROTOCOL";
  description?: string;
  namespace?: string;
  permissions?: "Sufficient" | "Insufficient";
  toolId?: string;
  inputSchema?: Record<string, any>;
}

export interface AgentPromptConfig {
  name: string;
  status: "Draft" | "Published";
  version: string;
  type: string;
}

export interface AgentGuardrailConfig {
  name: string;
  status: "Draft" | "Published";
  version: string;
  type: string;
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
  
  // Deployable via AWS SDK
  visibilityStatus?: VisibilityStatus;
  locale?: string;
  tools?: AgentToolConfig[];
  
  // Local metadata only (Not yet supported by AWS SDK for programmatic deployment or just for UI)
  securityProfiles?: string[];
  prompts?: AgentPromptConfig[];
  guardrails?: AgentGuardrailConfig[];
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
