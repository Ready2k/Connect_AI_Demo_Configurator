"use client";
import { AgentConfig } from "@/types/project";
import { PromptEditor } from "./PromptEditor";

interface AgentConfigCardProps {
  agentKey: "customerIntentRouter" | "lostCard";
  config: AgentConfig;
  defaultPromptTemplate: string;
  onChange: (config: AgentConfig) => void;
}

export function AgentConfigCard({ agentKey, config, defaultPromptTemplate, onChange }: AgentConfigCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{config.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {config.agentType}
          </span>
          <select
            className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded border-gray-200 focus:ring-blue-500 focus:border-blue-500 cursor-pointer outline-none"
            value={config.apiFormat}
            onChange={(e) => onChange({ ...config, apiFormat: e.target.value as "MESSAGES" | "TEXT_COMPLETIONS" })}
          >
            <option value="MESSAGES">MESSAGES</option>
            <option value="TEXT_COMPLETIONS">TEXT_COMPLETIONS</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Prompt Template (YAML)</label>
        <PromptEditor 
          value={config.promptTemplate}
          onChange={(val) => onChange({ ...config, promptTemplate: val })}
          onReset={() => onChange({ ...config, promptTemplate: defaultPromptTemplate })}
        />
      </div>
    </div>
  );
}
