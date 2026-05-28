import { NextResponse } from "next/server";
import { buildPayloads } from "@/lib/payloads/buildPayloads";
import { ProjectConfig } from "@/types/project";

export async function POST(request: Request) {
  try {
    const { config } = await request.json();
    if (!config) {
      return NextResponse.json({ error: "Missing config" }, { status: 400 });
    }
    const payloads = buildPayloads(config as ProjectConfig);
    return NextResponse.json(payloads);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
