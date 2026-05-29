import { ProjectConfig, VisibilityStatus } from "@/types/project";
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
    visibilityStatus: (process.env.DEFAULT_VISIBILITY_STATUS as VisibilityStatus) || "SAVED",
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
      visibilityStatus: "SAVED",
      locale: "en_US",
      securityProfiles: [],
      tools: [
        { name: "Complete", toolType: "RETURN_TO_CONTROL", description: "Use this tool when the customer's request has been fully resolved and the conversation can end.", permissions: "Sufficient" },
        { name: "Escalate", toolType: "RETURN_TO_CONTROL", description: "Use this tool to escalate the conversation to a human agent when the request cannot be resolved autonomously.", permissions: "Sufficient" },
        { name: "Retrieve", toolType: "MODEL_CONTEXT_PROTOCOL", toolId: "aws_service__qconnect_Retrieve", namespace: "Amazon Connect", permissions: "Insufficient" }
      ],
      prompts: [
        { name: "CustomerIntentRouter", status: "Published", version: "1", type: "Orchestration" }
      ],
      guardrails: []
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
      visibilityStatus: "SAVED",
      locale: "en_US",
      securityProfiles: [],
      tools: [
        { name: "Complete", toolType: "RETURN_TO_CONTROL", description: "Use this tool when the customer's request has been fully resolved and the conversation can end.", permissions: "Sufficient" },
        { name: "Escalate", toolType: "RETURN_TO_CONTROL", description: "Use this tool to escalate the conversation to a human agent when the request cannot be resolved autonomously.", permissions: "Sufficient" }
      ],
      prompts: [
        { name: "LostCard", status: "Published", version: "1", type: "Orchestration" }
      ],
      guardrails: []
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
  demoFailureMode: "action_stage_failure",
};
