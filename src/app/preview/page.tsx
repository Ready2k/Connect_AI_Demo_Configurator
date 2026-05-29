"use client";
import { useProjectStore } from "@/store/projectStore";
import { PayloadViewer } from "@/components/PayloadViewer";
import { useEffect, useState, useCallback } from "react";
import { PayloadResult } from "@/lib/payloads/buildPayloads";
import { CreateAIPromptCommandInput, CreateAIAgentCommandInput } from "@aws-sdk/client-qconnect";

export default function PreviewPage() {
  const { projectConfig } = useProjectStore();
  const [payloads, setPayloads] = useState<PayloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"aws_payload" | "local_config">("aws_payload");

  const fetchPayloads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/build-payloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: projectConfig })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build payloads");
      setPayloads(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectConfig]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) fetchPayloads();
  }, [mounted]);

  if (!mounted) return null;

  const hasTextCompletionsWarning = projectConfig.agents.some(
    agent => agent.enabled && agent.promptType === "ORCHESTRATION" && agent.apiFormat === "TEXT_COMPLETIONS"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preview Configurations</h1>
          <p className="text-sm text-gray-500 mt-1">Review your local configurations and the exact payloads that will be sent to the Amazon Q Connect API.</p>
        </div>
        <button
          onClick={fetchPayloads}
          disabled={loading}
          className="px-4 py-2 bg-white text-blue-600 font-medium text-sm rounded-md shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 self-start sm:self-auto"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!projectConfig.aws.modelId && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md border border-red-200 text-sm font-medium">
          ⚠️ Preview only. Deployment will be blocked until an AI model is selected.
        </div>
      )}

      {hasTextCompletionsWarning && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md border border-yellow-200 text-sm font-medium">
          ⚠️ This may save successfully, but orchestration prompts are normally expected to use the message-style format. Validate in the Connect AI prompt editor before using in a flow.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-4 pt-4">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("aws_payload")}
              className={`${
                activeTab === "aws_payload"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Actual AWS SDK Payload
            </button>
            <button
              onClick={() => setActiveTab("local_config")}
              className={`${
                activeTab === "local_config"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              Full Local Agent Configuration
              <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">Metadata included</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "aws_payload" ? (
            <>
              {error ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
                  Error generating payloads: {error}
                </div>
              ) : loading ? (
                <div className="text-gray-500">Loading payloads...</div>
              ) : !payloads ? (
                <div className="text-gray-500">Click Refresh to generate payloads.</div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4">
                    This view shows the precise shape of data that will be passed into the `@aws-sdk/client-qconnect` client commands. Only supported parameters are included.
                  </div>
                  {payloads.promptPayloads?.map((p: CreateAIPromptCommandInput, i: number) => (
                    <PayloadViewer key={`prompt-${i}`} title={`CreateAIPrompt (${p.name})`} payload={p} />
                  ))}
                  {payloads.agentPayloads?.map((a: CreateAIAgentCommandInput, i: number) => (
                    <PayloadViewer key={`agent-${i}`} title={`CreateAIAgent (${a.name})`} payload={a} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 text-gray-700 p-3 rounded text-sm border border-gray-200 mb-4">
                This view shows all internal configuration state. Notice that it includes metadata such as Guardrails and Security Profiles, which are local-only and not sent in the AWS payload in this version.
              </div>
              {projectConfig.agents.filter(a => a.enabled).map((agent, i) => (
                <PayloadViewer key={`local-agent-${i}`} title={`Local Agent Config (${agent.name})`} payload={agent} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
