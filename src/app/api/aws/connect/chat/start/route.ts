import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, startChatContact } from "@/lib/aws/connectClient";
import { ConnectParticipantClient, CreateParticipantConnectionCommand, SendEventCommand } from "@aws-sdk/client-connectparticipant";

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
      return NextResponse.json(
        { error: "Missing required fields: contactFlowId, participantName, region, connectInstanceId" },
        { status: 400 }
      );
    }

    const connectClient = getConnectClient(region);
    
    // 1. Start Chat Contact in Amazon Connect
    const chatContact = await startChatContact(connectClient, {
      InstanceId: connectInstanceId,
      ContactFlowId: contactFlowId,
      ParticipantDetails: {
        DisplayName: participantName,
      },
      SupportedMessagingContentTypes: [
        "text/plain", 
        "text/markdown", 
        "application/json", 
        "application/vnd.amazonaws.connect.message.interactive",
        "application/vnd.amazonaws.connect.message.interactive.response"
      ],
    });

    const participantToken = chatContact.ParticipantToken;
    if (!participantToken) {
      throw new Error("Failed to retrieve ParticipantToken from StartChatContact");
    }

    // 2. Establish Participant Connection immediately
    const participantClient = new ConnectParticipantClient({ region });
    const connectionCommand = new CreateParticipantConnectionCommand({
      Type: ["CONNECTION_CREDENTIALS"],
      ParticipantToken: participantToken,
    });

    const connectionRes = await participantClient.send(connectionCommand);
    const connectionToken = connectionRes.ConnectionCredentials?.ConnectionToken;

    if (!connectionToken) {
      throw new Error("Failed to retrieve ConnectionToken from CreateParticipantConnection");
    }

    // 3. Send Connection Acknowledged Event to unblock Contact Flow
    const ackCommand = new SendEventCommand({
      ConnectionToken: connectionToken,
      ContentType: "application/vnd.amazonaws.connect.event.connection.acknowledged",
    });
    await participantClient.send(ackCommand);

    return NextResponse.json({
      contactId: chatContact.ContactId,
      participantToken,
      connectionToken,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to start Chat contact";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
