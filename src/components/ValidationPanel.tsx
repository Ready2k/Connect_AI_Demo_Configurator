import { ValidationResult } from "@/lib/prompts/validatePrompt";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ValidationPanel({ result }: { result: ValidationResult | null }) {
  if (!result) return null;
  if (result.isValid) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-md flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 mt-0.5" />
        <div>
          <h3 className="font-medium">Prompt is valid</h3>
          <p className="text-sm">YAML parses correctly and all rules are met.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start gap-3">
      <AlertCircle className="w-5 h-5 mt-0.5" />
      <div>
        <h3 className="font-medium">Validation Errors</h3>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          {result.errors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
