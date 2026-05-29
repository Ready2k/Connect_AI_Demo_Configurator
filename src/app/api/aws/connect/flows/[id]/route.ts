import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, describeContactFlow, deleteContactFlow } from "@/lib/aws/connectClient";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    const res = await describeContactFlow(client, {
      InstanceId: connectInstanceId,
      ContactFlowId: id,
    });

    if (!res.ContactFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({
      flow: {
        id: res.ContactFlow.Id || "",
        name: res.ContactFlow.Name || "",
        type: res.ContactFlow.Type || "",
        content: res.ContactFlow.Content || "",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to describe contact flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const connectInstanceId = searchParams.get("connectInstanceId");

    if (!region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing region or connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    await deleteContactFlow(client, {
      InstanceId: connectInstanceId,
      ContactFlowId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete contact flow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
