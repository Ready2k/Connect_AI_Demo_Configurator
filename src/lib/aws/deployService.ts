import { ProjectConfig, DeploymentManifest, DeployedPrompt, DeployedAgent } from "@/types/project";
import { buildPayloads } from "../payloads/buildPayloads";
import {
  getQConnectClient,
  createAiPrompt,
  createAiPromptVersion,
  createAiAgent,
  createAiAgentVersion,
  listAiPrompts,
  listAiAgents,
} from "./qconnectClient";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export interface DeployProgressEvent {
  type: "step_start" | "step_complete" | "step_error";
  stepId: string;
  error?: string;
}
export type DeployProgressCallback = (event: DeployProgressEvent) => void;

async function fetchAllPrompts(client: any, assistantId: string) {
  let nextToken: string | undefined;
  let allPrompts: any[] = [];
  do {
    const res = await listAiPrompts(client, { assistantId, nextToken, maxResults: 100, origin: "CUSTOMER" as any });
    if (res.aiPromptSummaries) allPrompts = allPrompts.concat(res.aiPromptSummaries);
    nextToken = res.nextToken;
  } while (nextToken);
  return allPrompts;
}

async function fetchAllAgents(client: any, assistantId: string) {
  let nextToken: string | undefined;
  let allAgents: any[] = [];
  do {
    const res = await listAiAgents(client, { assistantId, nextToken, maxResults: 100, origin: "CUSTOMER" as any });
    if (res.aiAgentSummaries) allAgents = allAgents.concat(res.aiAgentSummaries);
    nextToken = res.nextToken;
  } while (nextToken);
  return allAgents;
}

export interface DeployResult {
  success: boolean;
  error?: string;
  manifest?: DeploymentManifest;
}

