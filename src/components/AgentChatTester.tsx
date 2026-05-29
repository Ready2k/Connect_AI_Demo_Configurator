import React, { useState, useRef, useEffect } from "react";
import yaml from "js-yaml";
import { AgentConfig, AwsSettings } from "@/types/project";
import { Loader2, Send } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentChatTesterProps {
  config: AgentConfig;
  aws?: AwsSettings;
}

export function AgentChatTester({ config, aws }: AgentChatTesterProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractSystemPrompt = (): string => {
    if (config.apiFormat === "MESSAGES") {
      try {
        const parsed = yaml.load(config.promptTemplate) as any;
        if (parsed && typeof parsed === "object" && parsed.system) {
          return String(parsed.system);
        }
        return "You are an AI assistant.";
      } catch (e) {
        return "You are an AI assistant. (Failed to parse YAML system prompt)";
      }
    } else {
      // For TEXT_COMPLETIONS, the whole template serves as the system instruction
      return config.promptTemplate;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!aws?.region || !aws?.modelId) {
      setError("AWS Region and Model ID must be configured in Settings to test the agent.");
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setError(null);
    setIsTyping(true);

    try {
      const systemPrompt = extractSystemPrompt();
      
      // Map local messages to Bedrock's expected format
      const bedrockMessages = newMessages.map(m => ({
        role: m.role,
        content: [{ text: m.content }]
      }));

      const res = await fetch("/api/aws/bedrock/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: aws.modelId,
          region: aws.region,
          messages: bedrockMessages,
          systemPrompt: systemPrompt
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let assistantMessageContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantMessageContent += chunk;
        
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantMessageContent };
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during chat");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[500px] border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 border-b border-gray-200 p-3 flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Test Agent</h3>
          <p className="text-xs text-gray-500">Conversing with Model: {aws?.modelId || "Not Set"}</p>
        </div>
        <button 
          onClick={() => setMessages([])} 
          className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2 py-1 bg-white"
        >
          Clear Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <p className="text-sm">Start chatting to test your agent's prompt.</p>
            <p className="text-xs mt-2">The AI uses the current draft of your Prompt Template.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
              msg.role === "user" 
                ? "bg-blue-600 text-white" 
                : "bg-gray-100 text-gray-800 border border-gray-200"
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 border border-gray-200 rounded-lg p-3 text-sm flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-2 text-xs border-t border-red-200 shrink-0">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="p-3 bg-white border-t border-gray-200 shrink-0 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isTyping}
          className="flex-1 resize-none h-[42px] min-h-[42px] max-h-32 p-2.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm custom-scrollbar"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="bg-blue-600 text-white rounded-md px-4 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
