import { NextRequest, NextResponse } from "next/server";
import { ConnectParticipantClient, CreateParticipantConnectionCommand } from "@aws-sdk/client-connectparticipant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      participantToken: string;
      region: string;
    };
    const { participantToken, region } = body;

    if (!participantToken || !region) {
      return NextResponse.json({ error: "Missing required fields: participantToken, region" }, { status: 400 });
    }

    const client = new ConnectParticipantClient({ region });
    const command = new CreateParticipantConnectionCommand({
      Type: ["CONNECTION_CREDENTIALS"],
      ParticipantToken: participantToken,
    });

    const res = await client.send(command);

    return NextResponse.json({
      connectionToken: res.ConnectionCredentials?.ConnectionToken,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create participant connection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