export async function deployProject(
  config: ProjectConfig,
  timestamp: number,
  onProgress?: DeployProgressCallback
): Promise<DeployResult> {
  try {
    const { aws } = config;
    if (aws.deploymentMode === "preview_only") {
      return { success: true };
    }

    const client = getQConnectClient(aws.region);
    const payloads = buildPayloads(config, timestamp);

    const prompts: DeployedPrompt[] = [];
    const agents: DeployedAgent[] = [];

    let accountId = "";
    if (aws.deploymentMode.includes("agents")) {
      const sts = new STSClient({ region: aws.region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account || "";
    }

    // Duplicate detection
    if (aws.deploymentMode.includes("prompts")) {
      const existingPrompts = await fetchAllPrompts(client, aws.assistantId);
      const targetNames = payloads.promptPayloads.map(p => p.name);
      for (const p of existingPrompts) {
        if (targetNames.includes(p.name)) {
          throw new Error(`Duplicate AI Prompt found: A prompt with name "${p.name}" already exists in the assistant. Deployment stopped to prevent conflicts. Please change the Name Suffix Mode or manually delete existing prompts.`);
        }
      }
    }

    if (aws.deploymentMode.includes("agents")) {
      const existingAgents = await fetchAllAgents(client, aws.assistantId);
      const targetNames = payloads.agentPayloads.map(a => a.name);
      for (const a of existingAgents) {
        if (targetNames.includes(a.name)) {
          throw new Error(`Duplicate AI Agent found: An agent with name "${a.name}" already exists in the assistant. Deployment stopped to prevent conflicts. Please change the Name Suffix Mode or manually delete existing agents.`);
        }
      }
    }

    // 1. Create Prompts
    if (
      aws.deploymentMode === "create_prompts_only" ||
      aws.deploymentMode === "create_prompts_and_agents"
    ) {
      for (let i = 0; i < payloads.promptPayloads.length; i++) {
        const p = payloads.promptPayloads[i];
        const baseAgentConfig = config.agents.filter(a => a.enabled)[i];
        const baseName = baseAgentConfig.name;

        onProgress?.({ type: "step_start", stepId: `prompt_${i}` });

        let promptRes;
        try {
          promptRes = await createAiPrompt(client, p);
        } catch (err: any) {
          onProgress?.({ type: "step_error", stepId: `prompt_${i}`, error: err.message });
          throw new Error(`Failed to create Prompt for '${baseName}': ${err.message}. Payload: ${JSON.stringify(p.templateConfiguration)}`);
        }

        if (!promptRes.aiPrompt?.aiPromptId) {
          onProgress?.({ type: "step_error", stepId: `prompt_${i}` });
          throw new Error(`Failed to create Prompt ${baseName}: Expected prompt identifier in SDK response.`);
        }

        let promptVerRes;
        try {
          promptVerRes = await createAiPromptVersion(client, {
            assistantId: aws.assistantId,
            aiPromptId: promptRes.aiPrompt.aiPromptId,
          });
        } catch (err: any) {
          onProgress?.({ type: "step_error", stepId: `prompt_${i}`, error: err.message });
          throw new Error(`Failed to create Prompt Version for '${baseName}': ${err.message}`);
        }

        prompts.push({
          id: promptRes.aiPrompt.aiPromptId,
          arn: promptRes.aiPrompt.aiPromptArn as string,
          version: promptVerRes.versionNumber?.toString(),
          versionArn: promptVerRes.aiPrompt?.aiPromptArn || `${promptRes.aiPrompt.aiPromptArn}:${promptVerRes.versionNumber}`,
          baseName,
          deployedName: promptRes.aiPrompt.name as string,
        });

        onProgress?.({ type: "step_complete", stepId: `prompt_${i}` });
      }
    }

    // 2. Create Agents
    if (
      aws.deploymentMode === "create_agents_only" ||
      aws.deploymentMode === "create_prompts_and_agents"
    ) {
      for (let i = 0; i < payloads.agentPayloads.length; i++) {
        const a = payloads.agentPayloads[i];
        const baseAgentConfig = config.agents.filter(agent => agent.enabled)[i];
        const baseName = baseAgentConfig.name;

        onProgress?.({ type: "step_start", stepId: `agent_${i}` });

        if (a.configuration?.orchestrationAIAgentConfiguration) {
          const targetPrompt = prompts.find(p => p.baseName === baseName);
          a.configuration.orchestrationAIAgentConfiguration.orchestrationAIPromptId =
            targetPrompt?.version ? `${targetPrompt.id}:${targetPrompt.version}` : (targetPrompt?.id || "");
          if (aws.connectRegion && aws.connectInstanceId) {
            a.configuration.orchestrationAIAgentConfiguration.connectInstanceArn =
              `arn:aws:connect:${aws.connectRegion}:${accountId}:instance/${aws.connectInstanceId}`;
          }
        }

        try {
          const agentRes = await createAiAgent(client, a);

          if (!agentRes.aiAgent?.aiAgentId) {
            throw new Error(`Expected agent identifier in SDK response.`);
          }

          let agentVerRes;
          try {
            agentVerRes = await createAiAgentVersion(client, {
              assistantId: aws.assistantId,
              aiAgentId: agentRes.aiAgent.aiAgentId,
            });
          } catch (err: any) {
            throw new Error(`Failed to create Agent Version: ${err.message}`);
          }

          agents.push({
            id: agentRes.aiAgent.aiAgentId,
            arn: agentRes.aiAgent.aiAgentArn as string,
            version: agentVerRes.versionNumber?.toString(),
            versionArn: agentVerRes.aiAgent?.aiAgentArn || `${agentRes.aiAgent.aiAgentArn}:${agentVerRes.versionNumber}`,
            baseName,
            deployedName: agentRes.aiAgent.name as string,
          });

          onProgress?.({ type: "step_complete", stepId: `agent_${i}` });

        } catch (err: any) {
          const fullErrorDetails = `Name: ${err.name}, Message: ${err.message}, Fault: ${err.$fault || 'unknown'}`;
          console.error(`Failed to create Agent for '${baseName}': ${fullErrorDetails}`);
          onProgress?.({ type: "step_error", stepId: `agent_${i}`, error: err.message });
          agents.push({
            id: "deployment_failed",
            arn: "deployment_failed",
            baseName,
            deployedName: baseName,
            error: `Agent creation blocked by AWS IAM: ${err.message}. Please create this Agent manually in the AWS Console.`,
          });
        }
      }
    }

    onProgress?.({ type: "step_start", stepId: "manifest" });

    const manifest: DeploymentManifest = {
      deployedAt: new Date().toISOString(),
      region: aws.region,
      assistantId: aws.assistantId,
      visibilityStatus: aws.visibilityStatus,
      prompts,
      agents,
    };

    const failedAgents = agents.filter(a => a.id === "deployment_failed");
    if (failedAgents.length > 0) {
      const names = failedAgents.map(a => a.baseName).join(", ");
      onProgress?.({ type: "step_error", stepId: "manifest" });
      return {
        success: false,
        error: `Agent deployment failed for: ${names}. Prompts were created successfully. See manifest for details.`,
        manifest,
      };
    }

    onProgress?.({ type: "step_complete", stepId: "manifest" });
    return { success: true, manifest };
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error occurred during deployment" };
  }
}
