"use client";
import { useProjectStore } from "@/store/projectStore";
import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { addLog } from "@/store/logStore";

const FLOW_ASSISTANT_MODEL_OPTIONS = [
  { value: "us.amazon.nova-pro-v1:0", label: "Nova Pro (Recommended for flow generation)" },
  { value: "us.anthropic.claude-sonnet-4-6-20250514-v1:0", label: "Claude Sonnet 4.6" },
  { value: "us.anthropic.claude-opus-4-7-20250514-v1:0", label: "Claude Opus 4.7 (Best quality)" },
  { value: "us.anthropic.claude-haiku-4-5-20251001-v1:0", label: "Claude Haiku 4.5 (Economy)" },
];

export function SettingsForm() {
  const { projectConfig, updateProjectConfig } = useProjectStore();
  const [mounted, setMounted] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryData, setDiscoveryData] = useState<{ instances: any[], assistants: any[] } | null>(null);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsData, setModelsData] = useState<{ models: any[], warning?: string } | null>(null);
  const [derivingUrl, setDerivingUrl] = useState(false);
  const [customModelId, setCustomModelId] = useState("");
  const [fetchingLexBots, setFetchingLexBots] = useState(false);
  const [lexBotOptions, setLexBotOptions] = useState<Array<{ aliasArn: string; label: string }>>([]);
  const [lexBotError, setLexBotError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (projectConfig.aws.region && projectConfig.aws.assistantId) {
      setFetchingModels(true);
      fetch(`/api/aws/models?region=${projectConfig.aws.region}&assistantId=${projectConfig.aws.assistantId}&promptType=ORCHESTRATION`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setModelsData(data);
        })
        .catch(err => {
          addLog("ERROR", "Models", `Failed to fetch models: ${err.message}`);
          setModelsData(null);
        })
        .finally(() => setFetchingModels(false));
    } else {
      setModelsData(null);
    }
  }, [projectConfig.aws.region, projectConfig.aws.assistantId]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/aws/discovery?region=${projectConfig.aws.region}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiscoveryData(data);
      addLog("SUCCESS", "Discovery", `Discovered ${data.instances.length} instances and ${data.assistants.length} assistants in ${projectConfig.aws.region}`, data);
    } catch (err: any) {
      addLog("ERROR", "Discovery", `Failed to auto-discover AWS resources: ${err.message}`);
      alert("Discovery failed: " + err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const handleFetchLexBots = async () => {
    const { connectRegion, connectInstanceId } = projectConfig.aws;
    if (!connectRegion || !connectInstanceId) {
      setLexBotError("Set Connect Region and Connect Instance ID first.");
      return;
    }
    setFetchingLexBots(true);
    setLexBotError(null);
    try {
      const res = await fetch(
        `/api/aws/connect/lex-bots?region=${encodeURIComponent(connectRegion)}&connectInstanceId=${encodeURIComponent(connectInstanceId)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const bots: Array<{ aliasArn: string; label: string }> = data.bots ?? [];
      setLexBotOptions(bots);
      if (bots.length === 1 && !projectConfig.aws.lexBotAliasArn) {
        updateProjectConfig({ aws: { ...projectConfig.aws, lexBotAliasArn: bots[0].aliasArn } });
      }
      if (bots.length === 0) setLexBotError("No Lex V2 bots found. Check connect:ListBots permission.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setLexBotError(msg.includes("not authorized") ? "IAM permission connect:ListBots not granted — enter ARN manually." : msg);
    } finally {
      setFetchingLexBots(false);
    }
  };

  const handleDeriveInstanceUrl = async () => {
    setDerivingUrl(true);
    try {
      const region = projectConfig.aws.connectRegion;
      const connectInstanceId = projectConfig.aws.connectInstanceId;
      if (!region || !connectInstanceId) {
        alert("Set Connect Region and Connect Instance ID first.");
        return;
      }
      const res = await fetch(`/api/aws/connect/instance?region=${region}&connectInstanceId=${connectInstanceId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateProjectConfig({ aws: { ...projectConfig.aws, connectInstanceUrl: data.instanceUrl } });
      addLog("SUCCESS", "Connect", `Derived instance URL: ${data.instanceUrl}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog("ERROR", "Connect", `Failed to derive instance URL: ${msg}`);
      alert("Failed: " + msg);
    } finally {
      setDerivingUrl(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r">
        <p className="text-sm text-yellow-700 font-medium">Configuration is stored locally in this browser. Do not enter secrets or real customer data.</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Project</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
          <input 
            type="text" 
            className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            value={projectConfig.projectName}
            onChange={(e) => updateProjectConfig({ projectName: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">AWS Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input 
              type="text" 
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
              value={projectConfig.aws.region}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, region: e.target.value } })}
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Assistant ID</label>
              <button 
                onClick={handleDiscover}
                disabled={discovering}
                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {discovering ? "Discovering..." : "Auto-Discover from AWS Profile"}
              </button>
            </div>
            
            {discoveryData && discoveryData.assistants.length > 0 ? (
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm mb-2"
                value={projectConfig.aws.assistantId}
                onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, assistantId: e.target.value } })}
              >
                <option value="">-- Select an Assistant --</option>
                {discoveryData.assistants.map((ast: any) => (
                  <option key={ast.assistantId} value={ast.assistantId}>
                    {ast.name} ({ast.assistantId}) {ast.relatedInstanceAlias ? `[Instance: ${ast.relatedInstanceAlias}]` : ''}
                  </option>
                ))}
              </select>
            ) : null}
            
            <input 
              type="text" 
              placeholder="Or enter Assistant ID manually"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-500" 
              value={projectConfig.aws.assistantId}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, assistantId: e.target.value } })}
            />
            {discoveryData && discoveryData.assistants.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">No assistants found in this region.</p>
            )}
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">AI Model ID</label>
              {fetchingModels && <span className="text-sm flex items-center gap-1 text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading models...</span>}
            </div>
            {modelsData && modelsData.warning && (
              <p className="text-xs text-yellow-600 mb-2">{modelsData.warning}</p>
            )}
            {modelsData && modelsData.models.length > 0 ? (
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm mb-2"
                value={projectConfig.aws.modelId || ""}
                onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, modelId: e.target.value } })}
              >
                <option value="">-- Select an AI Model --</option>
                {modelsData.models.map((m: any) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.displayName || m.modelId} ({m.modelId})
                  </option>
                ))}
              </select>
            ) : null}
            <input 
              type="text" 
              placeholder="Or enter Model ID manually"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-500" 
              value={projectConfig.aws.modelId || ""}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, modelId: e.target.value } })}
            />
            {modelsData && modelsData.models.length > 0 && projectConfig.aws.modelId && !modelsData.models.find((m: any) => m.modelId === projectConfig.aws.modelId) && (
              <p className="text-xs text-yellow-600 mt-1">Warning: Entered Model ID is not in the discovered list. Recommend running a Smoke Test before deployment.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deployment Mode</label>
            <select 
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
              value={projectConfig.aws.deploymentMode}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, deploymentMode: e.target.value as any } })}
            >
              <option value="preview_only">Preview Only</option>
              <option value="create_prompts_only">Create Prompts Only</option>
              <option value="create_agents_only">Create Agents Only</option>
              <option value="create_prompts_and_agents">Create Prompts & Agents</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility Status</label>
            <select 
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
              value={projectConfig.aws.visibilityStatus}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, visibilityStatus: e.target.value as any } })}
            >
              <option value="SAVED">SAVED</option>
              <option value="PUBLISHED">PUBLISHED</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name Suffix Mode</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={projectConfig.aws.nameSuffixMode || "environment_and_timestamp"}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, nameSuffixMode: e.target.value as any } })}
            >
              <option value="none">None</option>
              <option value="environment">Environment</option>
              <option value="timestamp">Timestamp</option>
              <option value="environment_and_timestamp">Environment + Timestamp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Experience Builder Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connect Region</label>
            <input
              type="text"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="us-west-2"
              value={projectConfig.aws.connectRegion || ""}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, connectRegion: e.target.value } })}
            />
            <p className="text-xs text-gray-400 mt-1">AWS region for your Amazon Connect instance.</p>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Connect Instance ID</label>
            </div>
            {discoveryData && discoveryData.instances && discoveryData.instances.length > 0 ? (
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm mb-2"
                value={projectConfig.aws.connectInstanceId || ""}
                onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, connectInstanceId: e.target.value } })}
              >
                <option value="">-- Select a Connect Instance --</option>
                {discoveryData.instances.map((inst: any) => (
                  <option key={inst.Id} value={inst.Id}>
                    {inst.InstanceAlias} ({inst.Id})
                  </option>
                ))}
              </select>
            ) : null}
            <input 
              type="text" 
              placeholder="Or enter Connect Instance ID manually"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-500" 
              value={projectConfig.aws.connectInstanceId || ""}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, connectInstanceId: e.target.value } })}
            />
            <p className="text-xs text-gray-400 mt-1">Required to deploy AI Agents.</p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Connect Instance URL</label>
              <button
                onClick={handleDeriveInstanceUrl}
                disabled={derivingUrl}
                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {derivingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {derivingUrl ? "Deriving..." : "Auto-derive"}
              </button>
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="https://your-instance.my.connect.aws"
              value={projectConfig.aws.connectInstanceUrl || ""}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, connectInstanceUrl: e.target.value } })}
            />
            <p className="text-xs text-gray-400 mt-1">Used for WebRTC testing. Click Auto-derive to populate from your instance ID.</p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Q Connect Lex Bot Alias ARN</label>
              <button
                onClick={handleFetchLexBots}
                disabled={fetchingLexBots}
                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {fetchingLexBots ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {fetchingLexBots ? "Fetching..." : "Fetch from Connect"}
              </button>
            </div>
            {lexBotOptions.length > 0 ? (
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm mb-2"
                value={projectConfig.aws.lexBotAliasArn ?? ""}
                onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, lexBotAliasArn: e.target.value } })}
              >
                <option value="">-- Select Lex Bot --</option>
                {lexBotOptions.map((b) => (
                  <option key={b.aliasArn} value={b.aliasArn}>{b.label}</option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="arn:aws:lex:region:account:bot-alias/botId/aliasId"
              value={projectConfig.aws.lexBotAliasArn ?? ""}
              onChange={(e) => updateProjectConfig({ aws: { ...projectConfig.aws, lexBotAliasArn: e.target.value } })}
            />
            {lexBotError && <p className="text-xs text-amber-600 mt-1">{lexBotError}</p>}
            <p className="text-xs text-gray-400 mt-1">
              The Q in Connect Lex bot alias ARN. Set once here — used automatically in all experiences.
              Find it in Connect console → Amazon Q in Connect → Lex bot, or click Fetch from Connect.
            </p>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Flow Assistant Model</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm mb-2"
              value={FLOW_ASSISTANT_MODEL_OPTIONS.some(o => o.value === projectConfig.aws.flowAssistantModelId) ? projectConfig.aws.flowAssistantModelId : "__custom__"}
              onChange={(e) => {
                if (e.target.value !== "__custom__") {
                  updateProjectConfig({ aws: { ...projectConfig.aws, flowAssistantModelId: e.target.value } });
                  setCustomModelId("");
                }
              }}
            >
              {FLOW_ASSISTANT_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label} — {o.value}</option>
              ))}
              <option value="__custom__">Custom model ID...</option>
            </select>
            {(!FLOW_ASSISTANT_MODEL_OPTIONS.some(o => o.value === projectConfig.aws.flowAssistantModelId) || customModelId) && (
              <input
                type="text"
                className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Enter custom cross-region inference profile ID"
                value={customModelId || (!FLOW_ASSISTANT_MODEL_OPTIONS.some(o => o.value === projectConfig.aws.flowAssistantModelId) ? projectConfig.aws.flowAssistantModelId : "")}
                onChange={(e) => {
                  setCustomModelId(e.target.value);
                  updateProjectConfig({ aws: { ...projectConfig.aws, flowAssistantModelId: e.target.value } });
                }}
              />
            )}
            <p className="text-xs text-gray-400 mt-1">Cross-region inference profile IDs. Verify availability in the Bedrock console.</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Demo Failure Mode</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Failure Mode</label>
          <select 
            className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm" 
            value={projectConfig.demoFailureMode}
            onChange={(e) => updateProjectConfig({ demoFailureMode: e.target.value as any })}
          >
            <option value="tool_failure_at_list_cards">Tool Failure at List Cards</option>
            <option value="tool_failure_at_block_card">Tool Failure at Block Card</option>
            <option value="tool_failure_at_replacement">Tool Failure at Replacement</option>
            <option value="manual_success_simulation">Manual Success Simulation</option>
          </select>
          <p className="text-sm text-gray-500 mt-2">Determines at what point the mock tools will simulate a failure and route to the human queue.</p>
        </div>
      </div>
    </div>
  );
}
