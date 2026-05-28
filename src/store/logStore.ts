import { create } from "zustand";

export type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  details?: any;
}

interface LogState {
  logs: LogEntry[];
  isOpen: boolean;
  addLog: (level: LogLevel, source: string, message: string, details?: any) => void;
  clearLogs: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isOpen: false,
  addLog: (level, source, message, details) => set((state) => ({
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level,
        source,
        message,
        details
      },
      ...state.logs // Add to top
    ]
  })),
  clearLogs: () => set({ logs: [] }),
  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  setSidebarOpen: (isOpen) => set({ isOpen })
}));

export const addLog = useLogStore.getState().addLog;
