"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface PreviewErrorProps {
  message: string;
  onRetry?: () => void;
}

export function PreviewError({ message, onRetry }: PreviewErrorProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">
          Preview unavailable
        </h3>
        <p className="text-sm text-zinc-400 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
