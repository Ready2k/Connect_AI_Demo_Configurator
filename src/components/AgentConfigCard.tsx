"use client";
import { AgentConfig } from "@/types/project";
import { PromptEditor } from "./PromptEditor";

interface AgentConfigCardProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  onRemove: () => void;
  isExpanded?: boolean;
}

export function AgentConfigCard({ config, onChange, onRemove, isExpanded = true }: AgentConfigCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 space-y-2">
          <input 
            type="text" 
            value={config.name}
            onChange={e => onChange({ ...config, name: e.target.value })}
            className="text-xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-1 w-full"
            placeholder="Agent Name"
          />
          <input 
            type="text"
            value={config.description}
            onChange={e => onChange({ ...config, description: e.target.value })}
            className="text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 px-1 w-full"
            placeholder="Agent Description"
          />
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
          <button 
            onClick={onRemove}
            className="ml-2 text-red-600 hover:text-red-800 text-sm font-medium p-1"
            title="Remove Agent"
          >
            Remove
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 mt-4">
          <label className="block text-sm font-medium text-gray-700">Prompt Template (YAML)</label>
          <PromptEditor 
            value={config.promptTemplate}
            onChange={(val) => onChange({ ...config, promptTemplate: val })}
            onReset={() => onChange({ ...config, promptTemplate: "" })}
          />
        </div>
      )}
    </div>
  );
}
