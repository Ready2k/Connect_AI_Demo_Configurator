import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, listLexV2Bots } from "@/lib/aws/connectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    const bots: { aliasArn: string; label: string }[] = [];
    let nextToken: string | undefined;

    do {
      const res = await listLexV2Bots(client, {
        InstanceId: connectInstanceId,
        LexVersion: "V2",
        NextToken: nextToken,
        MaxResults: 100,
      });
      for (const entry of res.LexBots ?? []) {
        const aliasArn = entry.LexV2Bot?.AliasArn;
        if (aliasArn) {
          // Derive a human-readable label from the ARN segments
          const parts = aliasArn.split(":");
          const resource = parts[parts.length - 1] ?? aliasArn;
          bots.push({ aliasArn, label: resource });
        }
      }
      nextToken = res.NextToken;
    } while (nextToken);

    return NextResponse.json({ bots });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list Lex bots";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
