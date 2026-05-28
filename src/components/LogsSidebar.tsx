"use client";
import { useLogStore } from "@/store/logStore";
import { X, Trash2, Info, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

function LogEntryRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  
  const Icon = {
    INFO: Info,
    SUCCESS: CheckCircle2,
    WARN: AlertTriangle,
    ERROR: XCircle
  }[log.level as "INFO" | "SUCCESS" | "WARN" | "ERROR"] || Info;

  const colorClass = {
    INFO: "text-blue-500",
    SUCCESS: "text-green-500",
    WARN: "text-yellow-500",
    ERROR: "text-red-500"
  }[log.level as "INFO" | "SUCCESS" | "WARN" | "ERROR"] || "text-gray-500";

  return (
    <div className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div 
        className="p-3 cursor-pointer flex gap-3 items-start"
        onClick={() => log.details && setExpanded(!expanded)}
      >
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${colorClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <span className="text-xs font-semibold text-gray-500">{log.source}</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-gray-800 break-words mt-0.5">{log.message}</p>
        </div>
        {log.details && (
          <div className="shrink-0 mt-1 text-gray-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        )}
      </div>
      {expanded && log.details && (
        <div className="px-3 pb-3 pt-1">
          <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto font-mono">
            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LogsSidebar() {
  const { logs, isOpen, setSidebarOpen, clearLogs } = useLogStore();

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-40 lg:hidden" 
        onClick={() => setSidebarOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col transform transition-transform duration-300">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            Application Logs
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={clearLogs}
              title="Clear Logs"
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <Info className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No logs yet.</p>
              <p className="text-xs mt-1">Actions you perform in the app will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <LogEntryRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
