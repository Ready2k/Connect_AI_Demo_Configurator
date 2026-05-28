import { NextRequest, NextResponse } from "next/server";
import { getQConnectClient } from "@/lib/aws/qconnectClient";
import { ListModelsCommand } from "@aws-sdk/client-qconnect";
import { z } from "zod";

const modelQuerySchema = z.object({
  region: z.string().min(1),
  assistantId: z.string().min(1),
  promptType: z.string().default("ORCHESTRATION")
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const assistantId = searchParams.get("assistantId");
  const promptType = searchParams.get("promptType") || "ORCHESTRATION";

  try {
    const parsed = modelQuerySchema.parse({ region, assistantId, promptType });
    
    const client = getQConnectClient(parsed.region);
    const command = new ListModelsCommand({
      assistantId: parsed.assistantId,
      aiPromptType: parsed.promptType as any
    });

    const response = await client.send(command);
    
    const models = (response.models || []).map(m => ({
      modelId: m.modelId,
      displayName: m.displayName
    })).filter(m => m.modelId); // filter out if missing id

    if (models.length === 0) {
      return NextResponse.json({
        models: [],
        warning: "No models found for this assistant that support the specified prompt type."
      });
    }

    return NextResponse.json({ models });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid parameters", details: error.errors }, { status: 400 });
    }
    // Return clear AWS error messages without mapping it to an empty models list.
    return NextResponse.json({ error: error.message || "Failed to list models" }, { status: 500 });
  }
}
