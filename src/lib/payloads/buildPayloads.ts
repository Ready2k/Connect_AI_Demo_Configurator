import { ProjectConfig } from "@/types/project";
import { CreateAIPromptCommandInput, CreateAIAgentCommandInput } from "@aws-sdk/client-qconnect";
import { computeDeployedName } from "../config/nameUtils";

export interface PayloadResult {
  customerIntentRouterPromptPayload: CreateAIPromptCommandInput;
  lostCardPromptPayload: CreateAIPromptCommandInput;
  customerIntentRouterAgentPayload: CreateAIAgentCommandInput;
  lostCardAgentPayload: CreateAIAgentCommandInput;
}

export function buildPayloads(config: ProjectConfig, timestamp: number = Date.now()): PayloadResult {
  const { aws, agents, tags } = config;

  const customerRouterName = computeDeployedName(agents.customerIntentRouter.name, config, timestamp);
  const lostCardName = computeDeployedName(agents.lostCard.name, config, timestamp);

  const customerIntentRouterPromptPayload: CreateAIPromptCommandInput = {
    assistantId: aws.assistantId,
    name: customerRouterName,
    type: agents.customerIntentRouter.promptType,
    templateType: "TEXT",
    visibilityStatus: aws.visibilityStatus,
    templateConfiguration: {
      textFullAIPromptEditTemplateConfiguration: {
        text: agents.customerIntentRouter.promptTemplate,
      },
    },
    apiFormat: agents.customerIntentRouter.apiFormat,
    modelId: config.aws.modelId,
    tags,
  };

  const lostCardPromptPayload: CreateAIPromptCommandInput = {
    assistantId: aws.assistantId,
    name: lostCardName,
    type: agents.lostCard.promptType,
    templateType: "TEXT",
    visibilityStatus: aws.visibilityStatus,
    templateConfiguration: {
      textFullAIPromptEditTemplateConfiguration: {
        text: agents.lostCard.promptTemplate,
      },
    },
    apiFormat: agents.lostCard.apiFormat,
    modelId: config.aws.modelId,
    tags,
  };

  const customerIntentRouterAgentPayload: CreateAIAgentCommandInput = {
    assistantId: aws.assistantId,
    name: customerRouterName,
    type: agents.customerIntentRouter.agentType,
    visibilityStatus: aws.visibilityStatus,
    configuration: {
      orchestrationAIAgentConfiguration: {
        orchestrationAIPromptId: "",
      },
    },
    tags,
  };

  const lostCardAgentPayload: CreateAIAgentCommandInput = {
    assistantId: aws.assistantId,
    name: lostCardName,
    type: agents.lostCard.agentType,
    visibilityStatus: aws.visibilityStatus,
    configuration: {
      orchestrationAIAgentConfiguration: {
        orchestrationAIPromptId: "",
      },
    },
    tags,
  };

  return {
    customerIntentRouterPromptPayload,
    lostCardPromptPayload,
    customerIntentRouterAgentPayload,
    lostCardAgentPayload,
  };
}
