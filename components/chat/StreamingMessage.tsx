"use client";

import { Sparkles } from "lucide-react";

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* Message Content */}
      <div className="flex-1 pt-1">
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="inline-block w-2 h-4 ml-0.5 bg-violet-500 animate-pulse" />
        </p>
      </div>
    </div>
  );
}
