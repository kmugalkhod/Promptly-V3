"use client";

import { Sparkles, ArrowLeft } from "lucide-react";

interface HeaderProps {
  onBack?: () => void;
  projectName?: string;
}

export function Header({ onBack, projectName }: HeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4">
      {/* Left - Back & Logo */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
        )}
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
        <button className="text-sm text-zinc-400 hover:text-white transition-colors">
          Share
        </button>
        <button className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors text-white">
          Deploy
        </button>
      </div>
    </header>
  );
}
