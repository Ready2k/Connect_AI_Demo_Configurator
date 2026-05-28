"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useExperienceStore } from "@/store/experienceStore";
import { useSchemaStore } from "@/store/schemaStore";
import { JourneyConfigurator } from "@/components/JourneyConfigurator";
import { FlowCanvas } from "@/components/FlowCanvas";
import { WebRTCTester } from "@/components/WebRTCTester";
import { Loader2 } from "lucide-react";
import type { ExperienceConfig, JourneyConfig } from "@/types/experience";

interface Queue {
  id: string;
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

  const [queues, setQueues] = useState<Queue[]>([]);
  const [flows, setFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [voiceTestOpen, setVoiceTestOpen] = useState(false);

  useEffect(() => {
    const { connectRegion, connectInstanceId } = projectConfig.aws;
    if (!connectRegion || !connectInstanceId) return;
    fetch(
      `/api/aws/connect/queues?region=${encodeURIComponent(connectRegion)}&connectInstanceId=${encodeURIComponent(connectInstanceId)}`
    )
      .then((r) => r.json())
      .then((data: { queues?: Queue[] }) => {
        if (data.queues) setQueues(data.queues);
      })
      .catch(() => {});
    fetch(
      `/api/aws/connect/flows?region=${encodeURIComponent(connectRegion)}&connectInstanceId=${encodeURIComponent(connectInstanceId)}`
    )
      .then((r) => r.json())
      .then((data: { flows?: Array<{ id: string; name: string }> }) => {
        if (data.flows) setFlows(data.flows);
      })
      .catch(() => {});
  }, [projectConfig.aws.connectRegion, projectConfig.aws.connectInstanceId]);

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
      if (data.error) throw new Error(data.error);
      updateExperience(activeExperienceId, {
        generationStatus: data.status,
        generatedFlowJson: data.flowJson,
        generationError: data.error,
        lastGeneratedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      alert(msg);
    } finally {
      setVerifying(false);
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
        <button
          onClick={handleNewExperience}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          New Experience
        </button>
      </div>

      {!activeExperience ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400">
          <p className="text-sm">Create a new experience to get started.</p>
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
              <div className="flex gap-3">
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
