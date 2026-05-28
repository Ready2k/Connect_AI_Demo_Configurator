"use client";

import { useMemo } from "react";
import { ReactFlow, MiniMap, Controls, Background, Handle, Position, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { flowJsonToGraph } from "@/lib/flow/flowVisualizer";

interface NodeData {
  label: string;
  style: { background: string; border: string; color: string };
  [key: string]: unknown;
}

function FlowNode({ data }: { data: NodeData }) {
  return (
    <>
      <Handle id="target" type="target" position={Position.Top} />
      <div
        className="px-4 py-2 rounded-lg border-2 text-xs font-medium shadow-sm min-w-28 text-center"
        style={{
          background: data.style.background,
          borderColor: data.style.border,
          color: data.style.color,
        }}
      >
        {data.label}
      </div>
      <Handle id="source" type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes = {
  promptNode: FlowNode,
  aiAgentNode: FlowNode,
  attributeNode: FlowNode,
  lambdaNode: FlowNode,
  queueNode: FlowNode,
  disconnectNode: FlowNode,
  defaultNode: FlowNode,
};

interface FlowCanvasProps {
  flowJson: string | undefined;
}

export function FlowCanvas({ flowJson }: FlowCanvasProps) {
  const graph = useMemo(() => {
    if (!flowJson) return null;
    try {
      return flowJsonToGraph(flowJson);
    } catch {
      return null;
    }
  }, [flowJson]);

  if (!flowJson || !graph) {
    return (
      <div className="h-[600px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-sm text-gray-400">Generate a flow to see the visual preview</p>
      </div>
    );
  }

  return (
    <div style={{ height: 600 }} className="border border-gray-200 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={graph.nodes as Node[]}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
