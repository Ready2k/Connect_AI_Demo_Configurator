"use client";
import { useProjectStore } from "@/store/projectStore";
import { PayloadViewer } from "@/components/PayloadViewer";
import { useEffect, useState, useCallback } from "react";

export default function PreviewPage() {
  const { projectConfig } = useProjectStore();
  const [payloads, setPayloads] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectConfig]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) fetchPayloads();
  }, [mounted]); // intentionally run once on mount; use Refresh to update

  if (!mounted) return null;

  const hasTextCompletionsWarning = projectConfig.agents.some(
    agent => agent.enabled && agent.promptType === "ORCHESTRATION" && agent.apiFormat === "TEXT_COMPLETIONS"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preview Payloads</h1>
          <p className="text-sm text-gray-500 mt-1">Review the exact JSON payloads that will be sent to the Amazon Q Connect API.</p>
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
          {payloads.promptPayloads?.map((p: any, i: number) => (
            <PayloadViewer key={`prompt-${i}`} title={`CreateAIPrompt (${p.name})`} payload={p} />
          ))}
          {payloads.agentPayloads?.map((a: any, i: number) => (
            <PayloadViewer key={`agent-${i}`} title={`CreateAIAgent (${a.name})`} payload={a} />
          ))}
        </div>
      )}
    </div>
  );
}
