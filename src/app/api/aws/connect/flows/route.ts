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
  // Errors array: Compare blocks require NoMatchingCondition, not NoMatchingError
  if (Array.isArray(t.Errors) && blockType === "Compare") {
    t.Errors = (t.Errors as Record<string, unknown>[]).map((e) =>
      e.ErrorType === "NoMatchingError" ? { ...e, ErrorType: "NoMatchingCondition" } : e
    );
  }
  // NoMatchingCondition (Nova Pro format) → NextAction fallback
  if (typeof t.NoMatchingCondition === "string" && !t.NextAction) {
    t.NextAction = t.NoMatchingCondition;
  }
  delete t.NoMatchingCondition;
}

// TransferToFlow is rejected by the CreateContactFlow API regardless of parameters.
// TransferContactToQueue works when Parameters.QueueId is explicitly set.
const ALWAYS_UNSUPPORTED = new Set(["TransferToFlow"]);

function rewriteNextBlockId(obj: Record<string, unknown>): void {
  // Nova Pro variant 3: uses NextBlockId instead of NextAction throughout
  if (typeof obj.NextBlockId === "string" && !obj.NextAction) {
    obj.NextAction = obj.NextBlockId;
  }
  delete obj.NextBlockId;
  for (const arr of [obj.Errors, obj.Conditions] as unknown[]) {
    if (Array.isArray(arr)) {
      for (const item of arr as Record<string, unknown>[]) {
        if (typeof item.NextBlockId === "string" && !item.NextAction) {
          item.NextAction = item.NextBlockId;
        }
        delete item.NextBlockId;
      }
    }
  }
}

function normalizeBlocks(blocks: ActionObj[], startId: string | undefined): { actions: ActionObj[]; startAction: string } {
  blocks.forEach((b, i) => {
    // Variant 1/2 (Module format): BlockId → Identifier, BlockType → Type
    if (b.BlockId && !b.Identifier) { b.Identifier = b.BlockId; delete b.BlockId; }
    if (b.BlockType && !b.Type)     { b.Type = b.BlockType;     delete b.BlockType; }
    // Assign sequential identifier if still missing
    if (!b.Identifier) b.Identifier = padId(i + 1);

    // Variant 3: NextBlockId at block level → Transitions.NextAction
    if (typeof b.NextBlockId === "string") {
      if (!b.Transitions) b.Transitions = {};
      const t = b.Transitions as Record<string, unknown>;
      if (!t.NextAction) t.NextAction = b.NextBlockId;
      delete b.NextBlockId;
    }

    // Variant 3: NextBlockId inside Transitions/Errors/Conditions
    if (b.Transitions) rewriteNextBlockId(b.Transitions as Record<string, unknown>);

    // Variant 1/2: block-level Conditions → move into Transitions
    if (Array.isArray(b.Conditions) && b.Transitions) {
      const t = b.Transitions as Record<string, unknown>;
      if (!t.Conditions) t.Conditions = b.Conditions;
      delete b.Conditions;
    }

    // Variant 4: Transitions is a list of conditions (Compare block)
    // Convert [ {NextAction, Condition}, ... ] + DefaultTransition → proper dict
    if (Array.isArray(b.Transitions)) {
      const conditions = b.Transitions as ActionObj[];
      const dt = b.DefaultTransition as ActionObj | undefined;
      b.Transitions = {
        Conditions: conditions,
        NextAction: dt?.NextAction ?? conditions[0]?.NextAction,
        Errors: dt ? [{ NextAction: dt.NextAction, ErrorType: dt.ErrorType ?? "NoMatchingCondition" }] : [],
      };
    }
    // DefaultTransition as a sibling key (also variant 4)
    if (b.DefaultTransition && typeof b.Transitions === "object" && !Array.isArray(b.Transitions)) {
      const dt = b.DefaultTransition as ActionObj;
      const t = b.Transitions as Record<string, unknown>;
      if (!t.NextAction) t.NextAction = dt.NextAction;
      if (!t.Errors) t.Errors = [{ NextAction: dt.NextAction, ErrorType: dt.ErrorType ?? "NoMatchingCondition" }];
    }
    delete b.DefaultTransition;

    // Strip fields that Connect rejects or are metadata-only
    delete b.Name;
    delete b.EndFlow;
  });

  const start = startId ?? (blocks[0]?.Identifier as string | undefined) ?? padId(1);
  return { actions: blocks, startAction: start };
}

