"use client";
import { useProjectStore } from "@/store/projectStore";
import { AgentConfigCard } from "@/components/AgentConfigCard";
import { defaultCustomerIntentRouterPrompt } from "@/lib/prompts/customerIntentRouter";
import { defaultLostCardPrompt } from "@/lib/prompts/lostCard";
import { useEffect, useState } from "react";

export default function AgentsPage() {
  const { projectConfig, updateProjectConfig } = useProjectStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <p className="text-sm text-gray-500 mt-1">Configure the Customer Intent Router and Lost Card AI agents.</p>
      </div>

      <div className="space-y-8">
        <AgentConfigCard 
          agentKey="customerIntentRouter"
          config={projectConfig.agents.customerIntentRouter}
          defaultPromptTemplate={defaultCustomerIntentRouterPrompt}
          onChange={(config) => updateProjectConfig({ 
            agents: { ...projectConfig.agents, customerIntentRouter: config } 
          })}
        />
        
        <AgentConfigCard 
          agentKey="lostCard"
          config={projectConfig.agents.lostCard}
          defaultPromptTemplate={defaultLostCardPrompt}
          onChange={(config) => updateProjectConfig({ 
            agents: { ...projectConfig.agents, lostCard: config } 
          })}
        />
      </div>
    </div>
  );
}
