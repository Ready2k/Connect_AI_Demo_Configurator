"use client";
import { useProjectStore } from "@/store/projectStore";
import { AgentConfigCard } from "@/components/AgentConfigCard";
import { useState, useEffect } from "react";
import { AgentConfig } from "@/types/project";

export default function AgentsPage() {
  const { projectConfig, updateProjectConfig } = useProjectStore();
  const [mounted, setMounted] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleUpdateAgent = (index: number, updatedAgent: AgentConfig) => {
    const newAgents = [...projectConfig.agents];
    newAgents[index] = updatedAgent;
    updateProjectConfig({ agents: newAgents });
  };

  const handleRemoveAgent = (index: number) => {
    const newAgents = [...projectConfig.agents];
    newAgents.splice(index, 1);
    updateProjectConfig({ agents: newAgents });
  };

  const handleAddAgent = () => {
    const newAgent: AgentConfig = {
      id: crypto.randomUUID(),
      name: `New Agent ${projectConfig.agents.length + 1}`,
      description: "Description of what this agent does.",
      agentType: "ORCHESTRATION",
      promptType: "ORCHESTRATION",
      apiFormat: "MESSAGES",
      promptTemplate: "Enter your YAML prompt here",
      enabled: true,
    };
    updateProjectConfig({ agents: [...projectConfig.agents, newAgent] });
  };

  const handleFetchAgents = async () => {
    if (!projectConfig.aws.region || !projectConfig.aws.assistantId) {
      setFetchError("Please set AWS Region and Assistant ID in Settings first.");
      return;
    }
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/aws/agents?region=${projectConfig.aws.region}&assistantId=${projectConfig.aws.assistantId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch agents");
      
      const fetchedAgents: AgentConfig[] = data.agents || [];
      const currentNames = new Set(projectConfig.agents.map(a => a.name));
      
      // Skip agents with duplicate names (as per plan decision)
      const newAgents = fetchedAgents.filter(a => !currentNames.has(a.name));
      
      if (newAgents.length > 0) {
        updateProjectConfig({ agents: [...projectConfig.agents, ...newAgents] });
        if (newAgents.length < fetchedAgents.length) {
          alert(`Imported ${newAgents.length} agents. Skipped ${fetchedAgents.length - newAgents.length} duplicates.`);
        } else {
          alert(`Successfully imported ${newAgents.length} agents.`);
        }
      } else {
        alert("No new unique agents found to import.");
      }
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your AI agents or import existing ones from AWS.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {projectConfig.agents.length > 0 && (
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{projectConfig.agents.filter(a => a.enabled).length}</span>
              {" of "}
              <span className="font-semibold text-gray-700">{projectConfig.agents.length}</span>
              {" selected for deployment"}
            </span>
          )}
          {projectConfig.agents.length > 1 && (
            <>
              <button
                onClick={() => updateProjectConfig({ agents: projectConfig.agents.map(a => ({ ...a, enabled: true })) })}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Select All
              </button>
              <button
                onClick={() => updateProjectConfig({ agents: projectConfig.agents.map(a => ({ ...a, enabled: false })) })}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Deselect All
              </button>
            </>
          )}
          <button
            onClick={handleFetchAgents}
            disabled={isFetching}
            className="px-4 py-2 bg-white text-blue-600 font-medium text-sm rounded-md shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isFetching ? "Fetching..." : "Fetch from AWS"}
          </button>
          <button
            onClick={handleAddAgent}
            className="px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Add New Agent
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
          {fetchError}
        </div>
      )}

      {projectConfig.agents.length === 0 ? (
        <div className="text-center p-12 bg-white border border-gray-200 rounded-lg border-dashed">
          <p className="text-gray-500 mb-4">No agents configured.</p>
          <button onClick={handleAddAgent} className="text-blue-600 font-medium hover:underline">
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {projectConfig.agents.map((agent, index) => (
            <AgentConfigCard 
              key={agent.id}
              config={agent}
              onChange={(updated) => handleUpdateAgent(index, updated)}
              onRemove={() => handleRemoveAgent(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
