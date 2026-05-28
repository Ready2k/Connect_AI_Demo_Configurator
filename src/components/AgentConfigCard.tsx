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
    <div className={`bg-white p-6 rounded-lg shadow-sm border space-y-6 transition-opacity ${config.enabled ? "border-gray-100" : "border-gray-200 opacity-50"}`}>
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
          <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1" title="Include in next deployment">
            <span className="text-xs font-medium text-gray-600">Deploy</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              onClick={() => onChange({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${config.enabled ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${config.enabled ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </label>
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
