"use client";
import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { DeployResult } from "@/lib/aws/deployService";
import { CheckCircle2, Circle, AlertCircle, Loader2, XCircle } from "lucide-react";
import { computeDeployedName } from "@/lib/config/nameUtils";
import { addLog } from "@/store/logStore";
import { AgentConfig } from "@/types/project";

type StepStatus = "pending" | "in_progress" | "complete" | "skipped" | "error";

interface Step {
  id: string;
  name: string;
  status: StepStatus;
}

function buildSteps(enabledAgents: AgentConfig[], deploymentMode: string): Step[] {
  return [
    { id: "validate", name: "Validate Configuration", status: "complete" },
    { id: "credentials", name: "Check Credentials", status: "complete" },
    ...enabledAgents.map((agent, i) => ({
      id: `prompt_${i}`,
      name: `Create ${agent.name} Prompt`,
      status: (deploymentMode.includes("prompts") ? "pending" : "skipped") as StepStatus,
    })),
    ...enabledAgents.map((agent, i) => ({
      id: `agent_${i}`,
      name: `Create ${agent.name} Agent`,
      status: (deploymentMode.includes("agents") ? "pending" : "skipped") as StepStatus,
    })),
    { id: "manifest", name: "Save Manifest", status: "pending" as StepStatus },
  ];
}

