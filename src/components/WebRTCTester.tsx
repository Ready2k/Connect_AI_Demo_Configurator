"use client";

import { useState, useRef } from "react";
import { useProjectStore } from "@/store/projectStore";
import { Loader2 } from "lucide-react";

type CallStatus = "idle" | "connecting" | "in-call" | "ended" | "error";

interface FlowOption {
  id: string;
  name: string;
}

interface WebRTCTesterProps {
  discoveredFlows: FlowOption[];
}

const STATUS_STYLES: Record<CallStatus, string> = {
  idle: "bg-gray-100 text-gray-600",
  connecting: "bg-yellow-100 text-yellow-700",
  "in-call": "bg-green-100 text-green-700",
  ended: "bg-gray-100 text-gray-500",
  error: "bg-red-100 text-red-700",
};

export function WebRTCTester({ discoveredFlows }: WebRTCTesterProps) {
  const { projectConfig } = useProjectStore();
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [participantName, setParticipantName] = useState("Test Customer");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rtcSessionRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleStartCall = async () => {
    if (!selectedFlowId || callStatus !== "idle") return;
    setCallStatus("connecting");
    setErrorMessage(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setErrorMessage(msg);
      setCallStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/aws/connect/webrtc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactFlowId: selectedFlowId,
          participantName,
          region: projectConfig.aws.connectRegion,
          connectInstanceId: projectConfig.aws.connectInstanceId,
        }),
      });
      const data = await res.json() as { contactId?: string; connectionData?: unknown; error?: string };
      if (data.error) throw new Error(data.error);

      try {
        const connectStreams = (typeof window !== "undefined" ? (window as unknown as Record<string, unknown>)["connect"] : undefined) as Record<string, unknown> | undefined;
        const RTCSession = connectStreams?.["RTCSession"] as (new (data: unknown, stream: MediaStream) => unknown) | undefined;
        if (RTCSession && typeof RTCSession === "function") {
          rtcSessionRef.current = new RTCSession(data.connectionData, stream);
        } else {
          throw new Error("connect.RTCSession not found — amazon-connect-streams must be loaded as a script tag. See amazon-connect-streams docs.");
        }
      } catch (rtcErr: unknown) {
        const msg = rtcErr instanceof Error ? rtcErr.message : "WebRTC library error";
        console.error("WebRTC library API mismatch:", rtcErr);
        setErrorMessage(
          `WebRTC library API mismatch — check console for details and refer to amazon-connect-streams docs. (${msg})`
        );
        setCallStatus("error");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setCallStatus("in-call");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start call";
      setErrorMessage(msg);
      setCallStatus("error");
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  const handleEndCall = () => {
    try {
      if (rtcSessionRef.current && typeof (rtcSessionRef.current as { close?: () => void }).close === "function") {
        (rtcSessionRef.current as { close: () => void }).close();
      }
    } catch {
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    rtcSessionRef.current = null;
    setCallStatus("ended");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Flow</label>
          <select
            className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            disabled={callStatus !== "idle"}
          >
            <option value="">-- Select a discovered flow --</option>
            {discoveredFlows.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participant Name</label>
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            disabled={callStatus !== "idle"}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleStartCall}
          disabled={!selectedFlowId || callStatus !== "idle"}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {callStatus === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Start Test Call
        </button>

        {callStatus === "in-call" && (
          <button
            onClick={handleEndCall}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            End Call
          </button>
        )}

        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[callStatus]}`}>
          {callStatus === "in-call" ? "In Call" : callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
        </span>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-xs text-red-700">{errorMessage}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
        <p className="text-xs text-amber-700">
          Testing against existing flows only. To test a generated flow, deploy it first (v2).
        </p>
      </div>
    </div>
  );
}