function normalizeFlowContent(flowJson: string): string {
  const parsed = JSON.parse(flowJson) as Record<string, unknown>;
  parsed.Version = "2019-10-30"; // Connect rejects anything other than this exact string

  // Strip Nova Pro metadata-only top-level fields
  for (const k of ["Description", "Metadata", "ContactFlowModules", "Prompts", "QuickConnects", "Endpoints", "StartActionId"]) {
    delete parsed[k];
  }

  // Variant 1: { ContactFlow: { Blocks: [...] } } wrapper
  const cf = parsed.ContactFlow as Record<string, unknown> | undefined;
  if (cf && Array.isArray(cf.Blocks)) {
    const { actions, startAction } = normalizeBlocks(cf.Blocks as ActionObj[], undefined);
    if (!parsed.StartAction) parsed.StartAction = startAction;
    parsed.Actions = actions;
    delete parsed.ContactFlow;
  }

  // Variant 2 & 3: top-level Blocks (with BlockType/BlockId OR NextBlockId format)
  if (Array.isArray(parsed.Blocks) && !Array.isArray(parsed.Actions)) {
    const rawStart = (parsed.StartBlockId ?? parsed.StartAction) as string | undefined;
    const { actions, startAction } = normalizeBlocks(parsed.Blocks as ActionObj[], rawStart);
    parsed.StartAction = startAction;
    parsed.Actions = actions;
    delete parsed.Blocks;
    delete parsed.StartBlockId;
  }

  // Variant 4: ContactFlowStates (Nova Pro latest)
  if (Array.isArray(parsed.ContactFlowStates) && !Array.isArray(parsed.Actions)) {
    const { actions, startAction } = normalizeBlocks(parsed.ContactFlowStates as ActionObj[], undefined);
    parsed.StartAction = startAction;
    parsed.Actions = actions;
    delete parsed.ContactFlowStates;
  }

  const actions = (parsed.Actions as ActionObj[] | undefined) ?? [];
  if (!parsed.StartAction && actions.length > 0) {
    parsed.StartAction = actions[0].Identifier;
  }

  // Repair self-referencing NextAction: UpdateContactTargetQueue should always lead
  // to a TransferContactToQueue block. If it points to itself, find the nearest TCQ block.
  const tcqId = actions.find((a) => a.Type === "TransferContactToQueue")?.Identifier as string | undefined;
  for (const action of actions) {
    if (action.Type === "UpdateContactTargetQueue") {
      const t = action.Transitions as Record<string, unknown> | undefined;
      if (t && t.NextAction === action.Identifier) {
        t.NextAction = tcqId ?? (actions.find((a) => a.Type === "DisconnectParticipant")?.Identifier);
      }
    }
  }

  for (const action of actions) {
    const t = action.Transitions as Record<string, unknown> | undefined;
    if (t) fixTransitions(t, action.Type as string | undefined);

    // TransferToFlow is always rejected — stub as Disconnect
    if (ALWAYS_UNSUPPORTED.has(action.Type as string)) {
      action.Type = "DisconnectParticipant";
      action.Parameters = {};
      action.Transitions = {};
    }

    // TransferContactToQueue: works ONLY when Parameters.QueueId is explicitly set
    if (action.Type === "TransferContactToQueue") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      if (!params?.QueueId) {
        action.Type = "DisconnectParticipant";
        action.Parameters = {};
        action.Transitions = {};
      }
      // Remove Errors from TransferContactToQueue — it's a terminal block
      const t2 = action.Transitions as Record<string, unknown> | undefined;
      if (t2) { delete t2.Errors; delete t2.NextAction; }
    }

    // UpdateFlowLoggingBehavior rejects any Errors array in its transitions
    if (action.Type === "UpdateFlowLoggingBehavior") {
      const t2 = action.Transitions as Record<string, unknown> | undefined;
      if (t2) delete t2.Errors;
    }

    // ConnectParticipantWithLexBot: stub as MessageParticipant (new flows use MessageParticipant directly)
    if (action.Type === "ConnectParticipantWithLexBot") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      action.Type = "MessageParticipant";
      action.Parameters = {
        Text: (params?.Text as string | undefined) ?? "Welcome. How can I help you today?",
        SkipWhenDTMFBufferEnabled: "false",
      };
    }

    // DisconnectParticipant: Connect requires Parameters: {} — never omit it
    if (action.Type === "DisconnectParticipant") {
      if (!action.Parameters) action.Parameters = {};
    }

    // UpdateContactAttributes: Connect requires TargetContact: "Current"
    if (action.Type === "UpdateContactAttributes") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      if (params && !params.TargetContact) {
        params.TargetContact = "Current";
      } else if (!params) {
        action.Parameters = { TargetContact: "Current" };
      }
    }
  }

  // Final guard: re-scan all Compare blocks and enforce NoMatchingCondition.
  // This catches any case where fixTransitions didn't fire (e.g. LLM already used the correct
  // block shape but with the wrong error type, bypassing earlier mutation paths).
  for (const action of actions) {
    if (action.Type !== "Compare") continue;
    const trans = action.Transitions as Record<string, unknown> | undefined;
    if (!trans || !Array.isArray(trans.Errors)) continue;
    trans.Errors = (trans.Errors as Record<string, unknown>[]).map((e) =>
      e.ErrorType === "NoMatchingError" ? { ...e, ErrorType: "NoMatchingCondition" } : e
    );
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
    } catch (normalizeErr: unknown) {
      const msg = normalizeErr instanceof Error ? normalizeErr.message : "Unknown normalisation error";
      const isJsonError = msg.toLowerCase().includes("json") || msg.toLowerCase().includes("unexpected token") || msg.toLowerCase().includes("parse");
      let parsedForDebug: unknown = null;
      try { parsedForDebug = JSON.parse(flowJson); } catch { /* not parseable */ }
      return NextResponse.json(
        {
          error: isJsonError ? "flowJson is not valid JSON" : `Flow structure error: ${msg}`,
          ...(parsedForDebug ? { sentContent: parsedForDebug } : {}),
        },
        { status: 400 }
      );
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