export function DeploymentStepper() {
  const { projectConfig } = useProjectStore();
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [smokeTesting, setSmokeTesting] = useState(false);
  const [smokeTestResult, setSmokeTestResult] = useState<any>(null);

  const enabledAgents = projectConfig.agents.filter(a => a.enabled);

  const [deploySteps, setDeploySteps] = useState<Step[]>(() =>
    buildSteps(enabledAgents, projectConfig.aws.deploymentMode)
  );

  const updateStep = (stepId: string, status: StepStatus) => {
    setDeploySteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setResult(null);
    const deploymentTimestamp = Date.now();

    // Reset steps to fresh initial state for this run
    setDeploySteps(buildSteps(enabledAgents, projectConfig.aws.deploymentMode));

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: projectConfig, timestamp: deploymentTimestamp })
      });

      // Pre-flight validation failures return JSON, not SSE
      if (!res.ok) {
        const data = await res.json();
        setResult({ success: false, error: data.error });
        addLog("ERROR", "Deploy", `Deployment failed: ${data.error}`);
        return;
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(part.slice(6));

            if (event.type === "step_start") {
              updateStep(event.stepId, "in_progress");
            } else if (event.type === "step_complete") {
              updateStep(event.stepId, "complete");
            } else if (event.type === "step_error") {
              updateStep(event.stepId, "error");
            } else if (event.type === "done") {
              const deployResult: DeployResult = {
                success: event.success,
                error: event.error,
                manifest: event.manifest,
              };
              setResult(deployResult);
              if (event.success) {
                setDeploySteps(prev =>
                  prev.map(s => s.status === "pending" || s.status === "in_progress"
                    ? { ...s, status: "complete" }
                    : s
                  )
                );
                addLog("SUCCESS", "Deploy", `Successfully deployed ${projectConfig.projectName}`, event.manifest);
              } else {
                // Mark any step still in_progress as error
                setDeploySteps(prev =>
                  prev.map(s => s.status === "in_progress" ? { ...s, status: "error" } : s)
                );
                addLog("ERROR", "Deploy", `Deployment failed: ${event.error}`);
              }
            }
          } catch {
            // Ignore malformed SSE events
          }
        }
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message || "An error occurred during deployment" });
      setDeploySteps(prev => prev.map(s => s.status === "in_progress" ? { ...s, status: "error" } : s));
      addLog("ERROR", "Deploy", `Deployment error: ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleSmokeTest = async () => {
    setSmokeTesting(true);
    setSmokeTestResult(null);
    try {
      const res = await fetch("/api/smoke-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: projectConfig })
      });
      const data = await res.json();
      setSmokeTestResult(data);
      if (data.success) {
        addLog("SUCCESS", "Smoke Test", "Smoke test passed successfully", data);
      } else {
        addLog("ERROR", "Smoke Test", `Smoke test failed: ${data.message || data.error}`, data);
      }
    } catch (e: any) {
      setSmokeTestResult({ success: false, error: e.message || "An error occurred during smoke test" });
      addLog("ERROR", "Smoke Test", `Smoke test error: ${e.message}`);
    } finally {
      setSmokeTesting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Deploy to AWS</h2>
          <p className="text-sm text-gray-500 mt-1">
            Mode: <span className="font-semibold text-gray-700">{projectConfig.aws.deploymentMode}</span>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleSmokeTest}
            disabled={smokeTesting || deploying}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-md font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
          >
            {smokeTesting && <Loader2 className="w-4 h-4 animate-spin" />}
            {smokeTesting ? "Testing..." : "Run Smoke Test"}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || smokeTesting || enabledAgents.length === 0}
            title={enabledAgents.length === 0 ? "Enable at least one agent on the Agents page" : undefined}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
          >
            {deploying && <Loader2 className="w-4 h-4 animate-spin" />}
            {deploying ? "Deploying..." : "Deploy to AWS"}
          </button>
        </div>
      </div>

      {smokeTestResult && (
        <div className={"p-4 rounded-md border " + (smokeTestResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
          <div className="flex items-start gap-3">
            {smokeTestResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="overflow-hidden">
              <h3 className={"font-medium " + (smokeTestResult.success ? "text-green-800" : "text-red-800")}>
                Smoke Test {smokeTestResult.success ? "Passed" : "Failed"}
              </h3>
              <p className={"text-sm mt-1 " + (smokeTestResult.success ? "text-green-700" : "text-red-700")}>
                {smokeTestResult.message || smokeTestResult.error}
              </p>
              {smokeTestResult.checks && (
                <ul className="text-xs mt-3 space-y-1">
                  {Object.entries(smokeTestResult.checks).map(([key, passed]) => (
                    <li key={key} className="flex items-center gap-2">
                      {passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                      <span className={passed ? "text-green-700" : "text-red-700"}>{key}</span>
                    </li>
                  ))}
                </ul>
              )}
              {smokeTestResult.cleanupWarning && (
                <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-xs">
                  <strong>Cleanup Warning:</strong> {smokeTestResult.cleanupWarning}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Target Deployment Names</h3>
        {enabledAgents.length === 0 ? (
          <p className="text-sm text-amber-600">No agents selected for deployment. Enable at least one agent on the Agents page.</p>
        ) : (
          <ul className="text-sm text-gray-600 space-y-1">
            {enabledAgents.map((agent, i) => (
              <li key={i}>
                <strong>{agent.name} Prompt/Agent:</strong> {computeDeployedName(agent.name, projectConfig, Date.now()).replace(/_\d+$/, '_<timestamp>')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Deployment Steps</h3>
        <ul className="space-y-3">
          {deploySteps.map((step) => (
            <li key={step.id} className="flex items-center gap-3">
              {step.status === "complete" ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : step.status === "in_progress" ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
              ) : step.status === "error" ? (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              ) : step.status === "skipped" ? (
                <Circle className="w-5 h-5 text-gray-300 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-blue-300 shrink-0" />
              )}
              <span className={
                step.status === "skipped" ? "text-sm text-gray-400" :
                step.status === "error" ? "text-sm text-red-600" :
                step.status === "in_progress" ? "text-sm text-blue-700 font-medium" :
                step.status === "complete" ? "text-sm text-gray-700" :
                "text-sm text-gray-500"
              }>
                {step.name}
                {step.status === "skipped" && " (Skipped)"}
                {step.status === "in_progress" && "…"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {result && (
        <div className={"p-4 rounded-md border " + (result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="overflow-hidden w-full">
              <h3 className={"font-medium " + (result.success ? "text-green-800" : "text-red-800")}>
                {result.success ? "Deployment Successful" : "Deployment Failed"}
              </h3>
              {result.error && <p className="text-sm text-red-700 mt-1">{result.error}</p>}
              {result.manifest?.agents.some(a => a.error) && (
                <div className="mt-3 space-y-2">
                  {result.manifest.agents.filter(a => a.error).map((a, i) => (
                    <div key={i} className="p-3 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                      <strong>{a.baseName} Agent:</strong> {a.error}
                    </div>
                  ))}
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 space-y-1">
                    <p className="font-semibold">Recovery steps:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Go to the AWS Console → Amazon Q in Connect → your assistant → AI Prompts and delete the prompts created in this run (named with this deployment&apos;s timestamp).</li>
                      <li>Fix the IAM permissions blocking agent creation, or create the agent manually in the Console using the prompt ARN shown in the manifest.</li>
                      <li>Switch the Deployment Mode to <strong>create_agents_only</strong> in Settings and re-deploy once the prompts are already present.</li>
                    </ol>
                  </div>
                </div>
              )}
              {result.manifest && (
                <div className="mt-3">
                  <p className={"text-sm mb-2 " + (result.success ? "text-green-700" : "text-red-700")}>Manifest generated:</p>
                  <pre className={"text-xs bg-white bg-opacity-60 p-3 rounded border overflow-auto custom-scrollbar max-h-60 " + (result.success ? "border-green-200 text-green-900" : "border-red-200 text-red-900")}>
                    {JSON.stringify(result.manifest, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
