import { NextRequest, NextResponse } from "next/server";
import { getQConnectClient, listAiAgents } from "@/lib/aws/qconnectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const assistantId = searchParams.get("assistantId");

    if (!region || !assistantId) {
      return NextResponse.json({ error: "Missing region or assistantId" }, { status: 400 });
    }

    const client = getQConnectClient(region);
    const agents: { name: string; arn: string; type: string }[] = [];
    let nextToken: string | undefined;

    do {
      const res = await listAiAgents(client, { assistantId, nextToken, maxResults: 100 });
      for (const a of res.aiAgentSummaries ?? []) {
        agents.push({
          name: a.name ?? "",
          arn: a.aiAgentArn ?? "",
          type: a.type ?? "",
        });
      }
      nextToken = res.nextToken;
    } while (nextToken);

    return NextResponse.json({ agents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list AI agents";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
