import { NextRequest, NextResponse } from "next/server";
import { ConnectParticipantClient, SendMessageCommand } from "@aws-sdk/client-connectparticipant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      connectionToken: string;
      digit: string;
      region: string;
    };
    const { connectionToken, digit, region } = body;

    if (!connectionToken || !digit || !region) {
      return NextResponse.json({ error: "Missing required fields: connectionToken, digit, region" }, { status: 400 });
    }

    // Server-side validation of digit
    if (!/^[0-9*#]$/.test(digit)) {
      return NextResponse.json({ error: "Invalid DTMF digit. Must be 0-9, *, or #" }, { status: 400 });
    }

    const client = new ConnectParticipantClient({ region });
    const command = new SendMessageCommand({
      ConnectionToken: connectionToken,
      ContentType: "audio/dtmf",
      Content: digit,
    });

    await client.send(command);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to send DTMF message";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
