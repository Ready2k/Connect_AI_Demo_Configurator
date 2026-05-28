import { NextRequest, NextResponse } from "next/server";
import { getConnectClient, listContactFlows, createContactFlow, updateContactFlowContent } from "@/lib/aws/connectClient";
import { ContactFlowType } from "@aws-sdk/client-connect";

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

function padId(n: number): string {
  return `b0000001-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

type ActionObj = Record<string, unknown>;

function fixTransitions(t: Record<string, unknown>, blockType?: string): void {
  const defaultErrorType = blockType === "Compare" ? "NoMatchingCondition" : "NoMatchingError";

  // Errors: "idString" → [{ NextAction, ErrorType }]
  if (typeof t.Errors === "string") {
    t.Errors = [{ NextAction: t.Errors, ErrorType: defaultErrorType }];
  }
  // Errors array: fix incorrect ErrorType on Compare blocks
  if (Array.isArray(t.Errors) && blockType === "Compare") {
    for (const e of t.Errors as Record<string, unknown>[]) {
      if (e.ErrorType === "NoMatchingError") e.ErrorType = "NoMatchingCondition";
    }
  }
  // NoMatchingCondition (Nova Pro format) → NextAction fallback
  if (typeof t.NoMatchingCondition === "string" && !t.NextAction) {
    t.NextAction = t.NoMatchingCondition;
  }
  delete t.NoMatchingCondition;
}

// Blocks that the Connect API does not accept via CreateContactFlow/UpdateContactFlowContent.
// Replace with DisconnectParticipant to keep a valid stub the user can fix in the console.
const UNSUPPORTED_VIA_API = new Set(["TransferToFlow", "TransferContactToQueue"]);

function normalizeBlocks(blocks: ActionObj[], startId: string | undefined): { actions: ActionObj[]; startAction: string } {
  blocks.forEach((b, i) => {
    // Module format: BlockId → Identifier, BlockType → Type
    if (b.BlockId && !b.Identifier) { b.Identifier = b.BlockId; delete b.BlockId; }
    if (b.BlockType && !b.Type)     { b.Type = b.BlockType;     delete b.BlockType; }
    if (!b.Identifier) b.Identifier = padId(i + 1);

    // Module format: block-level Conditions → move into Transitions
    if (Array.isArray(b.Conditions) && b.Transitions) {
      const t = b.Transitions as Record<string, unknown>;
      if (!t.Conditions) t.Conditions = b.Conditions;
      delete b.Conditions;
    }
  });
  const start = startId ?? (blocks[0]?.Identifier as string | undefined) ?? padId(1);
  return { actions: blocks, startAction: start };
}

function normalizeFlowContent(flowJson: string): string {
  const parsed = JSON.parse(flowJson) as Record<string, unknown>;
  parsed.Version = "2019-10-30"; // Connect rejects anything other than this exact string

  // Variant 1: { ContactFlow: { Blocks: [...] } } wrapper (Nova Pro first-gen)
  const cf = parsed.ContactFlow as Record<string, unknown> | undefined;
  if (cf && Array.isArray(cf.Blocks)) {
    const { actions, startAction } = normalizeBlocks(cf.Blocks as ActionObj[], undefined);
    if (!parsed.StartAction) parsed.StartAction = startAction;
    parsed.Actions = actions;
    delete parsed.ContactFlow;
  }

  // Variant 2: top-level Blocks with BlockType/BlockId (Module format)
  if (Array.isArray(parsed.Blocks) && !Array.isArray(parsed.Actions)) {
    const rawStart = (parsed.StartBlockId ?? parsed.StartAction) as string | undefined;
    const { actions, startAction } = normalizeBlocks(parsed.Blocks as ActionObj[], rawStart);
    parsed.StartAction = startAction;
    parsed.Actions = actions;
    delete parsed.Blocks;
    delete parsed.StartBlockId;
  }

  // Ensure StartAction is set
  const actions = (parsed.Actions as ActionObj[] | undefined) ?? [];
  if (!parsed.StartAction && actions.length > 0) {
    parsed.StartAction = actions[0].Identifier;
  }

  // Fix transitions and replace unsupported block types
  for (const action of actions) {
    delete action.Name; // Remove Name — not standard in Connect API format

    const t = action.Transitions as Record<string, unknown> | undefined;
    if (t) fixTransitions(t, action.Type as string | undefined);

    // TransferToFlow / TransferContactToQueue are rejected by the CreateContactFlow API.
    // Stub them as DisconnectParticipant — user can fix in Connect console.
    if (UNSUPPORTED_VIA_API.has(action.Type as string)) {
      action.Type = "DisconnectParticipant";
      action.Parameters = {};
      action.Transitions = {};
    }

    // UpdateFlowLoggingBehavior rejects any Errors array in its transitions.
    if (action.Type === "UpdateFlowLoggingBehavior") {
      const t2 = action.Transitions as Record<string, unknown> | undefined;
      if (t2) delete t2.Errors;
    }

    // ConnectParticipantWithLexBot: an empty AliasArn causes InvalidContactFlowException.
    // Replace with a stub MessageParticipant until the user provides the real Lex bot ARN.
    if (action.Type === "ConnectParticipantWithLexBot") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      const lex = params?.LexV2Bot as Record<string, unknown> | undefined;
      if (!lex?.AliasArn || lex.AliasArn === "") {
        action.Type = "MessageParticipant";
        action.Parameters = {
          Text: (params?.Text as string | undefined) ?? "Welcome. How can I help you today?",
          SkipWhenDTMFBufferEnabled: "false",
        };
      }
    }
  }

  return JSON.stringify(parsed);
}

export async function POST(req: NextRequest) {
  try {
    const { region, connectInstanceId, name, flowJson } = await req.json() as {
      region: string;
      connectInstanceId: string;
      name: string;
      flowJson: string;
    };

    if (!region || !connectInstanceId || !name || !flowJson) {
      return NextResponse.json({ error: "Missing required fields: region, connectInstanceId, name, flowJson" }, { status: 400 });
    }

    let content: string;
    try {
      content = normalizeFlowContent(flowJson);
    } catch {
      return NextResponse.json({ error: "flowJson is not valid JSON" }, { status: 400 });
    }

    const client = getConnectClient(region);

    // Check for an existing flow with the same name
    let nextToken: string | undefined;
    let existingFlowId: string | undefined;
    do {
      const res = await listContactFlows(client, {
        InstanceId: connectInstanceId,
        ContactFlowTypes: ["CONTACT_FLOW"],
        NextToken: nextToken,
        MaxResults: 100,
      });
      const match = res.ContactFlowSummaryList?.find((f) => f.Name === name);
      if (match) {
        existingFlowId = match.Id;
        break;
      }
      nextToken = res.NextToken;
    } while (nextToken);

    if (existingFlowId) {
      try {
        await updateContactFlowContent(client, {
          InstanceId: connectInstanceId,
          ContactFlowId: existingFlowId,
          Content: content,
        });
      } catch (error: unknown) {
        const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
        const detail = [awsError.name, awsError.message].filter(Boolean).join(": ");
        return NextResponse.json(
          { error: detail || "Failed to update contact flow", sentContent: JSON.parse(content) },
          { status: awsError.$metadata?.httpStatusCode ?? 500 }
        );
      }
      return NextResponse.json({ flowId: existingFlowId, updated: true });
    }

    let created;
    try {
      created = await createContactFlow(client, {
        InstanceId: connectInstanceId,
        Name: name,
        Type: ContactFlowType.CONTACT_FLOW,
        Content: content,
      });
    } catch (error: unknown) {
      const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
      const detail = [awsError.name, awsError.message].filter(Boolean).join(": ");
      return NextResponse.json(
        { error: detail || "Failed to create contact flow", sentContent: JSON.parse(content) },
        { status: awsError.$metadata?.httpStatusCode ?? 500 }
      );
    }

    return NextResponse.json({
      flowId: created.ContactFlowId,
      flowArn: created.ContactFlowArn,
      updated: false,
    });
  } catch (error: unknown) {
    const awsError = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const detail = [awsError.name, awsError.message].filter(Boolean).join(": ");
    const status = awsError.$metadata?.httpStatusCode ?? 500;
    return NextResponse.json({ error: detail || "Failed to publish contact flow" }, { status });
  }
}
