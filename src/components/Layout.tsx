"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { Home, Settings, Bot, Eye, Rocket, ScrollText, Search, Workflow } from "lucide-react";
import { LogsSidebar } from "./LogsSidebar";
import { useLogStore } from "@/store/logStore";

export function Layout({ children }: { children: ReactNode }) {
  const { toggleSidebar, logs } = useLogStore();
  const unreadCount = logs.length; // Simplified for now

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden relative">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0">
        <div className="p-4 border-b border-gray-200 font-bold text-lg text-blue-600 flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Demo Builder
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Home className="w-5 h-5" /> Dashboard
          </Link>
          <Link href="/settings" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Settings className="w-5 h-5" /> Settings
          </Link>
          <Link href="/agents" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Bot className="w-5 h-5" /> Agents
          </Link>
          <Link href="/preview" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Eye className="w-5 h-5" /> Preview
          </Link>
          <Link href="/deploy" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Rocket className="w-5 h-5" /> Deploy
          </Link>
          <div className="border-t border-gray-200 my-2" />
          <p className="text-xs text-gray-400 uppercase tracking-wider px-2 pb-1">Experience</p>
          <Link href="/flow-discovery" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Search className="w-5 h-5" /> Flow Discovery
          </Link>
          <Link href="/experience" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors">
            <Workflow className="w-5 h-5" /> Experience Builder
          </Link>
        </nav>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-4 shrink-0">
          <button 
            onClick={toggleSidebar}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ScrollText className="w-4 h-4" />
            Logs
            {unreadCount > 0 && (
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">
                {unreadCount}
              </span>
            )}
          </button>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <LogsSidebar />
    </div>
  );
}
