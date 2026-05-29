"use client";

import { useEffect, useMemo } from "react";
import { ReactFlow, MiniMap, Controls, Background, Handle, Position, useNodesState, useEdgesState, type Node, type Edge } from "@xyflow/react";
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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (graph) {
      setNodes(graph.nodes as Node[]);
      setEdges(graph.edges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [graph, setNodes, setEdges]);

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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
