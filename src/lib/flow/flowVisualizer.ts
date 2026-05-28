import type { Node, Edge } from "@xyflow/react";

interface ConnectAction {
  Identifier: string;
  Type?: string;
  Parameters?: Record<string, unknown>;
  Transitions?: {
    NextAction?: string;
    Errors?: Array<{ NextAction?: string; ErrorType?: string }>;
    Conditions?: Array<{ NextAction?: string; Condition?: Record<string, unknown> }>;
  };
}

interface ConnectFlowJson {
  StartAction?: string;
  Actions?: ConnectAction[];
}

function getNodeStyle(friendly: string): { background: string; border: string; color: string } {
  if (friendly === "Play Prompt" || friendly === "MessageParticipant") {
    return { background: "#f3f4f6", border: "#9ca3af", color: "#374151" };
  }
  if (friendly === "Connect Assistant") {
    return { background: "#dbeafe", border: "#3b82f6", color: "#1e40af" };
  }
  if (friendly === "Set Contact Attributes") {
    return { background: "#fef9c3", border: "#facc15", color: "#713f12" };
  }
  if (friendly === "Invoke Lambda Function") {
    return { background: "#f3e8ff", border: "#a855f7", color: "#581c87" };
  }
  if (friendly.includes("Transfer") || friendly === "Transfer to Queue") {
    return { background: "#dcfce7", border: "#22c55e", color: "#14532d" };
  }
  if (friendly === "Disconnect") {
    return { background: "#fee2e2", border: "#ef4444", color: "#7f1d1d" };
  }
  return { background: "#f9fafb", border: "#d1d5db", color: "#374151" };
}

function getFriendlyName(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("playprompt") || t.includes("messageparticipant")) return "Play Prompt";
  if (t.includes("setattributes") || t.includes("updatecontactattributes")) return "Set Contact Attributes";
  if (t.includes("invokeexternalresource") || t.includes("invokelambda")) return "Invoke Lambda Function";
  if (t.includes("transfertoqueue") || t.includes("transfer")) return "Transfer to Queue";
  if (t.includes("disconnect")) return "Disconnect";
  if (t.includes("getparticipantinput") || t.includes("storecustomerinput") || t.includes("getcustomerinput")) return "Get Customer Input";
  if (t.includes("wisdom") || t.includes("qconnect") || t.includes("assistant") || t.includes("setflowmodulemetadata")) return "Connect Assistant";
  return type;
}

function getNodeType(friendly: string): string {
  if (friendly === "Play Prompt") return "promptNode";
  if (friendly === "Connect Assistant") return "aiAgentNode";
  if (friendly === "Set Contact Attributes") return "attributeNode";
  if (friendly === "Invoke Lambda Function") return "lambdaNode";
  if (friendly.includes("Transfer")) return "queueNode";
  if (friendly === "Disconnect") return "disconnectNode";
  return "defaultNode";
}

export function flowJsonToGraph(flowJson: string): { nodes: Node[]; edges: Edge[] } {
  let raw: ConnectFlowJson;
  try {
    raw = JSON.parse(flowJson) as ConnectFlowJson;
  } catch {
    return { nodes: [], edges: [] };
  }

  const actions = raw.Actions ?? [];
  const actionMap = new Map<string, ConnectAction>();
  for (const a of actions) {
    actionMap.set(a.Identifier, a);
  }

  const positionMap = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; x: number; y: number }> = [];

  const startId = raw.StartAction ?? (actions[0]?.Identifier ?? "");
  if (startId) {
    queue.push({ id: startId, x: 400, y: 0 });
  }

  while (queue.length > 0) {
    const { id, x, y } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    positionMap.set(id, { x, y });

    const action = actionMap.get(id);
    if (!action?.Transitions) continue;

    const { NextAction, Errors = [], Conditions = [] } = action.Transitions;

    let nextY = y + 150;
    if (NextAction && !visited.has(NextAction)) {
      queue.push({ id: NextAction, x, y: nextY });
      nextY += 150;
    }
    let branchX = x + 300;
    for (const err of Errors) {
      if (err.NextAction && !visited.has(err.NextAction)) {
        queue.push({ id: err.NextAction, x: branchX, y: y + 150 });
        branchX += 250;
      }
    }
    let condX = x - 300;
    for (const cond of Conditions) {
      if (cond.NextAction && !visited.has(cond.NextAction)) {
        queue.push({ id: cond.NextAction, x: condX, y: y + 150 });
        condX -= 250;
      }
    }
  }

  for (const action of actions) {
    if (!positionMap.has(action.Identifier)) {
      positionMap.set(action.Identifier, { x: 0, y: positionMap.size * 150 });
    }
  }

  const nodes: Node[] = actions.map((action) => {
    const pos = positionMap.get(action.Identifier) ?? { x: 0, y: 0 };
    const friendly = getFriendlyName(action.Type ?? "");
    const style = getNodeStyle(friendly);
    return {
      id: action.Identifier,
      type: getNodeType(friendly),
      position: pos,
      data: {
        label: friendly,
        style,
      },
    };
  });

  const edges: Edge[] = [];
  for (const action of actions) {
    const t = action.Transitions;
    if (!t) continue;
    if (t.NextAction) {
      edges.push({
        id: `${action.Identifier}->${t.NextAction}`,
        source: action.Identifier,
        target: t.NextAction,
        label: "next",
      });
    }
    for (const err of t.Errors ?? []) {
      if (err.NextAction) {
        edges.push({
          id: `${action.Identifier}->err->${err.NextAction}`,
          source: action.Identifier,
          target: err.NextAction,
          label: err.ErrorType ?? "error",
        });
      }
    }
    for (const cond of t.Conditions ?? []) {
      if (cond.NextAction) {
        edges.push({
          id: `${action.Identifier}->cond->${cond.NextAction}`,
          source: action.Identifier,
          target: cond.NextAction,
          label: "condition",
        });
      }
    }
  }

  return { nodes, edges };
}
