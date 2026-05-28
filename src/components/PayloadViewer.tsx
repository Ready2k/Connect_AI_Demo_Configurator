"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface PayloadViewerProps {
  title: string;
  payload: any;
}

export function PayloadViewer({ title, payload }: PayloadViewerProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden shadow-sm">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">{title}</h3>
        <button 
          onClick={copyToClipboard}
          className="text-gray-400 hover:text-white transition-colors"
          title="Copy JSON"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="p-4 overflow-auto max-h-96 custom-scrollbar">
        <pre className="text-xs text-gray-300 font-mono">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
