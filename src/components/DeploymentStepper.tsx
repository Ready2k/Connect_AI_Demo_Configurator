"use client";
import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { DeployResult } from "@/lib/aws/deployService";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
import { computeDeployedName } from "@/lib/config/nameUtils";
import { addLog } from "@/store/logStore";

export function DeploymentStepper() {
  const { projectConfig } = useProjectStore();
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  
  const [smokeTesting, setSmokeTesting] = useState(false);
  const [smokeTestResult, setSmokeTestResult] = useState<any>(null);

  const handleDeploy = async () => {
    setDeploying(true);
    setResult(null);
    const deploymentTimestamp = Date.now();
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: projectConfig, timestamp: deploymentTimestamp })
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        addLog("SUCCESS", "Deploy", `Successfully deployed ${projectConfig.projectName}`, data.manifest);
      } else {
        addLog("ERROR", "Deploy", `Deployment failed: ${data.error}`);
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message || "An error occurred during deployment" });
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

  const steps = [
    { name: "Validate Configuration", status: "complete" },
    { name: "Check Credentials", status: "complete" },
    ...projectConfig.agents.flatMap(agent => [
      { name: `Create/Update ${agent.name} Prompt`, status: projectConfig.aws.deploymentMode.includes("prompts") ? "pending" : "skipped" },
    ]),
    ...projectConfig.agents.flatMap(agent => [
      { name: `Create/Update ${agent.name} Agent`, status: projectConfig.aws.deploymentMode.includes("agents") ? "pending" : "skipped" },
    ]),
    { name: "Save Manifest", status: "pending" },
  ];

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
            disabled={deploying || smokeTesting}
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
        <ul className="text-sm text-gray-600 space-y-1">
          {projectConfig.agents.map((agent, i) => (
            <li key={i}>
              <strong>{agent.name} Prompt/Agent:</strong> {computeDeployedName(agent.name, projectConfig, Date.now()).replace(/_\d+$/, '_<timestamp>')}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Deployment Steps</h3>
        <ul className="space-y-3">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-center gap-3">
              {step.status === "complete" ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : step.status === "skipped" ? (
                <Circle className="w-5 h-5 text-gray-300" />
              ) : (
                <Circle className="w-5 h-5 text-blue-500" />
              )}
              <span className={"text-sm " + (step.status === "skipped" ? "text-gray-400" : "text-gray-700")}>
                {step.name} {step.status === "skipped" && "(Skipped)"}
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
            <div className="overflow-hidden">
              <h3 className={"font-medium " + (result.success ? "text-green-800" : "text-red-800")}>
                {result.success ? "Deployment Successful" : "Deployment Failed"}
              </h3>
              {result.error && <p className="text-sm text-red-700 mt-1">{result.error}</p>}
              {result.manifest && (
                <div className="mt-3">
                  <p className="text-sm text-green-700 mb-2">Manifest generated:</p>
                  <pre className="text-xs bg-white bg-opacity-60 p-3 rounded border border-green-200 overflow-auto text-green-900 custom-scrollbar max-h-60">
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
