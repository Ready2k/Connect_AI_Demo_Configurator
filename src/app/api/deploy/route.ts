import { NextResponse } from "next/server";
import { deployProject } from "@/lib/aws/deployService";
import { ProjectConfig } from "@/types/project";

export async function POST(request: Request) {
  let config: ProjectConfig | undefined;
  let timestamp: number | undefined;
  try {
    const body = await request.json();
    config = body.config;
    timestamp = body.timestamp;
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON." }, { status: 400 });
  }

  // Validation — return plain JSON errors before streaming begins
  if (!config || !config.aws || !config.aws.region || !config.aws.assistantId) {
    return NextResponse.json({ error: "Missing config, region, or assistantId." }, { status: 400 });
  }

  if (!config.aws.modelId || config.aws.modelId.trim() === "") {
    return NextResponse.json({
      success: false,
      error: "AI model ID is required for custom prompt deployment. Select a discovered model or enter a model ID manually."
    }, { status: 400 });
  }

  const enabledAgents = config.agents?.filter((a: { enabled: boolean }) => a.enabled) ?? [];
  if (enabledAgents.length === 0) {
    return NextResponse.json({ success: false, error: "No agents are selected for deployment. Enable at least one agent on the Agents page." }, { status: 400 });
  }

  // Stream deployment progress as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await deployProject(
          config!,
          timestamp ?? Date.now(),
          (event) => emit(event)
        );
        emit({ type: "done", success: result.success, error: result.error, manifest: result.manifest });
      } catch (e: any) {
        emit({ type: "done", success: false, error: e.message || "Unknown error" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
