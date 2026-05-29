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
      delete action.Transitions;
    }

    // TransferContactToQueue: Connect requires Transitions for NextAction, QueueAtCapacity, and NoMatchingError
    if (action.Type === "TransferContactToQueue") {
      action.Parameters = {}; // Strip parameters, Connect relies on UpdateContactTargetQueue

      const disconnectAction = actions.find((a) => a.Type === "DisconnectParticipant");
      const fallbackActionId = disconnectAction?.Identifier ?? action.Identifier;

      const t = (action.Transitions || {}) as Record<string, unknown>;
      const nextAction = t.NextAction ?? fallbackActionId;

      let queueAtCapacityAction = fallbackActionId;
      let noMatchingErrorAction = fallbackActionId;

      if (Array.isArray(t.Errors)) {
        const queueErr = t.Errors.find((e: any) => e.ErrorType === "QueueAtCapacity");
        if (queueErr?.NextAction) queueAtCapacityAction = queueErr.NextAction;
        
        const noMatchErr = t.Errors.find((e: any) => e.ErrorType === "NoMatchingError");
        if (noMatchErr?.NextAction) noMatchingErrorAction = noMatchErr.NextAction;
      }

      action.Transitions = {
        NextAction: nextAction,
        Errors: [
          { NextAction: queueAtCapacityAction, ErrorType: "QueueAtCapacity" },
          { NextAction: noMatchingErrorAction, ErrorType: "NoMatchingError" }
        ]
      };
    }

    // DisconnectParticipant: Connect requires no Transitions block at all
    if (action.Type === "DisconnectParticipant") {
      if (!action.Parameters) action.Parameters = {};
      delete action.Transitions;
    }

    // UpdateFlowLoggingBehavior rejects any Errors array in its transitions
    if (action.Type === "UpdateFlowLoggingBehavior") {
      const t2 = action.Transitions as Record<string, unknown> | undefined;
      if (t2) delete t2.Errors;
    }

    // UpdateContactTargetQueue: Connect rejects QueueAtCapacity, it only takes NoMatchingError
    if (action.Type === "UpdateContactTargetQueue") {
      const t = action.Transitions as Record<string, unknown> | undefined;
      if (t && Array.isArray(t.Errors)) {
        t.Errors = t.Errors.filter((e: any) => e.ErrorType !== "QueueAtCapacity");
      }
    }

    // CreateWisdomSession: Allow OrchestrationAIAgentConfiguration to pass through (do not strip)
    if (action.Type === "CreateWisdomSession") {
      // Intentionally preserving all AI agent configurations if present
    }

    // UpdateContactAttributes: remove wisdomSessionArn if its value is a dynamic reference —
    // $.Wisdom.SessionArn is not valid as a static attribute value and causes InvalidContactFlowException
    if (action.Type === "UpdateContactAttributes") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      const attrs = params?.Attributes as Record<string, unknown> | undefined;
      if (attrs) {
        if (attrs.wisdomSessionArn === "$.Wisdom.SessionArn") {
          delete attrs.wisdomSessionArn;
        }
        // Connect API rejects empty Attributes object
        if (Object.keys(attrs).length === 0) {
          attrs["_connect_builder_fix"] = "true";
        }
      }
    }

    // ConnectParticipantWithLexBot: Connect rejects SessionState (even as {}) — remove it if present
    if (action.Type === "ConnectParticipantWithLexBot") {
      const params = (action.Parameters ?? {}) as Record<string, unknown>;
      delete params.SessionState;
      action.Parameters = params;
      // Not terminal — must have NextAction in Transitions
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

    // Fix hallucinated GetUserInput or GetParticipantInput (when used for Lex) to ConnectParticipantWithLexBot
    if (action.Type === "GetUserInput" || action.Type === "GetParticipantInput") {
      const p = action.Parameters as Record<string, unknown> | undefined;
      if (p && p.LexV2Bot) {
        action.Type = "ConnectParticipantWithLexBot";
      } else if (action.Type === "GetUserInput") {
        action.Type = "GetParticipantInput";
      }
    }

    // DO NOT wrap 'Text' in 'Media'. Connect API expects 'Text' directly for TTS/Chat messages.
    if (action.Type === "MessageParticipant" || action.Type === "GetParticipantInput" || action.Type === "ConnectParticipantWithLexBot") {
      const params = action.Parameters as Record<string, unknown> | undefined;
      // If it accidentally got wrapped in Media due to earlier logic or UI export, unwrap it
      if (params && params.Media && typeof params.Media === "object") {
        const media = params.Media as Record<string, unknown>;
        if (typeof media.Text === "string" && !media.Uri) {
          params.Text = media.Text;
          delete params.Media;
        }
      }

      // If the LLM hallucinates LexInitializationData.InitialMessage as an object, flatten it
      if (params && params.LexInitializationData && typeof params.LexInitializationData === "object") {
        const lexData = params.LexInitializationData as Record<string, unknown>;
        if (lexData.InitialMessage && typeof lexData.InitialMessage === "object") {
          const initMsgObj = lexData.InitialMessage as Record<string, unknown>;
          if (typeof initMsgObj.Text === "string") {
            lexData.InitialMessage = initMsgObj.Text;
          }
        }
      }
    }
  }

  // Final guard: enforce strict ErrorType rules for all blocks to satisfy Connect API.
  for (const action of actions) {
    if (action.Type === "UpdateFlowLoggingBehavior" || action.Type === "DisconnectParticipant") {
      const trans = action.Transitions as Record<string, unknown> | undefined;
      if (trans) delete trans.Errors;
      continue;
    }

    const trans = action.Transitions as Record<string, unknown> | undefined;
    if (!trans) continue;
    if (!Array.isArray(trans.Errors)) trans.Errors = [];
    
    // 1. Enforce correct default error type
    trans.Errors = (trans.Errors as Record<string, unknown>[]).map((e) => {
      if (action.Type === "Compare" && e.ErrorType === "NoMatchingError") {
        return { ...e, ErrorType: "NoMatchingCondition" };
      }
      if (action.Type !== "Compare" && action.Type !== "ConnectParticipantWithLexBot" && e.ErrorType === "NoMatchingCondition") {
        return { ...e, ErrorType: "NoMatchingError" };
      }
      return e;
    });

    // 2. Deduplicate error types (Connect rejects multiple branches with the same ErrorType)
    const seenErrors = new Set<string>();
    trans.Errors = (trans.Errors as Record<string, unknown>[]).filter((e) => {
      const errType = e.ErrorType as string;
      if (seenErrors.has(errType)) return false;
      seenErrors.add(errType);
      return true;
    });

    // 3. Ensure Compare block has NoMatchingCondition
    if (action.Type === "Compare" && !seenErrors.has("NoMatchingCondition")) {
      (trans.Errors as Record<string, unknown>[]).push({
        NextAction: trans.NextAction ?? action.Identifier,
        ErrorType: "NoMatchingCondition"
      });
    }

    // 4. Ensure Lex Bot block has NoMatchingCondition ONLY if it has conditions, and NoMatchingError
    // 4. Ensure Lex Bot block has NoMatchingCondition and NoMatchingError
    if (action.Type === "ConnectParticipantWithLexBot") {
      const errTarget = Array.isArray(trans.Errors) && trans.Errors.length > 0 
        ? (trans.Errors[0] as Record<string, unknown>).NextAction 
        : (trans.NextAction ?? action.Identifier);
        
      if (!seenErrors.has("NoMatchingCondition")) {
        (trans.Errors as Record<string, unknown>[]).push({
          NextAction: errTarget,
          ErrorType: "NoMatchingCondition"
        });
      }
      if (!seenErrors.has("NoMatchingError")) {
        (trans.Errors as Record<string, unknown>[]).push({
          NextAction: errTarget,
          ErrorType: "NoMatchingError"
        });
      }
    }
  }

  // Inject Metadata. Connect UI imports auto-generate this, but Connect API requires it
  // or it will throw an InvalidContactFlowException: UnknownError.
  const VOICE_LANG_MAP: Record<string, string> = {
    Joanna: "en-US",
    Amy: "en-GB",
    Olivia: "en-AU",
    Lupe: "es-US",
    Chantal: "fr-CA"
  };

  const actionMetadata: Record<string, any> = {};
  actions.forEach((action, index) => {
    if (action.Identifier) {
      actionMetadata[action.Identifier as string] = {
        position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 150 },
      };
      
      // Ensure languageCode metadata is present so the Connect UI parses it correctly
      if (action.Type === "UpdateContactTextToSpeechVoice") {
        const params = action.Parameters as Record<string, unknown> | undefined;
        const voice = params?.TextToSpeechVoice as string | undefined;
        if (voice) {
          actionMetadata[action.Identifier as string].parameters = {
            TextToSpeechVoice: {
              languageCode: VOICE_LANG_MAP[voice] || "en-US"
            }
          };
        }
      }

      if (action.Type === "ConnectParticipantWithLexBot") {
        actionMetadata[action.Identifier as string].parameters = {
          LexV2Bot: {
            AliasArn: {}
          }
        };
        actionMetadata[action.Identifier as string].lexV2BotName = "";
        actionMetadata[action.Identifier as string].conditionMetadata = [];
      }

      if (action.Type === "Compare") {
        const trans2 = action.Transitions as Record<string, unknown> | undefined;
        const conditions = (trans2?.Conditions as Record<string, unknown>[] | undefined) ?? [];
        const condMetadata = conditions.map((c, i) => {
          const operandValue = (c.Condition as any)?.Operands?.[0] as string || "";
          return {
            id: `cond-id-${i}`,
            operator: {
              name: "Equals",
              value: "Equals",
              shortDisplay: "="
            },
            value: operandValue
          };
        });
        actionMetadata[action.Identifier as string].conditions = [];
        actionMetadata[action.Identifier as string].conditionMetadata = condMetadata;
      }
    }
  });

  parsed.Metadata = {
    ActionMetadata: actionMetadata,
  };

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
