import { NextRequest, NextResponse } from "next/server";
import { generateFlow } from "@/lib/flow/flowGenerator";
import type { AgentContext } from "@/lib/flow/flowGenerator";
import type { JourneyConfig } from "@/types/experience";
import type { BlockSchemaLibrary } from "@/types/flowSchema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      journeyConfig: JourneyConfig;
      library: BlockSchemaLibrary;
      modelId: string;
      region: string;
      agentContext?: AgentContext;
      verificationFeedback?: { issues: unknown[]; suggestions: unknown[]; previousFlowJson: string };
    };
    const { journeyConfig, library, modelId, region, agentContext, verificationFeedback } = body;
    if (!journeyConfig || !library || !modelId || !region) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const result = await generateFlow({ journeyConfig, library, modelId, region, agentContext, verificationFeedback });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
