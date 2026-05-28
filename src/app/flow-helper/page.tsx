"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

function CopyBlock({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden mb-6">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700 transition-colors p-1"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto whitespace-pre font-mono">
        {content}
      </div>
    </div>
  );
}

export default function FlowHelperPage() {
  const routerOutputs = `{
  "agentOutput": {
    "intent": "LOST_CARD | RETAINED_CARD | OTHER",
    "confidence": "HIGH | MEDIUM | LOW"
  }
}`;

  const lostCardOutputs = `{
  "agentOutput": {
    "action": "BLOCK_CARD | REPLACE_CARD | HANDOFF",
    "lastFour": "1234",
    "verificationStatus": "PASSED | FAILED"
  }
}`;

  const contactAttributes = `// Set these before invoking the AI Agent in the contact flow
{
  "customerName": "$.Attributes.customerName",
  "accountTier": "$.Attributes.accountTier",
  "authStatus": "$.Attributes.authStatus"
}`;

  const queuePayload = `{
  "handoffReason": "$.Attributes.agentOutput.action",
  "context": "Customer requested card replacement but verification failed."
}`;

  const pseudoFlow = `[Start]
  │
  ├──> [Set Contact Attributes: authStatus, customerName]
  │
  ├──> [Invoke AWS Q Connect AI Agent: CustomerIntentRouter]
  │
  ├──> [Check Attribute: $.Attributes.agentOutput.intent]
  │      ├── (LOST_CARD) ──> [Invoke AWS Q Connect AI Agent: LostCard]
  │      │                     │
  │      │                     ├──> [Check Attribute: $.Attributes.agentOutput.action]
  │      │                            ├── (BLOCK_CARD) ──> [Call Lambda: BlockCard] ──> [Disconnect]
  │      │                            ├── (REPLACE_CARD) ──> [Call Lambda: ReplaceCard] ──> [Disconnect]
  │      │                            └── (HANDOFF) ──> [Transfer to Queue]
  │      │
  │      ├── (RETAINED_CARD) ──> [Transfer to Queue: Retained Specialist]
  │      │
  │      └── (OTHER) ──> [Transfer to Queue: General Customer Service]
`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flow Integration Helper</h1>
        <p className="text-sm text-gray-500 mt-1">
          Use these snippets and pseudo-diagrams to configure your Amazon Connect Contact Flows.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">1. Pseudo Contact Flow Diagram</h2>
          <p className="text-sm text-gray-600 mb-4">
            This diagram illustrates the high-level routing logic you should implement in your Contact Flow using the "Invoke AWS Q Connect AI Agent" block.
          </p>
          <CopyBlock title="Contact Flow Routing Logic" content={pseudoFlow} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">2. Contact Attributes</h2>
          <p className="text-sm text-gray-600 mb-4">
            Pass these attributes into the AI Agent step so the Orchestration Prompt can access them via the <code>{"{{$.Attributes.*}}"}</code> syntax.
          </p>
          <CopyBlock title="Set Contact Attributes Block" content={contactAttributes} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">3. Expected Agent Outputs</h2>
          <p className="text-sm text-gray-600 mb-4">
            The Orchestration Prompts are instructed to return these JSON structures. You will extract them in your flow using the "Check Contact Attributes" block.
          </p>
          <CopyBlock title="CustomerIntentRouter Expected Output" content={routerOutputs} />
          <CopyBlock title="LostCard Expected Output" content={lostCardOutputs} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">4. Queue Handoff Payload</h2>
          <p className="text-sm text-gray-600 mb-4">
            When routing a user to a human agent, pass this payload in the ScreenPop or transfer parameters so the agent has context.
          </p>
          <CopyBlock title="Transfer to Queue Parameters" content={queuePayload} />
        </section>
      </div>
    </div>
  );
}
