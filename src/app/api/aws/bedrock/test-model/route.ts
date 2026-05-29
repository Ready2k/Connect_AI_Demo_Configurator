import { NextRequest, NextResponse } from "next/server";
import { getBedrockClient, converseWithModel } from "@/lib/aws/bedrockClient";

export async function POST(req: NextRequest) {
  try {
    const { modelId, region } = await req.json() as { modelId: string; region: string };

    if (!modelId?.trim() || !region?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing modelId or region" }, { status: 400 });
    }

    const client = getBedrockClient(region.trim());
    await converseWithModel(
      client,
      modelId.trim(),
      [{ role: "user", content: [{ text: "Reply with the single word OK." }] }],
      "You are a test assistant."
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bedrock call failed";
    return NextResponse.json({ ok: false, error: msg });
  }
}
