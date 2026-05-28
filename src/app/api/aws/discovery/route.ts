import { NextRequest, NextResponse } from "next/server";
import { ConnectClient, ListInstancesCommand } from "@aws-sdk/client-connect";
import { QConnectClient, ListAssistantsCommand } from "@aws-sdk/client-qconnect";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");

  if (!region) {
    return NextResponse.json({ error: "Region is required" }, { status: 400 });
  }

  try {
    const connectClient = new ConnectClient({ region });
    const qConnectClient = new QConnectClient({ region });

    // Fetch Connect Instances
    const instancesRes = await connectClient.send(new ListInstancesCommand({}));
    const instances = instancesRes.InstanceSummaryList || [];

    // Fetch Q Connect Assistants
    let nextToken: string | undefined;
    let allAssistants: any[] = [];
    do {
      const assistantsRes = await qConnectClient.send(new ListAssistantsCommand({ nextToken }));
      if (assistantsRes.assistantSummaries) {
        allAssistants = allAssistants.concat(assistantsRes.assistantSummaries);
      }
      nextToken = assistantsRes.nextToken;
    } while (nextToken);

    // Attempt to enrich assistants with instance info by matching names (rough heuristic)
    const assistants = allAssistants.map(ast => {
      const matchedInstance = instances.find(inst => inst.InstanceAlias === ast.name || ast.name?.includes(inst.InstanceAlias || ""));
      return {
        ...ast,
        relatedInstanceAlias: matchedInstance?.InstanceAlias || null,
        relatedInstanceId: matchedInstance?.Id || null
      };
    });

    return NextResponse.json({ instances, assistants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch AWS discovery data" }, { status: 500 });
  }
}
