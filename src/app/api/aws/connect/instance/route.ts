import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, describeInstance } from "@/lib/aws/connectClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    const res = await describeInstance(client, {
      InstanceId: connectInstanceId,
    });

    if (!res.Instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const instanceAlias = res.Instance.InstanceAlias || "";
    const instanceUrl = instanceAlias ? `https://${instanceAlias}.my.connect.aws` : "";

    return NextResponse.json({ instanceAlias, instanceUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to describe instance";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
