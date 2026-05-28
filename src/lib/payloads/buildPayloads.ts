import { ProjectConfig } from "@/types/project";
import { CreateAIPromptCommandInput, CreateAIAgentCommandInput } from "@aws-sdk/client-qconnect";
import { computeDeployedName } from "../config/nameUtils";

export interface PayloadResult {
  promptPayloads: CreateAIPromptCommandInput[];
  agentPayloads: CreateAIAgentCommandInput[];
}

export function buildPayloads(config: ProjectConfig, timestamp: number = Date.now()): PayloadResult {
  const { aws, agents, tags } = config;

  const promptPayloads: CreateAIPromptCommandInput[] = [];
  const agentPayloads: CreateAIAgentCommandInput[] = [];

  for (const agent of agents) {
    if (!agent.enabled) continue;

    const deployedName = computeDeployedName(agent.name, config, timestamp);

    promptPayloads.push({
      assistantId: aws.assistantId,
      name: deployedName,
      type: agent.promptType,
      templateType: "TEXT",
      visibilityStatus: "PUBLISHED", // AWS requires referenced prompts to be PUBLISHED
      templateConfiguration: {
        textFullAIPromptEditTemplateConfiguration: {
          text: agent.promptTemplate,
        },
      },
      apiFormat: agent.apiFormat,
      modelId: config.aws.modelId,
      tags,
    });

    agentPayloads.push({
      assistantId: aws.assistantId,
      name: deployedName,
      type: agent.agentType,
      visibilityStatus: "PUBLISHED",
      configuration: {
        orchestrationAIAgentConfiguration: {
          orchestrationAIPromptId: "",
          locale: "en_US",
          toolConfigurations: [
            {
              toolName: "Complete",
              toolType: "RETURN_TO_CONTROL",
              description: "Use this tool when the customer's request has been fully resolved and the conversation can end.",
              inputSchema: { type: "object", properties: {} },
              userInteractionConfiguration: { isUserConfirmationRequired: false },
            },
            {
              toolName: "Escalate",
              toolType: "RETURN_TO_CONTROL",
              description: "Use this tool to escalate the conversation to a human agent when the request cannot be resolved autonomously.",
              inputSchema: { type: "object", properties: {} },
              userInteractionConfiguration: { isUserConfirmationRequired: false },
            },
            {
              toolName: "Retrieve",
              toolType: "MODEL_CONTEXT_PROTOCOL",
              toolId: "aws_service__qconnect_Retrieve",
              userInteractionConfiguration: { isUserConfirmationRequired: false },
            },
          ],
        },
      },
      tags,
    });
  }

  return {
    promptPayloads,
    agentPayloads,
  };
}
