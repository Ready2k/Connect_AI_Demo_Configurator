import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, listContactFlows } from "@/lib/aws/connectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    let nextToken: string | undefined;
    const flows: { id: string; name: string; type: string; description: string; status: string }[] = [];

    do {
      const res = await listContactFlows(client, {
        InstanceId: connectInstanceId,
        ContactFlowTypes: ["CONTACT_FLOW"],
        NextToken: nextToken,
        MaxResults: 100,
      });

      if (res.ContactFlowSummaryList) {
        for (const flow of res.ContactFlowSummaryList) {
          flows.push({
            id: flow.Id || "",
            name: flow.Name || "",
            type: flow.ContactFlowType || "",
            description: "",
            status: flow.ContactFlowStatus || "",
          });
        }
      }

      nextToken = res.NextToken;
    } while (nextToken);

    return NextResponse.json({ flows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list contact flows";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
