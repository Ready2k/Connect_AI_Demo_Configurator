import { NextRequest } from "next/server";
import { getBedrockClient, converseStreamWithModel, ConverseMessage } from "@/lib/aws/bedrockClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, region, messages, systemPrompt } = body as {
      modelId: string;
      region: string;
      messages: ConverseMessage[];
      systemPrompt: string;
    };

    if (!modelId?.trim() || !region?.trim() || !messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const client = getBedrockClient(region.trim());

    // Create a ReadableStream to stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const asyncIterable = converseStreamWithModel(
            client,
            modelId.trim(),
            messages,
            systemPrompt || ""
          );

          for await (const chunk of asyncIterable) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        } catch (err: any) {
          console.error("Bedrock Chat Error:", err);
          // If we haven't sent any chunks, we can send an error string, 
          // but typically once started, it's better to just close or enqueue error text.
          controller.enqueue(new TextEncoder().encode(`\n[Error: ${err.message}]`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to start chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
