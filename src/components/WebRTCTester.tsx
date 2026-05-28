"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { Loader2, Mic, MicOff } from "lucide-react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from "amazon-chime-sdk-js";

type CallStatus = "idle" | "starting" | "connecting" | "connected" | "stopping" | "stopped" | "failed";
type DtmfStatus = "idle" | "connecting" | "ready" | "sending" | "failed";

interface FlowOption {
  id: string;
  name: string;
}

interface WebRTCTesterProps {
  discoveredFlows: FlowOption[];
}

const STATUS_STYLES: Record<CallStatus, string> = {
  idle: "bg-gray-100 text-gray-600",
  starting: "bg-yellow-100 text-yellow-700",
  connecting: "bg-blue-100 text-blue-700",
  connected: "bg-green-100 text-green-700",
  stopping: "bg-orange-100 text-orange-700",
  stopped: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-700",
};

const DTMF_STATUS_LABELS: Record<DtmfStatus, string> = {
  idle: "Waiting",
  connecting: "Connecting Participant...",
  ready: "Ready for DTMF",
  sending: "Sending Digit...",
  failed: "DTMF Failed",
};

export function WebRTCTester({ discoveredFlows }: WebRTCTesterProps) {
  const { projectConfig } = useProjectStore();
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [participantName, setParticipantName] = useState("Test Customer");
  
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [dtmfStatus, setDtmfStatus] = useState<DtmfStatus>("idle");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const connectionTokenRef = useRef<string | null>(null);

  const initParticipantConnection = async (pToken: string) => {
    setDtmfStatus("connecting");
    try {
      const res = await fetch("/api/aws/connect/participant-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          participantToken: pToken, 
          region: projectConfig.aws.connectRegion 
        }),
      });
      const data = await res.json() as { connectionToken?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.connectionToken) throw new Error("No connection token returned");
      
      connectionTokenRef.current = data.connectionToken;
      setDtmfStatus("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect participant";
      console.error("Participant connection error:", err);
      setDtmfStatus("failed");
      setErrorMessage(`Participant Service Error: ${msg}`);
    }
  };

  const handleStartCall = async () => {
    if (!selectedFlowId || (callStatus !== "idle" && callStatus !== "stopped" && callStatus !== "failed")) return;
    setCallStatus("starting");
    setErrorMessage(null);
    setIsMuted(false);
    setDtmfStatus("idle");
    connectionTokenRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone permission denied";
      setErrorMessage(`Microphone access failed: ${msg}`);
      setCallStatus("failed");
      return;
    }

    setCallStatus("connecting");

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
      
      const data = await res.json() as { 
        contactId?: string; 
        participantToken?: string; 
        connectionData?: { Meeting: any, Attendee: any }; 
        error?: string 
      };
      
      if (data.error) throw new Error(data.error);

      if (!data.connectionData?.Meeting || !data.connectionData?.Attendee) {
        throw new Error("Missing Meeting or Attendee in response from StartWebRTCContact");
      }

      // Custom logger to suppress known harmless Chime SDK telemetry errors
      class CleanLogger extends ConsoleLogger {
        error(msg: string): void {
          if (msg.includes("SignalingChannelClosedUnexpectedly") || msg.includes("Unhandled type received while flattening attributes")) return;
          super.error(msg);
        }
      }

      const logger = new CleanLogger("WebRTCTester", LogLevel.ERROR);
      const deviceController = new DefaultDeviceController(logger);
      const configuration = new MeetingSessionConfiguration(
        data.connectionData.Meeting,
        data.connectionData.Attendee
      );

      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );
      meetingSessionRef.current = meetingSession;

      const observer = {
        audioVideoDidStop: () => {
          // The server (Amazon Connect) hung up or the call ended.
          setCallStatus("stopped");
          setDtmfStatus("idle");
          connectionTokenRef.current = null;
        }
      };
      meetingSession.audioVideo.addObserver(observer);
      
      await meetingSession.audioVideo.startAudioInput(stream);
      
      if (audioRef.current) {
        await meetingSession.audioVideo.bindAudioElement(audioRef.current);
      }

      meetingSession.audioVideo.start();
      setCallStatus("connected");

      // Initialize participant connection for DTMF
      if (data.participantToken) {
        initParticipantConnection(data.participantToken);
      } else {
        setDtmfStatus("failed");
        console.warn("No participantToken returned from StartWebRTCContact");
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "StartWebRTCContact failed";
      setErrorMessage(`Chime session start failed: ${msg}`);
      setCallStatus("failed");
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  const handleStopCall = async () => {
    setCallStatus("stopping");
    try {
      if (meetingSessionRef.current) {
        meetingSessionRef.current.audioVideo.stop();
        meetingSessionRef.current = null;
      }
    } catch (err) {
      console.error("Error stopping session", err);
    }
    setDtmfStatus("idle");
    connectionTokenRef.current = null;
    setCallStatus("stopped");
  };

  const toggleMute = () => {
    if (!meetingSessionRef.current || callStatus !== "connected") return;
    
    if (isMuted) {
      meetingSessionRef.current.audioVideo.realtimeUnmuteLocalAudio();
      setIsMuted(false);
    } else {
      meetingSessionRef.current.audioVideo.realtimeMuteLocalAudio();
      setIsMuted(true);
    }
  };

  const sendDtmf = async (digit: string) => {
    if (dtmfStatus !== "ready" || !connectionTokenRef.current) return;
    setDtmfStatus("sending");
    
    try {
      const res = await fetch("/api/aws/connect/dtmf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          connectionToken: connectionTokenRef.current, 
          digit, 
          region: projectConfig.aws.connectRegion 
        }),
      });
      const data = await res.json() as { error?: string, success?: boolean };
      if (data.error) throw new Error(data.error);
      
      setDtmfStatus("ready");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send DTMF";
      setDtmfStatus("failed");
      setErrorMessage(`DTMF Error: ${msg}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meetingSessionRef.current) {
        meetingSessionRef.current.audioVideo.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Hidden audio element for remote WebRTC audio playback */}
      <audio ref={audioRef} style={{ display: "none" }} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Flow</label>
          <select
            className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            disabled={callStatus === "starting" || callStatus === "connecting" || callStatus === "connected"}
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
            disabled={callStatus === "starting" || callStatus === "connecting" || callStatus === "connected"}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleStartCall}
          disabled={!selectedFlowId || callStatus === "starting" || callStatus === "connecting" || callStatus === "connected"}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {callStatus === "starting" || callStatus === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Start Test Call
        </button>

        {callStatus === "connected" && (
          <button
            onClick={handleStopCall}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Stop Test Call
          </button>
        )}

        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[callStatus]}`}>
          {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
        </span>
      </div>

      {callStatus === "connected" && (
        <div className="pt-4 border-t border-gray-200 mt-4 flex gap-6">
          <div className="flex flex-col items-start gap-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Microphone</label>
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                isMuted 
                  ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200" 
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>

          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2 w-full justify-between">
              <label className="block text-xs font-medium text-gray-500 uppercase">Keypad</label>
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                dtmfStatus === "ready" ? "bg-green-100 text-green-700" :
                dtmfStatus === "failed" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {DTMF_STATUS_LABELS[dtmfStatus]}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1 bg-gray-50 p-2 rounded-md border border-gray-200">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                <button
                  key={digit}
                  onClick={() => sendDtmf(digit)}
                  disabled={dtmfStatus !== "ready"}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 transition-colors text-lg font-medium text-gray-700"
                >
                  {digit}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-2">
          <p className="text-xs text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
