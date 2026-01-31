"use client";

import { useState, useCallback } from "react";
import { Download, X, Check, Loader2, AlertCircle } from "lucide-react";
import {
  createProjectZip,
  downloadBlob,
  calculateTotalSize,
  formatBytes,
  type FileToZip,
  type SupabaseCredentials,
} from "@/lib/utils/download";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileToZip[];
  appName: string;
  supabaseCredentials?: SupabaseCredentials;
}

type DownloadState = "idle" | "preparing" | "complete" | "error";

export function DownloadModal({
  isOpen,
  onClose,
  files,
  appName,
  supabaseCredentials,
}: DownloadModalProps) {
  const [state, setState] = useState<DownloadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    if (files.length === 0) return;

    setState("preparing");
    setError(null);

    try {
      const blob = await createProjectZip(files, appName, supabaseCredentials);
      const filename = `${appName || "project"}.zip`;
      downloadBlob(blob, filename);
      setState("complete");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to create ZIP");
    }
  }, [files, appName, supabaseCredentials]);

  const handleRetry = useCallback(() => {
    handleDownload();
  }, [handleDownload]);

  const handleClose = useCallback(() => {
    setState("idle");
    setError(null);
    onClose();
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen) return null;

  const totalSize = calculateTotalSize(files);
  const isLargeProject = totalSize > 5 * 1024 * 1024; // 5MB
  const isEmpty = files.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Content based on state */}
        {state === "idle" && (
          <IdleContent
            files={files}
            appName={appName}
            totalSize={totalSize}
            isLargeProject={isLargeProject}
            isEmpty={isEmpty}
            onDownload={handleDownload}
          />
        )}

        {state === "preparing" && <PreparingContent fileCount={files.length} />}

        {state === "complete" && (
          <CompleteContent
            appName={appName}
            files={files}
            onClose={handleClose}
          />
        )}

        {state === "error" && (
          <ErrorContent error={error} onRetry={handleRetry} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}

// Idle state - show file info and download button
function IdleContent({
  files,
  appName,
  totalSize,
  isLargeProject,
  isEmpty,
  onDownload,
}: {
  files: FileToZip[];
  appName: string;
  totalSize: number;
  isLargeProject: boolean;
  isEmpty: boolean;
  onDownload: () => void;
}) {
  return (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
          <Download className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Download Project
        </h2>
        <p className="text-sm text-zinc-400">
          {isEmpty
            ? "No files to download"
            : `Export ${appName || "your project"} as a ZIP file`}
        </p>
      </div>

      {!isEmpty && (
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Files</span>
            <span className="text-white">{files.length} files</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Estimated size</span>
            <span className="text-white">~{formatBytes(totalSize)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Filename</span>
            <span className="text-white font-mono text-xs">
              {appName || "project"}.zip
            </span>
          </div>
        </div>
      )}

      {isLargeProject && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-200">
            This is a large project ({formatBytes(totalSize)}). Download may take a moment.
          </p>
        </div>
      )}

      <button
        onClick={onDownload}
        disabled={isEmpty}
        className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
          isEmpty
            ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
            : "bg-violet-600 hover:bg-violet-500 text-white"
        }`}
      >
        <Download className="w-4 h-4" />
        {isEmpty ? "No Files Available" : "Download ZIP"}
      </button>

      {!isEmpty && (
        <p className="text-xs text-zinc-500 text-center mt-3">
          Includes README.md with setup instructions
        </p>
      )}
    </>
  );
}

// Preparing state - show spinner
function PreparingContent({ fileCount }: { fileCount: number }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-1">
        Preparing Download...
      </h2>
      <p className="text-sm text-zinc-400 mb-4">
        Creating ZIP file with {fileCount} files
      </p>

      {/* Animated dots */}
      <div className="flex justify-center gap-1">
        <span
          className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
    </div>
  );
}

// Complete state - show success
function CompleteContent({
  appName,
  files,
  onClose,
}: {
  appName: string;
  files: FileToZip[];
  onClose: () => void;
}) {
  // Show first 3 files as preview
  const previewFiles = files.slice(0, 3);
  const remainingCount = files.length - previewFiles.length;

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-green-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-1">Download Ready!</h2>
      <p className="text-sm text-zinc-400 mb-4">
        {appName || "project"}.zip has been downloaded
      </p>

      <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 text-left">
        <p className="text-xs text-zinc-500 mb-2">What&apos;s included:</p>
        <ul className="text-sm text-zinc-300 space-y-1">
          {previewFiles.map((file) => (
            <li key={file.path} className="font-mono text-xs truncate">
              • {file.path}
            </li>
          ))}
          {remainingCount > 0 && (
            <li className="text-zinc-500 text-xs">
              ...and {remainingCount} more files
            </li>
          )}
          <li className="font-mono text-xs text-violet-400">• README.md</li>
        </ul>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-lg font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Error state - show error and retry
function ErrorContent({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-1">Download Failed</h2>
      <p className="text-sm text-zinc-400 mb-4">
        {error || "Something went wrong while creating the ZIP file"}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-lg font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-2.5 rounded-lg font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
