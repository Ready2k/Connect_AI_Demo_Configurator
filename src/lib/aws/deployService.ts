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

export async function deployProject(config: ProjectConfig, timestamp: number): Promise<DeployResult> {
  try {
    const { aws } = config;
    if (aws.deploymentMode === "preview_only") {
      return { success: true };
    }

    const client = getQConnectClient(aws.region);
    const payloads = buildPayloads(config, timestamp);

    const prompts: DeployedPrompt[] = [];
    const agents: DeployedAgent[] = [];

    // Duplicate detection
    if (aws.deploymentMode.includes("prompts")) {
      const existingPrompts = await fetchAllPrompts(client, aws.assistantId);
      const targetNames = [payloads.customerIntentRouterPromptPayload.name, payloads.lostCardPromptPayload.name];
      for (const p of existingPrompts) {
        if (targetNames.includes(p.name)) {
          throw new Error(`Duplicate AI Prompt found: A prompt with name "${p.name}" already exists in the assistant. Deployment stopped to prevent conflicts. Please change the Name Suffix Mode or manually delete existing prompts.`);
        }
      }
    }
    
    if (aws.deploymentMode.includes("agents")) {
      const existingAgents = await fetchAllAgents(client, aws.assistantId);
      const targetNames = [payloads.customerIntentRouterAgentPayload.name, payloads.lostCardAgentPayload.name];
      for (const a of existingAgents) {
        if (targetNames.includes(a.name)) {
          throw new Error(`Duplicate AI Agent found: An agent with name "${a.name}" already exists in the assistant. Deployment stopped to prevent conflicts. Please change the Name Suffix Mode or manually delete existing agents.`);
        }
      }
    }

    // 1. Create Prompts (if allowed by mode)
    if (
      aws.deploymentMode === "create_prompts_only" ||
      aws.deploymentMode === "create_prompts_and_agents"
    ) {
      // Intent Router Prompt
      const routerPromptRes = await createAiPrompt(client, payloads.customerIntentRouterPromptPayload);
      if (!routerPromptRes.aiPrompt?.aiPromptId) {
        throw new Error("Failed to create Customer Intent Router Prompt: Expected prompt identifier in SDK response.");
      }
      const routerPromptVerRes = await createAiPromptVersion(client, {
        assistantId: aws.assistantId,
        aiPromptId: routerPromptRes.aiPrompt.aiPromptId,
      });
      prompts.push({
        id: routerPromptRes.aiPrompt.aiPromptId,
        arn: routerPromptRes.aiPrompt.aiPromptArn as string,
        version: routerPromptVerRes.versionNumber?.toString(),
        baseName: config.agents.customerIntentRouter.name,
        deployedName: routerPromptRes.aiPrompt.name as string,
      });

      // Lost Card Prompt
      const lostCardPromptRes = await createAiPrompt(client, payloads.lostCardPromptPayload);
      if (!lostCardPromptRes.aiPrompt?.aiPromptId) {
        throw new Error("Failed to create Lost Card Prompt: Expected prompt identifier in SDK response.");
      }
      const lostCardPromptVerRes = await createAiPromptVersion(client, {
        assistantId: aws.assistantId,
        aiPromptId: lostCardPromptRes.aiPrompt.aiPromptId,
      });
      prompts.push({
        id: lostCardPromptRes.aiPrompt.aiPromptId,
        arn: lostCardPromptRes.aiPrompt.aiPromptArn as string,
        version: lostCardPromptVerRes.versionNumber?.toString(),
        baseName: config.agents.lostCard.name,
        deployedName: lostCardPromptRes.aiPrompt.name as string,
      });
    }

    // 2. Create Agents (if allowed by mode)
    if (
      aws.deploymentMode === "create_agents_only" ||
      aws.deploymentMode === "create_prompts_and_agents"
    ) {
      // Intent Router Agent
      if (payloads.customerIntentRouterAgentPayload.configuration?.orchestrationAIAgentConfiguration) {
        payloads.customerIntentRouterAgentPayload.configuration.orchestrationAIAgentConfiguration.orchestrationAIPromptId = 
          prompts.find(p => p.baseName === config.agents.customerIntentRouter.name)?.id || "";
      }
      const routerAgentRes = await createAiAgent(client, payloads.customerIntentRouterAgentPayload);
      if (!routerAgentRes.aiAgent?.aiAgentId) {
        throw new Error("Failed to create Customer Intent Router Agent: Expected agent identifier in SDK response.");
      }
      const routerAgentVerRes = await createAiAgentVersion(client, {
        assistantId: aws.assistantId,
        aiAgentId: routerAgentRes.aiAgent.aiAgentId,
      });
      agents.push({
        id: routerAgentRes.aiAgent.aiAgentId,
        arn: routerAgentRes.aiAgent.aiAgentArn as string,
        version: routerAgentVerRes.versionNumber?.toString(),
        baseName: config.agents.customerIntentRouter.name,
        deployedName: routerAgentRes.aiAgent.name as string,
      });

      // Lost Card Agent
      if (payloads.lostCardAgentPayload.configuration?.orchestrationAIAgentConfiguration) {
        payloads.lostCardAgentPayload.configuration.orchestrationAIAgentConfiguration.orchestrationAIPromptId = 
          prompts.find(p => p.baseName === config.agents.lostCard.name)?.id || "";
      }
      const lostCardAgentRes = await createAiAgent(client, payloads.lostCardAgentPayload);
      if (!lostCardAgentRes.aiAgent?.aiAgentId) {
        throw new Error("Failed to create Lost Card Agent: Expected agent identifier in SDK response.");
      }
      const lostCardAgentVerRes = await createAiAgentVersion(client, {
        assistantId: aws.assistantId,
        aiAgentId: lostCardAgentRes.aiAgent.aiAgentId,
      });
      agents.push({
        id: lostCardAgentRes.aiAgent.aiAgentId,
        arn: lostCardAgentRes.aiAgent.aiAgentArn as string,
        version: lostCardAgentVerRes.versionNumber?.toString(),
        baseName: config.agents.lostCard.name,
        deployedName: lostCardAgentRes.aiAgent.name as string,
      });
    }

    const manifest: DeploymentManifest = {
      deployedAt: new Date().toISOString(),
      region: aws.region,
      assistantId: aws.assistantId,
      visibilityStatus: aws.visibilityStatus,
      prompts,
      agents,
    };

    return { success: true, manifest };
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error occurred during deployment" };
  }
}
