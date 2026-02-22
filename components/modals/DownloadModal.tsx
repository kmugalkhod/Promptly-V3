"use client";

import { useState, useCallback } from "react";
import { Download, Check, Loader2, AlertCircle } from "lucide-react";
import {
  createProjectZip,
  downloadBlob,
  calculateTotalSize,
  formatBytes,
  type FileToZip,
  type SupabaseCredentials,
} from "@/lib/utils/download";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

  const totalSize = calculateTotalSize(files);
  const isLargeProject = totalSize > 5 * 1024 * 1024; // 5MB
  const isEmpty = files.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="bg-zinc-900 border-zinc-800 sm:max-w-md"
        showCloseButton={state !== "preparing"}
      >
        {/* Content based on state */}
        {state === "idle" && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-violet-400" />
              </div>
              <DialogTitle className="text-xl">Download Project</DialogTitle>
              <DialogDescription>
                {isEmpty
                  ? "No files to download"
                  : `Export ${appName || "your project"} as a ZIP file`}
              </DialogDescription>
            </DialogHeader>
            <IdleContent
              files={files}
              totalSize={totalSize}
              isLargeProject={isLargeProject}
              isEmpty={isEmpty}
              appName={appName}
              onDownload={handleDownload}
            />
          </>
        )}

        {state === "preparing" && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <DialogTitle className="text-xl">Preparing Download...</DialogTitle>
              <DialogDescription>
                Creating ZIP file with {files.length} files
              </DialogDescription>
            </DialogHeader>
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
          </>
        )}

        {state === "complete" && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <DialogTitle className="text-xl">Download Ready!</DialogTitle>
              <DialogDescription>
                {appName || "project"}.zip has been downloaded
              </DialogDescription>
            </DialogHeader>
            <CompleteContent
              files={files}
              onClose={handleClose}
            />
          </>
        )}

        {state === "error" && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <DialogTitle className="text-xl">Download Failed</DialogTitle>
              <DialogDescription>
                {error || "Something went wrong while creating the ZIP file"}
              </DialogDescription>
            </DialogHeader>
            <ErrorContent onRetry={handleRetry} onClose={handleClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Idle state - show file info and download button
function IdleContent({
  files,
  totalSize,
  isLargeProject,
  isEmpty,
  appName,
  onDownload,
}: {
  files: FileToZip[];
  totalSize: number;
  isLargeProject: boolean;
  isEmpty: boolean;
  appName: string;
  onDownload: () => void;
}) {
  return (
    <>
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
        type="button"
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

// Complete state - show success
function CompleteContent({
  files,
  onClose,
}: {
  files: FileToZip[];
  onClose: () => void;
}) {
  // Show first 3 files as preview
  const previewFiles = files.slice(0, 3);
  const remainingCount = files.length - previewFiles.length;

  return (
    <>
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
        type="button"
        onClick={onClose}
        className="w-full py-2.5 rounded-lg font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
      >
        Done
      </button>
    </>
  );
}

// Error state - show error and retry
function ErrorContent({
  onRetry,
  onClose,
}: {
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2.5 rounded-lg font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onRetry}
        className="flex-1 py-2.5 rounded-lg font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
