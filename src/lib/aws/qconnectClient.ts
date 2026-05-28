import {
  QConnectClient,
  CreateAIPromptCommand,
  CreateAIPromptCommandInput,
  CreateAIAgentCommand,
  CreateAIAgentCommandInput,
  CreateAIPromptVersionCommand,
  CreateAIPromptVersionCommandInput,
  CreateAIAgentVersionCommand,
  CreateAIAgentVersionCommandInput,
  GetAIPromptCommand,
  GetAIPromptCommandInput,
  DeleteAIPromptCommand,
  DeleteAIPromptCommandInput,
  ListAIPromptsCommand,
  ListAIPromptsCommandInput,
  ListAIAgentsCommand,
  ListAIAgentsCommandInput,
} from "@aws-sdk/client-qconnect";

export function getQConnectClient(region: string) {
  return new QConnectClient({ region });
}

export async function createAiPrompt(client: QConnectClient, input: CreateAIPromptCommandInput) {
  const command = new CreateAIPromptCommand(input);
  return await client.send(command);
}

export async function createAiPromptVersion(client: QConnectClient, input: CreateAIPromptVersionCommandInput) {
  const command = new CreateAIPromptVersionCommand(input);
  return await client.send(command);
}

export async function createAiAgent(client: QConnectClient, input: CreateAIAgentCommandInput) {
  const command = new CreateAIAgentCommand(input);
  return await client.send(command);
}

export async function createAiAgentVersion(client: QConnectClient, input: CreateAIAgentVersionCommandInput) {
  const command = new CreateAIAgentVersionCommand(input);
  return await client.send(command);
}

export async function getAiPrompt(client: QConnectClient, input: GetAIPromptCommandInput) {
  const command = new GetAIPromptCommand(input);
  return await client.send(command);
}

export async function deleteAiPrompt(client: QConnectClient, input: DeleteAIPromptCommandInput) {
  const command = new DeleteAIPromptCommand(input);
  return await client.send(command);
}

export async function listAiPrompts(client: QConnectClient, input: ListAIPromptsCommandInput) {
  const command = new ListAIPromptsCommand(input);
  return await client.send(command);
}

export async function listAiAgents(client: QConnectClient, input: ListAIAgentsCommandInput) {
  const command = new ListAIAgentsCommand(input);
  return await client.send(command);
}
