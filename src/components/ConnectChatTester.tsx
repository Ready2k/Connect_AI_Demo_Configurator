"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { Loader2, Send, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";

type ChatStatus = "idle" | "starting" | "connected" | "ended" | "failed";

interface FlowOption {
  id: string;
  name: string;
}

interface ConnectChatTesterProps {
  discoveredFlows: FlowOption[];
}

interface ChatMessage {
  id: string;
  role: "CUSTOMER" | "AGENT" | "SYSTEM";
  displayName: string;
  text: string;
  time: string;
}

const ROLE_STYLES = {
  CUSTOMER: {
    bubble: "bg-purple-600 text-white rounded-br-none ml-auto",
    label: "text-right text-purple-200",
    wrapper: "justify-end",
  },
  AGENT: {
    bubble: "bg-gray-100 text-gray-800 rounded-bl-none mr-auto border border-gray-200",
    label: "text-left text-gray-400",
    wrapper: "justify-start",
  },
  SYSTEM: {
    bubble: "bg-yellow-50 text-yellow-700 text-xs italic mx-auto rounded-md text-center py-1.5 px-3 border border-yellow-100",
    label: "hidden",
    wrapper: "justify-center w-full",
  },
};

const STATUS_BADGES = {
  idle: "bg-gray-100 text-gray-600",
  starting: "bg-amber-100 text-amber-700 animate-pulse",
  connected: "bg-green-100 text-green-700 border border-green-200",
  ended: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-700",
};

