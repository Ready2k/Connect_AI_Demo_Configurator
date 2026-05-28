"use client";

import type { RoutingRule, RoutingAction } from "@/types/experience";

interface RoutingRuleRowProps {
  rule: RoutingRule;
  onChange: (updated: RoutingRule) => void;
  agents: string[];
  queues: Array<{ id: string; arn: string; name: string }>;
  onRemove: () => void;
}

export function RoutingRuleRow({ rule, onChange, agents, queues, onRemove }: RoutingRuleRowProps) {
  const inputClass =
    "rounded-md border-gray-300 shadow-sm p-1.5 border focus:border-blue-500 focus:ring-blue-500 text-xs";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        className={`${inputClass} w-36`}
        placeholder="Tool"
        value={rule.attributeKey}
        onChange={(e) => onChange({ ...rule, attributeKey: e.target.value })}
      />
      <span className="text-xs text-gray-400">=</span>
      <input
        type="text"
        className={`${inputClass} w-28`}
        placeholder="condition"
        value={rule.condition}
        onChange={(e) => onChange({ ...rule, condition: e.target.value })}
      />
      <span className="text-xs text-gray-400">→</span>
      <select
        className={`${inputClass} w-28`}
        value={rule.action}
        onChange={(e) => onChange({ ...rule, action: e.target.value as RoutingAction })}
      >
        <option value="agent">Agent</option>
        <option value="queue">Queue</option>
        <option value="disconnect">Disconnect</option>
      </select>
      {rule.action === "agent" && (
        <select
          className={`${inputClass} w-36`}
          value={rule.targetAgentName ?? ""}
          onChange={(e) => onChange({ ...rule, targetAgentName: e.target.value })}
        >
          <option value="">-- Select Agent --</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      )}
      {rule.action === "queue" && (
        <select
          className={`${inputClass} w-36`}
          value={rule.targetQueueId ?? ""}
          onChange={(e) => {
            const q = queues.find((q) => q.arn === e.target.value);
            onChange({ ...rule, targetQueueId: e.target.value, targetQueueName: q?.name ?? "" });
          }}
        >
          <option value="">-- Select Queue --</option>
          {queues.map((q) => (
            <option key={q.id} value={q.arn}>{q.name}</option>
          ))}
        </select>
      )}
      <button
        onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-sm px-1 transition-colors"
        title="Remove rule"
      >
        ×
      </button>
    </div>
  );
}
