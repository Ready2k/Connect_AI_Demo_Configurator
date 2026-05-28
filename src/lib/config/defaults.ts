import { ProjectConfig } from "@/types/project";
import { defaultHandoffAttributes } from "../demo/handoffAttributes";
// Note: prompts will be populated correctly later, leaving placeholders for now
import { defaultCustomerIntentRouterPrompt } from "../prompts/customerIntentRouter";
import { defaultLostCardPrompt } from "../prompts/lostCard";

export const defaultProjectConfig: ProjectConfig = {
  projectName: "Connect Demo",
  environmentName: "dev",
  aws: {
    region: process.env.AWS_REGION || "eu-west-2",
    assistantId: process.env.CONNECT_Q_ASSISTANT_ID || "",
    connectInstanceId: process.env.CONNECT_INSTANCE_ID || "",
    modelId: process.env.AWS_MODEL_ID || "",
    visibilityStatus: (process.env.DEFAULT_VISIBILITY_STATUS as any) || "SAVED",
    deploymentMode: "preview_only",
    nameSuffixMode: "environment_and_timestamp",
    connectRegion: process.env.CONNECT_REGION || "us-west-2",
    connectInstanceUrl: process.env.CONNECT_INSTANCE_URL || "",
    flowAssistantModelId: process.env.FLOW_ASSISTANT_MODEL_ID || "us.amazon.nova-pro-v1:0",
  },
  agents: [
    {
      id: "customerIntentRouter",
      name: "CustomerIntentRouter",
      description: "Routes customer intent to the correct agent.",
      agentType: "ORCHESTRATION",
      promptType: "ORCHESTRATION",
      apiFormat: "MESSAGES",
      promptTemplate: defaultCustomerIntentRouterPrompt,
      sourceBase: "SelfServiceOrchestrator",
      enabled: true,
    },
    {
      id: "lostCard",
      name: "LostCard",
      description: "Handles lost card flows.",
      agentType: "ORCHESTRATION",
      promptType: "ORCHESTRATION",
      apiFormat: "TEXT_COMPLETIONS",
      promptTemplate: defaultLostCardPrompt,
      enabled: true,
    }
  ],
  handoff: {
    humanQueueId: "",
    humanQueueArn: "",
    lambdaRoutingFunctionName: "",
    defaultHandoffReason: "tool_failure",
    contactAttributes: defaultHandoffAttributes,
  },
  tags: {
    project: "connect-demo",
    environment: "dev",
  },
  demoFailureMode: "tool_failure_at_block_card",
};
