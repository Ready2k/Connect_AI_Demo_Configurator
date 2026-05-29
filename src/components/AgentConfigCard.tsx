"use client";
import { AgentConfig, AgentToolConfig, AgentGuardrailConfig, AwsSettings } from "@/types/project";
import { PromptEditor } from "./PromptEditor";
import { useState } from "react";

interface AgentConfigCardProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  onRemove: () => void;
  onClose: () => void;
  aws?: AwsSettings;
}

const LOCALES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "es_US", label: "Spanish (US)" },
  { value: "fr_FR", label: "French (France)" },
  { value: "de_DE", label: "German (Germany)" },
  { value: "ja_JP", label: "Japanese" },
];

const MOCK_SECURITY_PROFILES = [
  "Admin",
  "Agent",
  "CallCenterManager",
  "QualityAnalyst",
  "Supervisor"
];

export function AgentConfigCard({ config, onChange, onRemove, onClose, aws }: AgentConfigCardProps) {
  const [activeTab, setActiveTab] = useState<"details" | "prompts" | "tools" | "security" | "guardrails">("details");

  const handleSaveDraft = () => {
    onChange({ ...config, visibilityStatus: "SAVED" });
    onClose();
  };

  const handlePublish = () => {
    onChange({ ...config, visibilityStatus: "PUBLISHED" });
    onClose();
  };

  const addTool = () => {
    const newTool: AgentToolConfig = {
      name: `NewTool_${(config.tools?.length || 0) + 1}`,
      toolType: "RETURN_TO_CONTROL",
      description: "Description of tool",
      permissions: "Sufficient"
    };
    onChange({ ...config, tools: [...(config.tools || []), newTool] });
  };

  return (
    <div className="bg-gray-50 flex flex-col h-full rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agent builder: {config.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.visibilityStatus === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.visibilityStatus === "PUBLISHED" ? "bg-green-500" : "bg-gray-400"}`}></span>
              Latest: {config.visibilityStatus === "PUBLISHED" ? "Published" : "Draft"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Cancel
          </button>
          <button onClick={handleSaveDraft} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Save
          </button>
          <button onClick={handlePublish} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Publish
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50">
        
        {/* Details Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-gray-900">Details</h3>
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Deployable</span>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input 
                type="text" 
                value={config.name}
                onChange={e => onChange({ ...config, name: e.target.value })}
                className="w-full sm:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Valid characters are a-z, A-Z, 0-9, underscore (_), period (.), hyphen (-), and comma (,). The name must be 1 to 255 characters.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent type</label>
              <div className="w-full sm:w-1/2 p-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600 cursor-not-allowed">
                {config.agentType}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea 
                value={config.description}
                onChange={e => onChange({ ...config, description: e.target.value })}
                rows={3}
                placeholder="Enter description"
                className="w-full sm:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Valid characters are a-z, A-Z, 0-9, underscore (_), period (.), hyphen (-), and comma (,). The description must be 1 to 255 characters.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Format <span className="text-xs font-normal text-gray-500 ml-2">(Deployable)</span></label>
              <select
                className="w-full sm:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={config.apiFormat}
                onChange={(e) => onChange({ ...config, apiFormat: e.target.value as "MESSAGES" | "TEXT_COMPLETIONS" })}
              >
                <option value="MESSAGES">MESSAGES</option>
                <option value="TEXT_COMPLETIONS">TEXT_COMPLETIONS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Locales Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Locales</h3>
              <p className="text-sm text-gray-500">The locale that determines the response language for the LLM.</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Deployable</span>
          </div>
          
          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search by language</label>
            <select
              value={config.locale || "en_US"}
              onChange={e => onChange({ ...config, locale: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {LOCALES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Only 1 locale can be specified at a time.</p>
          </div>
        </div>

        {/* Security Profiles Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
           <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Security Profiles</h3>
              <p className="text-sm text-gray-500">Security Profiles provide specific permissions for agentic capabilities that your AI agents need in order to invoke tools.</p>
              <p className="text-sm text-gray-500 mt-2">For agent assistance use cases, Connect follows a principle of least privilege. The human agent must have the same security profile permissions as the AI agent for an action to be performed.</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded border border-gray-200 whitespace-nowrap">Local metadata only</span>
          </div>
          
          <div className="w-full sm:w-1/2 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Security Profiles</label>
            <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[42px] bg-white">
              {(config.securityProfiles || []).map(profile => (
                <span key={profile} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                  {profile}
                  <button type="button" className="ml-1.5 text-blue-600 hover:text-blue-800" onClick={() => onChange({ ...config, securityProfiles: config.securityProfiles?.filter(p => p !== profile) })}>×</button>
                </span>
              ))}
              <select
                className="bg-transparent border-none focus:ring-0 text-sm flex-1 outline-none min-w-[150px]"
                onChange={e => {
                  if (e.target.value && !config.securityProfiles?.includes(e.target.value)) {
                    onChange({ ...config, securityProfiles: [...(config.securityProfiles || []), e.target.value] });
                  }
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>Search profiles...</option>
                {MOCK_SECURITY_PROFILES.filter(p => !config.securityProfiles?.includes(p)).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tools Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
           <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Tools ({config.tools?.length || 0})</h3>
              <p className="text-sm text-gray-500">Tools provide agentic capabilities that your AI agents can use to perform actions and access external systems.</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Deployable</span>
          </div>

          <div className="flex gap-2 mb-4">
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>Remove</button>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>Edit</button>
            <button onClick={addTool} className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white border border-gray-300 rounded hover:bg-gray-50">Add tool</button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(config.tools || []).map((tool, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap"><input type="radio" name="tool_select" className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{tool.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={tool.description}>{tool.description || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{tool.namespace || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{tool.permissions || "-"}</td>
                  </tr>
                ))}
                {(!config.tools || config.tools.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No tools configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prompts Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Prompts ({config.prompts?.length || 1})</h3>
              <p className="text-sm text-gray-500">Prompts are specific set of input that guides your AI agents to generate an appropriate response or output for a given task or instruction.</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Deployable</span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(config.prompts || [{ name: config.name, status: "Published", version: "1", type: "Orchestration" }]).map((prompt, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap"><input type="radio" name="prompt_select" defaultChecked={idx === 0} className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600 cursor-pointer">{prompt.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{prompt.status}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{prompt.version}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{prompt.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-md font-semibold text-gray-800">Edit Prompt Template</h4>
              <span className="text-xs font-medium text-gray-500">Format: YAML</span>
            </div>
            <PromptEditor
              value={config.promptTemplate}
              onChange={(val) => onChange({ ...config, promptTemplate: val })}
              onReset={() => onChange({ ...config, promptTemplate: "" })}
              agentName={config.name}
              aws={aws}
            />
          </div>
        </div>

        {/* Guardrails Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Guardrails ({config.guardrails?.length || 0})</h3>
              <p className="text-sm text-gray-500">AI Guardrails are used to implement specific safeguards based on your use cases and responsible AI policies.</p>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-800 rounded border border-yellow-200 whitespace-nowrap">Not yet wired</span>
          </div>

          <div className="flex gap-2 mb-4">
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>Remove</button>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>Edit</button>
            <button className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white border border-gray-300 rounded hover:bg-gray-50" onClick={() => {
              const newG = { name: `Guardrail_${(config.guardrails?.length||0)+1}`, status: "Draft" as const, version: "1", type: "ContentPolicy" };
              onChange({ ...config, guardrails: [...(config.guardrails||[]), newG as AgentGuardrailConfig]});
            }}>Add guardrail</button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(config.guardrails || []).map((g, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap"><input type="radio" name="guardrail_select" className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{g.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{g.status}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{g.version}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{g.type}</td>
                  </tr>
                ))}
                {(!config.guardrails || config.guardrails.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No guardrails configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Zone */}
        <div className="pt-8 pb-4">
          <button onClick={onRemove} className="text-red-600 hover:text-red-800 text-sm font-medium">
            Delete Agent
          </button>
        </div>
      </div>
    </div>
  );
}
