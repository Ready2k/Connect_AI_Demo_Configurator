import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message as BedrockMessage,
  SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

export type ConverseMessage = BedrockMessage;

export function getBedrockClient(region: string) {
  return new BedrockRuntimeClient({ region });
}

export async function converseWithModel(
  client: BedrockRuntimeClient,
  modelId: string,
  messages: ConverseMessage[],
  systemPrompt: string
): Promise<string> {
  const system: SystemContentBlock[] = [{ text: systemPrompt }];
  const command = new ConverseCommand({ modelId, messages, system });
  const response = await client.send(command);
  const content = response.output?.message?.content;
  if (!content || content.length === 0) return "";
  const first = content[0];
  if ("text" in first && typeof first.text === "string") return first.text;
  return "";
}

export async function* converseStreamWithModel(
  client: BedrockRuntimeClient,
  modelId: string,
  messages: ConverseMessage[],
  systemPrompt: string
): AsyncIterable<string> {
  const system: SystemContentBlock[] = [{ text: systemPrompt }];
  const command = new ConverseStreamCommand({ modelId, messages, system });
  const response = await client.send(command);
  if (!response.stream) return;
  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      yield event.contentBlockDelta.delta.text;
    }
  }
}
