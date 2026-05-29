"use client";
import { useState } from "react";
import { ValidationResult } from "@/lib/prompts/validatePrompt";
import { ValidationPanel } from "./ValidationPanel";

interface PromptEditorProps {
  value: string;
  onChange: (val: string) => void;
  onReset: () => void;
  agentName?: string;
  aws?: { modelId: string; region: string };
}

export function PromptEditor({ value, onChange, onReset, agentName, aws }: PromptEditorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [showGenerator, setShowGenerator] = useState(false);
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const validate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch("/api/validate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: value }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ isValid: false, errors: ["Failed to call validation API"] });
    } finally {
      setIsValidating(false);
    }
  };

  const generate = async () => {
    if (!description.trim()) return;
    if (!aws?.modelId || !aws?.region) {
      setGenerateError("AI model and region must be set in Settings before generating a prompt.");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          agentName: agentName?.trim() || undefined,
          modelId: aws.modelId,
          region: aws.region,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onChange(data.promptYaml);
      setValidationResult(null);
      setShowGenerator(false);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !!aws?.modelId && !!aws?.region;

  return (
    <div className="space-y-4">
      {/* Generate with AI panel */}
      {canGenerate && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowGenerator((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <span className="text-sm font-medium text-blue-700">Generate with AI</span>
              <span className="text-xs text-blue-500">Describe what you want this agent to do</span>
            </div>
            <svg
              className={`w-4 h-4 text-blue-500 transition-transform ${showGenerator ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showGenerator && (
            <div className="p-4 bg-white border-t border-blue-100 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Describe what this agent should do
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`e.g. "A lost card specialist agent that helps customers report a lost or stolen card, verifies their identity, blocks the card, and arranges a replacement. It should be calm and empathetic, handle distressed customers carefully, and escalate suspected fraud to a human agent."`}
                className="w-full p-3 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 resize-none"
              />
              {generateError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {generateError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={generate}
                  disabled={isGenerating || !description.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isGenerating && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {isGenerating ? "Generating..." : "Generate prompt"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowGenerator(false); setGenerateError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <p className="text-xs text-gray-400 ml-auto">
                  Uses {aws.modelId.split(".").slice(-1)[0] || aws.modelId} via Bedrock
                </p>
              </div>
              {value && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Generating will replace the current prompt template. You can edit it afterwards.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={validate}
          disabled={isValidating}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isValidating ? "Validating..." : "Validate YAML"}
        </button>
        <button
          onClick={() => { onReset(); setValidationResult(null); }}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Reset to Default
        </button>
      </div>

      <ValidationPanel result={validationResult} />

      <textarea
        className="w-full h-96 font-mono text-sm border-gray-300 rounded-md shadow-sm p-4 border focus:border-blue-500 focus:ring-blue-500 bg-gray-50 whitespace-pre"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setValidationResult(null);
        }}
      />
    </div>
  );
}
