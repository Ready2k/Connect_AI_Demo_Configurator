"use client";

import { useState } from "react";
import type { DiscoveredBlockSchema } from "@/types/flowSchema";

interface BlockSchemaCardProps {
  schema: DiscoveredBlockSchema;
}

export function BlockSchemaCard({ schema }: BlockSchemaCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{schema.friendlyName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Source: {schema.sourceFlowName}</p>
          <p className="text-xs text-gray-400">
            Discovered: {new Date(schema.discoveredAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors ml-4 shrink-0"
        >
          {expanded ? "Hide JSON" : "View JSON"}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 bg-gray-50 rounded p-3 overflow-auto max-h-48">
          <p className="text-xs font-medium text-gray-600 mb-1">Sample Parameters</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
            {JSON.stringify(schema.sampleParameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
