import { NextRequest, NextResponse } from "next/server";
import { ConnectParticipantClient, SendMessageCommand } from "@aws-sdk/client-connectparticipant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      connectionToken: string;
      message: string;
      region: string;
    };
    const { connectionToken, message, region } = body;

    if (!connectionToken || !message || !region) {
      return NextResponse.json(
        { error: "Missing required fields: connectionToken, message, region" },
        { status: 400 }
      );
    }

    const client = new ConnectParticipantClient({ region });
    const command = new SendMessageCommand({
      ConnectionToken: connectionToken,
      ContentType: "text/plain",
      Content: message,
    });

    const res = await client.send(command);

    return NextResponse.json({
      success: true,
      messageId: res.Id,
      absoluteTime: res.AbsoluteTime,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
