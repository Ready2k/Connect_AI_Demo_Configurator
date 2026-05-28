import { NextRequest, NextResponse } from "next/server";
import { verifyFlow } from "@/lib/flow/flowGenerator";
import type { JourneyConfig } from "@/types/experience";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      journeyConfig: JourneyConfig;
      flowJson: string;
      modelId: string;
      region: string;
    };
    const { journeyConfig, flowJson, modelId, region } = body;
    if (!journeyConfig || !flowJson || !modelId || !region) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const result = await verifyFlow({ journeyConfig, flowJson, modelId, region });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to verify flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
