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
      visibilityStatus: aws.visibilityStatus,
      configuration: {
        orchestrationAIAgentConfiguration: {
          orchestrationAIPromptId: "",
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
