"use client";

import { Sparkles, Download, Settings } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HeaderProps {
  projectName?: string;
  onSettings?: () => void;
  onDownload?: () => void;
}

export function Header({ projectName, onSettings, onDownload }: HeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4">
      {/* Left - Sidebar Trigger & Logo */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg text-white">PROMPTLY</span>
        </div>
      </div>

      {/* Center - Project Name */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-sm text-zinc-400">
          {projectName || "Untitled Project"}
        </span>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            aria-label="Project settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            aria-label="Download project"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}
        <button type="button" className="text-sm text-zinc-400 hover:text-white transition-colors" aria-label="Share project">
          Share
        </button>
        <button type="button" className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors text-white">
          Deploy
        </button>
      </div>
    </header>
  );
}
