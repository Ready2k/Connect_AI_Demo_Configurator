import { NextRequest, NextResponse } from "next/server";
import { ConnectParticipantClient, GetTranscriptCommand } from "@aws-sdk/client-connectparticipant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      connectionToken: string;
      region: string;
      nextToken?: string;
    };
    const { connectionToken, region, nextToken } = body;

    if (!connectionToken || !region) {
      return NextResponse.json(
        { error: "Missing required fields: connectionToken, region" },
        { status: 400 }
      );
    }

    const client = new ConnectParticipantClient({ region });
    const input: any = {
      ConnectionToken: connectionToken,
      MaxResults: 100,
      ScanDirection: "BACKWARD",
      SortOrder: "DESCENDING",
    };
    if (nextToken) {
      input.NextToken = nextToken;
    }
    
    const command = new GetTranscriptCommand(input);

    const res = await client.send(command);

    // Clean and filter the transcript items to return only necessary details
    const rawTranscript = res.Transcript || [];
    console.log("Raw AWS Transcript:", JSON.stringify(rawTranscript, null, 2));
    const formattedTranscript = [...rawTranscript].reverse().map((item) => ({
      id: item.Id,
      type: item.Type,
      participantRole: item.ParticipantRole, // CUSTOMER, AGENT, SYSTEM
      displayName: item.DisplayName,
      content: item.Content,
      contentType: item.ContentType,
      absoluteTime: item.AbsoluteTime,
    }));

    return NextResponse.json({
      transcript: formattedTranscript,
      nextToken: res.NextToken,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to retrieve transcript";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
