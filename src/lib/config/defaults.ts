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
  },
  agents: {
    customerIntentRouter: {
      name: "CustomerIntentRouter",
      description: "Captures customer reason for calling and routes to the correct specialist self-service journey",
      agentType: "ORCHESTRATION",
      promptType: "ORCHESTRATION",
      apiFormat: "MESSAGES",
      promptTemplate: defaultCustomerIntentRouterPrompt,
      sourceBase: "SelfServiceOrchestrator",
      enabled: true,
    },
    lostCard: {
      name: "LostCard",
      description: "Self-service AI agent for authenticated lost, stolen, damaged and retained card journeys",
      agentType: "ORCHESTRATION",
      promptType: "ORCHESTRATION",
      apiFormat: "MESSAGES",
      promptTemplate: defaultLostCardPrompt,
      sourceBase: "SelfServiceOrchestrator",
      enabled: true,
    },
  },
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
