"use client";

import { useEffect } from "react";
import { RoutingRuleRow } from "@/components/RoutingRuleRow";
import type { JourneyConfig, RoutingRule } from "@/types/experience";

const SUPPORTED_LANGUAGES = [
  { code: "en-US", voice: "Joanna", label: "English (US)" },
  { code: "en-GB", voice: "Amy", label: "English (UK)" },
  { code: "en-AU", voice: "Olivia", label: "English (Australia)" },
  { code: "es-US", voice: "Lupe", label: "Spanish (US)" },
  { code: "fr-CA", voice: "Chantal", label: "French (Canada)" }
];

interface QAgent { name: string; arn: string; type: string }
interface LexBot { aliasArn: string; label: string }

interface JourneyConfiguratorProps {
  config: JourneyConfig;
  onChange: (c: JourneyConfig) => void;
  agents: string[];
  queues: Array<{ id: string; arn: string; name: string }>;
  qAgents: QAgent[];
  lexBots: LexBot[];
}

function generateRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function JourneyConfigurator({ config, onChange, agents, queues, qAgents, lexBots }: JourneyConfiguratorProps) {
  // Auto-select wisdomAgentArn when entryAgentName matches a discovered Q Connect agent name
  useEffect(() => {
    if (!config.entryAgentName || config.wisdomAgentArn) return;
    const match = qAgents.find(
      (a) => a.name.toLowerCase() === config.entryAgentName.toLowerCase()
    );
    if (match) onChange({ ...config, wisdomAgentArn: match.arn });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.entryAgentName, qAgents]);

  // Auto-select lexBotAliasArn when there's exactly one Lex bot
  useEffect(() => {
    if (config.lexBotAliasArn || lexBots.length !== 1) return;
    onChange({ ...config, lexBotAliasArn: lexBots[0].aliasArn });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lexBots]);

  const addRule = () => {
    const newRule: RoutingRule = {
      id: generateRuleId(),
      attributeKey: "Tool",
      condition: "",
      action: "queue",
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Q Connect AI Agent
          </label>
          {config.wisdomAgentArn && qAgents.length > 0 && (
            <span className="text-xs text-green-600">auto-selected</span>
          )}
        </div>
        {qAgents.length > 0 ? (
          <select
            className={inputClass}
            value={config.wisdomAgentArn ?? ""}
            onChange={(e) => onChange({ ...config, wisdomAgentArn: e.target.value })}
          >
            <option value="">-- Select Q Connect Agent --</option>
            {qAgents.map((a) => (
              <option key={a.arn} value={a.arn}>{a.name} ({a.type})</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className={inputClass}
            placeholder="arn:aws:wisdom:region:account:assistant/…/ai-agent/…"
            value={config.wisdomAgentArn ?? ""}
            onChange={(e) => onChange({ ...config, wisdomAgentArn: e.target.value })}
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Q Connect Lex Bot
            <span className="ml-1 text-xs font-normal text-gray-400">required — drives the AI agent conversation</span>
          </label>
          {config.lexBotAliasArn && lexBots.length === 1 && (
            <span className="text-xs text-green-600">auto-selected</span>
          )}
        </div>
        {lexBots.length > 0 ? (
          <select
            className={`${inputClass} ${!config.lexBotAliasArn ? "border-amber-400" : ""}`}
            value={config.lexBotAliasArn ?? ""}
            onChange={(e) => onChange({ ...config, lexBotAliasArn: e.target.value })}
          >
            <option value="">-- Select Lex Bot --</option>
            {lexBots.map((b) => (
              <option key={b.aliasArn} value={b.aliasArn}>{b.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className={`${inputClass} ${!config.lexBotAliasArn ? "border-amber-400" : ""}`}
            placeholder="arn:aws:lex:region:account:bot-alias/botId/aliasId"
            value={config.lexBotAliasArn ?? ""}
            onChange={(e) => onChange({ ...config, lexBotAliasArn: e.target.value })}
          />
        )}
        {!config.lexBotAliasArn && (
          <p className="mt-1 text-xs text-amber-600">
            Required for flow generation. Set this in Settings → Q Connect Lex Bot ARN or select above.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chat / TTS Language
          <span className="ml-1 text-xs font-normal text-gray-400">must match your Lex bot locale</span>
        </label>
        <select
          className={inputClass}
          value={config.languageCode || "en-US"}
          onChange={(e) => {
            const selected = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
            if (selected) {
              onChange({ ...config, languageCode: selected.code, voiceId: selected.voice });
            }
          }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>
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
            <p className="text-xs text-gray-400">No routing rules yet.</p>
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
            const q = queues.find((q) => q.arn === e.target.value);
            onChange({ ...config, fallbackQueueId: e.target.value, fallbackQueueName: q?.name ?? "" });
          }}
        >
          <option value="">-- Select Queue --</option>
          {queues.map((q) => (
            <option key={q.id} value={q.arn}>{q.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