export function ConnectChatTester({ discoveredFlows }: ConnectChatTesterProps) {
  const { projectConfig } = useProjectStore();
  
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [participantName, setParticipantName] = useState("Test Customer");
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [polling, setPolling] = useState(false);

  const connectionTokenRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isPollingActive = useRef<boolean>(false);

  // Automatically scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch the latest transcript from the active connection
  const fetchTranscript = useCallback(async (forceSilent = false) => {
    if (!connectionTokenRef.current) return;
    if (!forceSilent) setPolling(true);
    try {
      const res = await fetch("/api/aws/connect/chat/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionToken: connectionTokenRef.current,
          region: projectConfig.aws.connectRegion,
        }),
      });

      const data = await res.json() as {
        transcript?: Array<{
          id: string;
          type: string;
          participantRole?: "CUSTOMER" | "AGENT" | "SYSTEM";
          displayName?: string;
          content?: string;
          contentType?: string;
          absoluteTime?: string;
        }>;
        error?: string;
      };

      if (data.error) throw new Error(data.error);

      if (data.transcript) {
        // Filter out event-type items that do not contain text content unless they are joining announcements
        const parsed: ChatMessage[] = data.transcript
          .map((item) => {
            let parsedText = item.content || `[No Content] Type: ${item.type}`;
            if (item.contentType && item.contentType !== "text/plain" && item.contentType !== "text/markdown") {
              parsedText = `[${item.contentType}] ${parsedText}`;
            }
            return {
              id: item.id,
              role: item.participantRole || "SYSTEM",
              displayName: item.displayName || (item.participantRole === "CUSTOMER" ? "Customer" : "System"),
              text: parsedText,
              time: item.absoluteTime ? new Date(item.absoluteTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
            };
          });

        setMessages((prev) => {
          const sysInit = prev.find(m => m.id === "sys-init");
          const sysEnded = prev.find(m => m.id === "sys-ended");
          const newMessages = [...parsed];
          if (sysInit) newMessages.unshift(sysInit);
          if (sysEnded) newMessages.push(sysEnded);
          return newMessages;
        });
      }
    } catch (err: unknown) {
      console.error("Transcript polling error:", err);
      // Don't kill the session on a temporary network fail, but log it
    } finally {
      if (!forceSilent) setPolling(false);
    }
  }, [projectConfig.aws.connectRegion]);

  // Polling loop when connected
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (chatStatus === "connected" && connectionTokenRef.current) {
      isPollingActive.current = true;
      // Fetch immediately
      fetchTranscript(true);

      // Setup 2-second polling interval
      intervalId = setInterval(() => {
        if (isPollingActive.current) {
          fetchTranscript(true);
        }
      }, 2000);
    } else {
      isPollingActive.current = false;
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [chatStatus, fetchTranscript]);

  // Start chat session
  const handleStartChat = async () => {
    if (!selectedFlowId || chatStatus === "starting" || chatStatus === "connected") return;
    setChatStatus("starting");
    setErrorMessage(null);
    setMessages([]);
    connectionTokenRef.current = null;

    try {
      const res = await fetch("/api/aws/connect/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactFlowId: selectedFlowId,
          participantName,
          region: projectConfig.aws.connectRegion,
          connectInstanceId: projectConfig.aws.connectInstanceId,
        }),
      });

      const data = await res.json() as {
        contactId?: string;
        participantToken?: string;
        connectionToken?: string;
        error?: string;
      };

      if (data.error) throw new Error(data.error);
      if (!data.connectionToken) throw new Error("No ConnectionToken returned");

      connectionTokenRef.current = data.connectionToken;
      setChatStatus("connected");
      
      // Inject local starting system log
      setMessages([
        {
          id: "sys-init",
          role: "SYSTEM",
          displayName: "System",
          text: `Chat session started for ${participantName}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize chat";
      setErrorMessage(`Chat session start failed: ${msg}`);
      setChatStatus("failed");
    }
  };

  // Stop chat session
  const handleEndChat = () => {
    setChatStatus("ended");
    isPollingActive.current = false;
    connectionTokenRef.current = null;
    setMessages((prev) => [
      ...prev,
      {
        id: "sys-ended",
        role: "SYSTEM",
        displayName: "System",
        text: "Chat session closed.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !connectionTokenRef.current || sending) return;

    const messageToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const res = await fetch("/api/aws/connect/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionToken: connectionTokenRef.current,
          message: messageToSend,
          region: projectConfig.aws.connectRegion,
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string };
      if (data.error) throw new Error(data.error);

      // Perform an immediate fetch of transcript so the customer message and Lex/Agent responses appear quickly
      await fetchTranscript(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setErrorMessage(`Failed to deliver message: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Session Configurations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Flow</label>
          <select
            className="block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:border-purple-500 focus:ring-purple-500 sm:text-sm bg-white"
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            disabled={chatStatus === "starting" || chatStatus === "connected"}
          >
            <option value="">-- Select a discovered flow --</option>
            {discoveredFlows.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Name</label>
          <input
            type="text"
            className="block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:border-purple-500 focus:ring-purple-500 sm:text-sm bg-white"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            disabled={chatStatus === "starting" || chatStatus === "connected"}
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-3">
        {chatStatus !== "connected" && chatStatus !== "starting" ? (
          <button
            onClick={handleStartChat}
            disabled={!selectedFlowId}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all text-sm font-semibold shadow-sm hover:shadow active:scale-95"
          >
            Start Chat Session
          </button>
        ) : (
          <button
            onClick={handleEndChat}
            className="px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-semibold shadow-sm active:scale-95"
          >
            End Chat Session
          </button>
        )}

        {chatStatus === "connected" && (
          <button
            onClick={() => fetchTranscript(false)}
            disabled={polling}
            title="Force transcript refresh"
            className="p-2.5 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
          >
            {polling ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        )}

        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${STATUS_BADGES[chatStatus]}`}>
          {chatStatus === "starting" ? "Connecting..." : chatStatus}
        </span>
      </div>

      {/* Chat Sandbox Window */}
      {(chatStatus === "connected" || chatStatus === "ended" || messages.length > 0) && (
        <div className="flex flex-col border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden h-[420px]">
          {/* Box Header */}
          <div className="bg-gradient-to-r from-purple-550 to-indigo-650 px-4 py-3 border-b border-gray-100 flex items-center justify-between text-white" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="font-semibold text-sm">Connect Chat Sandbox</span>
            </div>
            {chatStatus === "connected" && (
              <div className="flex items-center gap-1.5 text-xs text-purple-100 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                Live Connection
              </div>
            )}
          </div>

          {/* Transcript Panel */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <MessageSquare className="w-8 h-8 opacity-40 text-purple-500" />
                <p className="text-xs">Connection initialized. Send a greeting to start the contact flow.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const styles = ROLE_STYLES[msg.role] || ROLE_STYLES.SYSTEM;
                return (
                  <div key={msg.id} className={`flex flex-col ${styles.wrapper} max-w-[85%] mx-auto w-full`}>
                    <span className={`text-[10px] font-semibold text-gray-400 mb-0.5 px-1 ${styles.label}`}>
                      {msg.displayName} · {msg.time}
                    </span>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${styles.bubble}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Footer */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={chatStatus === "connected" ? "Type your reply to the bot/agent..." : "Chat session is inactive."}
              disabled={chatStatus !== "connected" || sending}
              className="flex-1 rounded-lg border-gray-300 shadow-sm p-2.5 border focus:border-purple-500 focus:ring-purple-500 sm:text-sm bg-gray-50/50 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={chatStatus !== "connected" || !inputText.trim() || sending}
              className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 text-white disabled:text-gray-400 rounded-lg transition-all shadow-sm disabled:shadow-none hover:shadow active:scale-95 shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}

      {/* Error Output */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-semibold">Chat Sandbox Error</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
