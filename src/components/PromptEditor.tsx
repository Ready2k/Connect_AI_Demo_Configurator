"use client";
import { useState } from "react";
import { ValidationResult } from "@/lib/prompts/validatePrompt";
import { ValidationPanel } from "./ValidationPanel";

interface PromptEditorProps {
  value: string;
  onChange: (val: string) => void;
  onReset: () => void;
}

export function PromptEditor({ value, onChange, onReset }: PromptEditorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validate = async () => {
    setIsValidating(true);
    try {
      const res = await fetch("/api/validate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: value })
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (e) {
      setValidationResult({ isValid: false, errors: ["Failed to call validation API"] });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
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
          setValidationResult(null); // Clear validation on edit
        }}
      />
    </div>
  );
}
