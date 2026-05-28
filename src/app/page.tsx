"use client";
import { useProjectStore } from "@/store/projectStore";
import Link from "next/link";
import { Download, Upload, Settings, Bot, Eye, Rocket, Network, Search, Workflow } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { addLog } from "@/store/logStore";

export default function Home() {
  const { projectConfig, setProjectConfig } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectConfig, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", projectConfig.projectName.replace(/\s+/g, '_').toLowerCase() + "_config.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLog("INFO", "Project", `Exported project configuration: ${projectConfig.projectName}`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setProjectConfig(json);
        addLog("SUCCESS", "Project", `Successfully imported project configuration`);
        alert("Configuration imported successfully!");
      } catch (err) {
        addLog("ERROR", "Project", `Failed to parse imported JSON file`);
        alert("Failed to parse JSON file.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect AI Agent Demo Builder</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Configure, preview, and deploy a two-agent Amazon Connect Customer AI demo. 
          Use this tool to safely generate your orchestration prompts and agent payloads.
        </p>
        <div className="mt-6 flex justify-center items-center gap-4 text-sm text-gray-600">
          <span className="bg-gray-100 px-3 py-1 rounded-full">
            <span className="font-semibold text-gray-800">Project:</span> {projectConfig.projectName}
          </span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">
            <span className="font-semibold text-gray-800">Status:</span> {projectConfig.aws.visibilityStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link href="/settings" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group block">
          <Settings className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-gray-800">1. Configure AWS</h3>
          <p className="text-sm text-gray-500 mt-2">Set your region, assistant ID, and deployment mode.</p>
        </Link>
        <Link href="/agents" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group block">
          <Bot className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-gray-800">2. Configure Agents</h3>
          <p className="text-sm text-gray-500 mt-2">Edit YAML templates for the intent router and lost card agents.</p>
        </Link>
        <Link href="/preview" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group block">
          <Eye className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-gray-800">3. Preview Payloads</h3>
          <p className="text-sm text-gray-500 mt-2">Review the generated JSON API payloads before deploying.</p>
        </Link>
        <Link href="/deploy" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group block">
          <Rocket className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-gray-800">4. Deploy</h3>
          <p className="text-sm text-gray-500 mt-2">Push your configuration to Amazon Q in Connect.</p>
        </Link>
        <Link href="/flow-helper" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group block">
          <Network className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-lg font-semibold text-gray-800">5. Flow Helper</h3>
          <p className="text-sm text-gray-500 mt-2">View routing decisions and integration payloads.</p>
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <span className="w-1 h-5 bg-purple-500 rounded-full inline-block" />
          Experience Builder
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link href="/flow-discovery" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group block">
            <Search className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-semibold text-gray-800">6. Flow Discovery</h3>
            <p className="text-sm text-gray-500 mt-2">Discover existing contact flows and extract block schemas.</p>
          </Link>
          <Link href="/experience" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group block">
            <Workflow className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-semibold text-gray-800">7. Experience Builder</h3>
            <p className="text-sm text-gray-500 mt-2">Design, preview, and export a complete contact flow experience.</p>
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Project Management</h2>
        <div className="flex gap-4">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4" /> Export Project JSON
          </button>
          
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            <Upload className="w-4 h-4" /> Import Project JSON
          </button>
        </div>
      </div>
    </div>
  );
}
