"use client";

import { RoutingRuleRow } from "@/components/RoutingRuleRow";
import type { JourneyConfig, RoutingRule } from "@/types/experience";

interface JourneyConfiguratorProps {
  config: JourneyConfig;
  onChange: (c: JourneyConfig) => void;
  agents: string[];
  queues: Array<{ id: string; name: string }>;
}

function generateRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function JourneyConfigurator({ config, onChange, agents, queues }: JourneyConfiguratorProps) {
  const addRule = () => {
    const newRule: RoutingRule = {
      id: generateRuleId(),
      attributeKey: "agentOutput.intent",
      condition: "",
      action: "agent",
    };
    onChange({ ...config, routingRules: [...config.routingRules, newRule] });
  };

  const updateRule = (index: number, updated: RoutingRule) => {
    const rules = config.routingRules.map((r, i) => (i === index ? updated : r));
    onChange({ ...config, routingRules: rules });
  };

  const removeRule = (index: number) => {
    onChange({ ...config, routingRules: config.routingRules.filter((_, i) => i !== index) });
  };

  const inputClass =
    "block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
        <textarea
          className={`${inputClass} h-20 resize-none`}
          placeholder="Welcome to Acme Corp. How can I help you today?"
          value={config.welcomeMessage}
          onChange={(e) => onChange({ ...config, welcomeMessage: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Entry Agent</label>
        <select
          className={inputClass}
          value={config.entryAgentName}
          onChange={(e) => onChange({ ...config, entryAgentName: e.target.value })}
        >
          <option value="">-- Select Agent --</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Routing Rules</label>
          <button
            onClick={addRule}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Add Rule
          </button>
        </div>
        <div className="space-y-2">
          {config.routingRules.length === 0 && (
            <p className="text-xs text-gray-400">No routing rules yet. Click &quot;Add Rule&quot; to create one.</p>
          )}
          {config.routingRules.map((rule, i) => (
            <RoutingRuleRow
              key={rule.id}
              rule={rule}
              onChange={(updated) => updateRule(i, updated)}
              agents={agents}
              queues={queues}
              onRemove={() => removeRule(i)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fallback Queue</label>
        <select
          className={inputClass}
          value={config.fallbackQueueId}
          onChange={(e) => {
            const q = queues.find((q) => q.id === e.target.value);
            onChange({ ...config, fallbackQueueId: e.target.value, fallbackQueueName: q?.name ?? "" });
          }}
        >
          <option value="">-- Select Queue --</option>
          {queues.map((q) => (
            <option key={q.id} value={q.id}>{q.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
