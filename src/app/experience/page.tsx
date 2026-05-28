"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useExperienceStore } from "@/store/experienceStore";
import { useSchemaStore } from "@/store/schemaStore";
import { useLogStore } from "@/store/logStore";
import { JourneyConfigurator } from "@/components/JourneyConfigurator";
import { FlowCanvas } from "@/components/FlowCanvas";
import { WebRTCTester } from "@/components/WebRTCTester";
import { Loader2 } from "lucide-react";
import type { ExperienceConfig, JourneyConfig } from "@/types/experience";

interface Queue {
  id: string;
  arn: string;
  name: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

const defaultJourney: JourneyConfig = {
  welcomeMessage: "Welcome. How can I help you today?",
  entryAgentName: "",
  routingRules: [
    // Q Connect agents signal routing via $.Lex.SessionAttributes.Tool
    { id: "rule-escalate", attributeKey: "Tool", condition: "Escalate", action: "queue", targetQueueId: "", targetQueueName: "" },
    { id: "rule-complete", attributeKey: "Tool", condition: "Complete", action: "disconnect" },
  ],
  fallbackQueueId: "",
  fallbackQueueName: "",
};

export default function ExperiencePage() {
  const { projectConfig } = useProjectStore();
  const { experiences, activeExperienceId, addExperience, updateExperience, setActiveExperience, getActiveExperience } =
    useExperienceStore();
  const { library } = useSchemaStore();
  const addLog = useLogStore((s) => s.addLog);

  const [queues, setQueues] = useState<Queue[]>([]);
  const [flows, setFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [qAgents, setQAgents] = useState<Array<{ name: string; arn: string; type: string }>>([]);
  const [lexBots, setLexBots] = useState<Array<{ aliasArn: string; label: string }>>([]);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [voiceTestOpen, setVoiceTestOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ flowId: string; flowArn?: string; updated: boolean } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSentContent, setPublishSentContent] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const { connectRegion, connectInstanceId, region, assistantId } = projectConfig.aws;
    if (!connectRegion || !connectInstanceId) return;

    const enc = encodeURIComponent;

    fetch(`/api/aws/connect/queues?region=${enc(connectRegion)}&connectInstanceId=${enc(connectInstanceId)}`)
      .then((r) => r.json())
      .then((data: { queues?: Queue[] }) => { if (data.queues) setQueues(data.queues); })
      .catch(() => {});

    fetch(`/api/aws/connect/flows?region=${enc(connectRegion)}&connectInstanceId=${enc(connectInstanceId)}`)
      .then((r) => r.json())
      .then((data: { flows?: Array<{ id: string; name: string }> }) => { if (data.flows) setFlows(data.flows); })
      .catch(() => {});

    fetch(`/api/aws/connect/lex-bots?region=${enc(connectRegion)}&connectInstanceId=${enc(connectInstanceId)}`)
      .then((r) => r.json())
      .then((data: { bots?: Array<{ aliasArn: string; label: string }> }) => {
        if (data.bots && data.bots.length > 0) {
          setLexBots(data.bots);
        } else if (projectConfig.aws.lexBotAliasArn) {
          // API blocked or no bots — seed from the settings-level ARN
          setLexBots([{ aliasArn: projectConfig.aws.lexBotAliasArn, label: "Q in Connect (from Settings)" }]);
        }
      })
      .catch(() => {
        if (projectConfig.aws.lexBotAliasArn) {
          setLexBots([{ aliasArn: projectConfig.aws.lexBotAliasArn, label: "Q in Connect (from Settings)" }]);
        }
      });

    if (assistantId) {
      fetch(`/api/aws/qconnect/ai-agents?region=${enc(region || connectRegion)}&assistantId=${enc(assistantId)}`)
        .then((r) => r.json())
        .then((data: { agents?: Array<{ name: string; arn: string; type: string }> }) => { if (data.agents) setQAgents(data.agents); })
        .catch(() => {});
    }
  }, [projectConfig.aws.connectRegion, projectConfig.aws.connectInstanceId, projectConfig.aws.assistantId, projectConfig.aws.lexBotAliasArn]);

  const activeExperience = getActiveExperience();
  const agents = projectConfig.agents.map((a) => a.name);

  const handleNewExperience = () => {
    const config: ExperienceConfig = {
      id: generateId(),
      name: `Experience ${experiences.length + 1}`,
      journeyConfig: { ...defaultJourney },
      generationStatus: "idle",
    };
    addExperience(config);
    setActiveExperience(config.id);
  };

  const handleJourneyChange = (updated: JourneyConfig) => {
    if (!activeExperienceId) return;
    updateExperience(activeExperienceId, { journeyConfig: updated });
  };

  const handleGenerate = async () => {
    if (!activeExperience || !activeExperienceId) return;
    setGenerating(true);
    updateExperience(activeExperienceId, { generationStatus: "generating" });
    addLog("INFO", "ExperiencePage", "Starting flow generation", {
      experience: activeExperience.name,
      model: projectConfig.aws.flowAssistantModelId,
      region: projectConfig.aws.connectRegion,
      entryAgent: activeExperience.journeyConfig.entryAgentName,
    });
    try {
      const res = await fetch("/api/experience/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyConfig: activeExperience.journeyConfig,
          library,
          modelId: projectConfig.aws.flowAssistantModelId,
          region: projectConfig.aws.connectRegion,
        }),
      });
      const data = await res.json();

      // Forward server-side logs to the log sidebar
      if (Array.isArray(data.logs)) {
        for (const entry of data.logs) {
          addLog(entry.level, "FlowGenerator", entry.message, entry.details);
        }
      }

      if (data.error) throw new Error(data.error);

      updateExperience(activeExperienceId, {
        generationStatus: data.status,
        generatedFlowJson: data.flowJson,
        generationError: data.error,
        lastGeneratedAt: new Date().toISOString(),
      });

      if (data.status === "success") {
        addLog("SUCCESS", "ExperiencePage", "Flow generated successfully", { jsonLength: data.flowJson?.length });
      } else {
        addLog("WARN", "ExperiencePage", "Flow generation needs manual review", { error: data.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      addLog("ERROR", "ExperiencePage", "Flow generation failed", { error: msg });
      updateExperience(activeExperienceId, {
        generationStatus: "manual_review",
        generationError: msg,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (!activeExperience?.generatedFlowJson || !activeExperienceId) return;
    setVerifying(true);
    addLog("INFO", "ExperiencePage", "Starting flow verification", {
      experience: activeExperience.name,
      model: projectConfig.aws.flowAssistantModelId,
    });
    try {
      const res = await fetch("/api/experience/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyConfig: activeExperience.journeyConfig,
          flowJson: activeExperience.generatedFlowJson,
          modelId: projectConfig.aws.flowAssistantModelId,
          region: projectConfig.aws.connectRegion,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateExperience(activeExperienceId, { verificationResult: data });
      addLog("SUCCESS", "ExperiencePage", "Flow verification complete", {
        issueCount: data.issues?.length ?? 0,
        suggestionCount: data.suggestions?.length ?? 0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      addLog("ERROR", "ExperiencePage", "Flow verification failed", { error: msg });
      alert(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handlePublish = async () => {
    if (!activeExperience?.generatedFlowJson || !activeExperienceId) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    setPublishSentContent(null);
    try {
      const { connectRegion, connectInstanceId } = projectConfig.aws;
      const res = await fetch("/api/aws/connect/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: connectRegion,
          connectInstanceId,
          name: activeExperience.name,
          flowJson: activeExperience.generatedFlowJson,
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.sentContent) setPublishSentContent(JSON.stringify(data.sentContent, null, 2));
        throw new Error(data.error);
      }
      setPublishResult(data);
      // Refresh the flows list so the newly published flow appears in the WebRTC tester
      const flowsRes = await fetch(
        `/api/aws/connect/flows?region=${encodeURIComponent(connectRegion || "")}&connectInstanceId=${encodeURIComponent(connectInstanceId || "")}`
      );
      const flowsData = await flowsRes.json();
      if (flowsData.flows) setFlows(flowsData.flows);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleExportJson = () => {
    if (!activeExperience?.generatedFlowJson) return;
    const blob = new Blob([activeExperience.generatedFlowJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeExperience.name.replace(/\s+/g, "-").toLowerCase()}-flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    if (!activeExperience?.generatedFlowJson) return;
    navigator.clipboard.writeText(activeExperience.generatedFlowJson);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Experience Builder</h1>
        <div className="flex-1" />
        {mounted && (
          <select
            className="rounded-md border-gray-300 shadow-sm p-2 border focus:border-purple-500 text-sm"
            value={activeExperienceId ?? ""}
            onChange={(e) => setActiveExperience(e.target.value || null)}
          >
            <option value="">-- Select Experience --</option>
            {experiences.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleNewExperience}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          New Experience
        </button>
      </div>

      {!mounted || !activeExperience ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400">
          <p className="text-sm">{mounted ? "Create a new experience to get started." : ""}</p>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="w-2/5 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-800">Journey Configuration</h2>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Name</label>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                  value={activeExperience.name}
                  onChange={(e) => updateExperience(activeExperienceId!, { name: e.target.value })}
                />
              </div>
              <JourneyConfigurator
                config={activeExperience.journeyConfig}
                onChange={handleJourneyChange}
                agents={agents}
                queues={queues}
                qAgents={qAgents}
                lexBots={lexBots}
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {generating ? "Generating..." : "Generate Flow"}
              </button>

              {activeExperience.generationStatus === "manual_review" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 space-y-2">
                  <p className="text-xs text-yellow-800 font-medium">Generation needs manual review</p>
                  {activeExperience.generationError && (
                    <p className="text-xs text-yellow-700">{activeExperience.generationError}</p>
                  )}
                  {activeExperience.generatedFlowJson && (
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="text-xs text-yellow-600 hover:text-yellow-800 transition-colors"
                    >
                      {showRawJson ? "Hide Raw JSON" : "View Raw JSON"}
                    </button>
                  )}
                  {showRawJson && activeExperience.generatedFlowJson && (
                    <pre className="text-xs text-gray-700 bg-white rounded p-2 overflow-auto max-h-32 border">
                      {activeExperience.generatedFlowJson}
                    </pre>
                  )}
                </div>
              )}

              {activeExperience.generationStatus === "success" && (
                <p className="text-xs text-green-600">
                  Flow generated successfully at{" "}
                  {activeExperience.lastGeneratedAt
                    ? new Date(activeExperience.lastGeneratedAt).toLocaleString()
                    : ""}
                </p>
              )}
            </div>

            {activeExperience.generatedFlowJson && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <button
                  onClick={() => setVerifyOpen(!verifyOpen)}
                  className="w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {verifyOpen ? "▾" : "▸"} Ask Claude to Verify
                </button>
                {verifyOpen && (
                  <div className="mt-3 space-y-3">
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
                    >
                      {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {verifying ? "Verifying..." : "Verify Flow"}
                    </button>
                    {activeExperience.verificationResult && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Explanation</p>
                        <p className="text-xs text-gray-600">{activeExperience.verificationResult.explanation}</p>
                        {activeExperience.verificationResult.issues.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-red-600">Issues</p>
                            <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                              {activeExperience.verificationResult.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {activeExperience.verificationResult.suggestions.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-blue-600">Suggestions</p>
                            <ul className="text-xs text-blue-600 list-disc list-inside space-y-0.5">
                              {activeExperience.verificationResult.suggestions.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <FlowCanvas flowJson={activeExperience.generatedFlowJson} />

            {activeExperience.generatedFlowJson && (
              <div className="space-y-2">
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Export Flow JSON
                  </button>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Copy JSON
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {publishing ? "Publishing..." : "Publish to Connect"}
                  </button>
                </div>
                {publishResult && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-xs space-y-1">
                    <p className="text-green-700 font-medium">
                      {publishResult.updated ? "Flow updated in Amazon Connect" : "Flow created in Amazon Connect"}
                    </p>
                    <p className="text-green-600 font-mono">Flow ID: {publishResult.flowId}</p>
                    {publishResult.flowArn && (
                      <p className="text-green-600 font-mono break-all">ARN: {publishResult.flowArn}</p>
                    )}
                    <p className="text-green-500 mt-1">
                      Open Voice Test below, select &quot;{activeExperience.name}&quot;, and start a call to test via WebRTC.
                    </p>
                  </div>
                )}
                {publishError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700 space-y-2">
                    <p className="font-medium">{publishError}</p>
                    {publishSentContent && (
                      <details>
                        <summary className="cursor-pointer text-red-600 hover:text-red-800">
                          Show content sent to Connect (for debugging)
                        </summary>
                        <pre className="mt-2 text-gray-700 bg-white rounded p-2 overflow-auto max-h-64 border text-xs font-mono">
                          {publishSentContent}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => setVoiceTestOpen(!voiceTestOpen)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {voiceTestOpen ? "▾" : "▸"} Voice Test
              </button>
              {voiceTestOpen && (
                <div className="px-4 pb-4">
                  <WebRTCTester discoveredFlows={flows} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
