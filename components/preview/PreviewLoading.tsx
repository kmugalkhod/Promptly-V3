"use client";

import { Loader2 } from "lucide-react";

export function PreviewLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Loading preview...</p>
      </div>
    </div>
  );
}
