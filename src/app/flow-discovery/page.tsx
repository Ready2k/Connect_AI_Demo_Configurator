"use client";

import { useState, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useSchemaStore } from "@/store/schemaStore";
import { parseFlowContent, extractBlockSchemas } from "@/lib/flow/schemaParser";
import { BlockSchemaCard } from "@/components/BlockSchemaCard";
import type { ParsedFlow } from "@/types/flowSchema";
import { Loader2 } from "lucide-react";

interface FlowSummary {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function FlowDiscoveryPage() {
  const { projectConfig } = useProjectStore();
  const { library, mergeSchemas, hasConnectAssistantSchema } = useSchemaStore();

  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [fetchingFlows, setFetchingFlows] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFlow, setSelectedFlow] = useState<FlowSummary | null>(null);
  const [parsedFlow, setParsedFlow] = useState<ParsedFlow | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [loadFlowError, setLoadFlowError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleFetchFlows = async () => {
    setFetchingFlows(true);
    setFetchError(null);
    try {
      const { connectRegion, connectInstanceId } = projectConfig.aws;
      const res = await fetch(
        `/api/aws/connect/flows?region=${encodeURIComponent(connectRegion || "")}&connectInstanceId=${encodeURIComponent(connectInstanceId || "")}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFlows(data.flows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch flows";
      setFetchError(msg);
    } finally {
      setFetchingFlows(false);
    }
  };

  const handleLoadAndAnalyse = async () => {
    if (!selectedFlow) return;
    setLoadingFlow(true);
    setLoadFlowError(null);
    setParsedFlow(null);
    try {
      const { connectRegion, connectInstanceId } = projectConfig.aws;
      const res = await fetch(
        `/api/aws/connect/flows/${selectedFlow.id}?region=${encodeURIComponent(connectRegion || "")}&connectInstanceId=${encodeURIComponent(connectInstanceId || "")}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed = parseFlowContent(data.flow.content);
      parsed.id = selectedFlow.id;
      parsed.name = selectedFlow.name;
      parsed.type = selectedFlow.type;
      setParsedFlow(parsed);
      
      // Auto-save schemas to library
      const schemas = extractBlockSchemas(parsed.id, parsed.name, parsed);
      mergeSchemas(schemas);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load flow";
      setLoadFlowError(msg);
    } finally {
      setLoadingFlow(false);
    }
  };

  const handleSaveSchemas = () => {
    if (!parsedFlow || !selectedFlow) return;
    const schemas = extractBlockSchemas(selectedFlow.id, selectedFlow.name, parsedFlow);
    mergeSchemas(schemas);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleParseImported = () => {
    setImportError(null);
    try {
      const parsed = parseFlowContent(importText);
      parsed.id = "imported";
      parsed.name = "Imported Flow";
      parsed.type = "CONTACT_FLOW";
      setParsedFlow(parsed);
      setSelectedFlow({ id: "imported", name: "Imported Flow", type: "CONTACT_FLOW", status: "" });
      
      // Auto-save schemas to library
      const schemas = extractBlockSchemas(parsed.id, parsed.name, parsed);
      mergeSchemas(schemas);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse JSON";
      setImportError(msg);
    }
  };

  const filteredFlows = flows.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const schemaEntries = parsedFlow
    ? extractBlockSchemas(selectedFlow?.id ?? "", selectedFlow?.name ?? "", parsedFlow)
    : {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flow Discovery</h1>
        <p className="text-sm text-gray-500 mt-1">
          Discover existing Amazon Connect contact flows and extract block schemas.
        </p>
      </div>

      {mounted && !hasConnectAssistantSchema() && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r">
          <p className="text-sm text-yellow-700 font-medium">
            No Connect Assistant block found in your flows. Create a sample flow in the Amazon Connect
            console containing a &quot;Set Amazon Q in Connect&quot; block, then return here to re-run discovery.
          </p>
        </div>
      )}

      {savedToast && (
        <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r">
          <p className="text-sm text-green-700 font-medium">Schemas auto-saved to library.</p>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-1/3 space-y-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <button
              onClick={handleFetchFlows}
              disabled={fetchingFlows}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {fetchingFlows ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {fetchingFlows ? "Fetching..." : "Fetch Flows"}
            </button>
            {fetchError && <p className="text-xs text-red-600">{fetchError}</p>}
            <input
              type="text"
              placeholder="Search flows..."
              className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm focus:border-blue-500 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredFlows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => {
                    setSelectedFlow(flow);
                    setParsedFlow(null);
                    setLoadFlowError(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFlow?.id === flow.id
                      ? "bg-blue-50 border border-blue-200 text-blue-800"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="font-medium">{flow.name}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {flow.type}
                  </span>
                </button>
              ))}
              {flows.length > 0 && filteredFlows.length === 0 && (
                <p className="text-xs text-gray-400 px-2">No flows match your search.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => setImportOpen(!importOpen)}
              className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {importOpen ? "▾" : "▸"} Manual Import (paste JSON)
            </button>
            {importOpen && (
              <div className="px-4 pb-4 space-y-2">
                <textarea
                  className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-xs font-mono focus:border-blue-500 focus:ring-blue-500 h-32 resize-none"
                  placeholder="Paste exported Contact Flow JSON here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {importError && <p className="text-xs text-red-600">{importError}</p>}
                <button
                  onClick={handleParseImported}
                  disabled={!importText.trim()}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 text-sm transition-colors"
                >
                  Parse Imported JSON
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {!selectedFlow && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
              <p className="text-sm">Select a flow from the list to inspect it.</p>
            </div>
          )}

          {selectedFlow && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">
                  Inspecting: {selectedFlow.name}
                </h2>
                <button
                  onClick={handleLoadAndAnalyse}
                  disabled={loadingFlow}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {loadingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingFlow ? "Loading..." : "Load & Analyse"}
                </button>
              </div>

              {loadFlowError && (
                <p className="text-sm text-red-600">{loadFlowError}</p>
              )}

              {parsedFlow && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Found <strong>{parsedFlow.actions.length}</strong> blocks,{" "}
                      <strong>{parsedFlow.blockTypesFound.length}</strong> unique types.
                      Schemas have been automatically added to your library.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {Object.values(schemaEntries).map((schema) => (
                      <BlockSchemaCard key={schema.friendlyName} schema={schema} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mounted && library.schemas && Object.keys(library.schemas).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Schema Library ({Object.keys(library.schemas).length} types saved)
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.keys(library.schemas).map((key) => (
                  <span
                    key={key}
                    className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
