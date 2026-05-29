import {
  ConnectClient,
  ListContactFlowsCommand,
  ListContactFlowsCommandInput,
  DescribeContactFlowCommand,
  DescribeContactFlowCommandInput,
  DescribeInstanceCommand,
  DescribeInstanceCommandInput,
  ListQueuesCommand,
  ListQueuesCommandInput,
  ListPhoneNumbersCommand,
  ListPhoneNumbersCommandInput,
  ListPhoneNumbersV2Command,
  ListPhoneNumbersV2CommandInput,
  StartWebRTCContactCommand,
  StartWebRTCContactCommandInput,
  StartChatContactCommand,
  StartChatContactCommandInput,
  CreateContactFlowCommand,
  CreateContactFlowCommandInput,
  UpdateContactFlowContentCommand,
  UpdateContactFlowContentCommandInput,
  ListBotsCommand,
  ListBotsCommandInput,
} from "@aws-sdk/client-connect";

export function getConnectClient(region: string) {
  return new ConnectClient({ region });
}

export async function listContactFlows(client: ConnectClient, input: ListContactFlowsCommandInput) {
  const command = new ListContactFlowsCommand(input);
  return await client.send(command);
}

export async function describeContactFlow(client: ConnectClient, input: DescribeContactFlowCommandInput) {
  const command = new DescribeContactFlowCommand(input);
  return await client.send(command);
}

export async function describeInstance(client: ConnectClient, input: DescribeInstanceCommandInput) {
  const command = new DescribeInstanceCommand(input);
  return await client.send(command);
}

export async function listQueues(client: ConnectClient, input: ListQueuesCommandInput) {
  const command = new ListQueuesCommand(input);
  return await client.send(command);
}

export async function listPhoneNumbers(client: ConnectClient, input: ListPhoneNumbersCommandInput) {
  const command = new ListPhoneNumbersCommand(input);
  return await client.send(command);
}

export async function listPhoneNumbersV2(client: ConnectClient, input: ListPhoneNumbersV2CommandInput) {
  const command = new ListPhoneNumbersV2Command(input);
  return await client.send(command);
}

export async function startWebRTCContact(client: ConnectClient, input: StartWebRTCContactCommandInput) {
  const command = new StartWebRTCContactCommand(input);
  return await client.send(command);
}

export async function startChatContact(client: ConnectClient, input: StartChatContactCommandInput) {
  const command = new StartChatContactCommand(input);
  return await client.send(command);
}

export async function createContactFlow(client: ConnectClient, input: CreateContactFlowCommandInput) {
  const command = new CreateContactFlowCommand(input);
  return await client.send(command);
}

export async function updateContactFlowContent(client: ConnectClient, input: UpdateContactFlowContentCommandInput) {
  const command = new UpdateContactFlowContentCommand(input);
  return await client.send(command);
}

export async function listLexV2Bots(client: ConnectClient, input: ListBotsCommandInput) {
  const command = new ListBotsCommand(input);
  return await client.send(command);
}
