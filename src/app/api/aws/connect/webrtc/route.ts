import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, startWebRTCContact } from "@/lib/aws/connectClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      contactFlowId: string;
      participantName: string;
      region: string;
      connectInstanceId: string;
    };
    const { contactFlowId, participantName, region, connectInstanceId } = body;

    if (!contactFlowId || !participantName || !region || !connectInstanceId) {
      return NextResponse.json({ error: "Missing required fields: contactFlowId, participantName, region, connectInstanceId" }, { status: 400 });
    }

    const client = getConnectClient(region);
    const res = await startWebRTCContact(client, {
      InstanceId: connectInstanceId,
      ContactFlowId: contactFlowId,
      ParticipantDetails: {
        DisplayName: participantName,
      },
    });

    return NextResponse.json({
      contactId: res.ContactId,
      participantToken: res.ParticipantToken,
      connectionData: res.ConnectionData,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to start WebRTC contact";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
