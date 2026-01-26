"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Download,
} from "lucide-react";
import { PreviewLoading } from "./PreviewLoading";
import { PreviewError } from "./PreviewError";
import { SandboxStatus } from "./SandboxStatus";
import { GenerationAnimation } from "./GenerationAnimation";

interface PreviewProps {
  previewUrl?: string;
  code?: string;
  onRetry?: () => void;
  isGenerating?: boolean;
  generationStage?: string;
  sandboxInitStatus?: "idle" | "initializing" | "ready" | "error";
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const defaultHtml = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      }
      .container {
        padding: 2rem;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      p {
        opacity: 0.8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Your app will appear here</h1>
      <p>Start building by sending a message</p>
    </div>
  </body>
</html>
`;

export function Preview({ previewUrl, code, onRetry, isGenerating, generationStage, sandboxInitStatus }: PreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [refreshCount, setRefreshCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Track previous sandbox status to detect when initialization completes
  const prevSandboxInitStatusRef = useRef(sandboxInitStatus);

  // Force refresh when sandbox transitions from initializing to ready
  useEffect(() => {
    if (prevSandboxInitStatusRef.current === "initializing" && sandboxInitStatus === "ready") {
      // Sandbox just finished initializing, force a refresh
      setRefreshCount((c) => c + 1);
      setIsLoading(true);
    }
    prevSandboxInitStatusRef.current = sandboxInitStatus;
  }, [sandboxInitStatus]);

  // Determine if we're using external URL (E2B sandbox) or inline content (srcDoc)
  const isExternalUrl = Boolean(previewUrl);

  // Timeout fallback for slow loads (only for external URLs)
  useEffect(() => {
    if (!previewUrl || !isLoading) return;

    const timeout = setTimeout(() => {
      if (isLoading) {
        setHasError(true);
        setIsLoading(false);
        setErrorMessage("Preview took too long to load. The sandbox may have timed out.");
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [previewUrl, isLoading, refreshCount]);

  // Generate a unique key for the iframe based on content and manual refresh
  const iframeKey = useMemo(() => {
    return `${previewUrl || code || "default"}-${refreshCount}`;
  }, [previewUrl, code, refreshCount]);

  const viewportClasses = {
    desktop: "w-full",
    tablet: "w-[768px]",
    mobile: "w-[375px]",
  };

  // Determine sandbox status
  const sandboxStatus = useMemo(() => {
    if (hasError) return "offline" as const;
    if (isLoading) return "loading" as const;
    return "live" as const;
  }, [hasError, isLoading]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage("Failed to load preview. The sandbox may be unavailable.");
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(isExternalUrl);
    setHasError(false);
    setErrorMessage("");
    setRefreshCount((c) => c + 1);
  }, [isExternalUrl]);

  const handleRetry = useCallback(() => {
    handleRefresh();
    onRetry?.();
  }, [handleRefresh, onRetry]);

  const handleDownload = () => {
    const content = code || defaultHtml;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    } else {
      const content = code || defaultHtml;
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Preview Toolbar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Preview</span>
          <SandboxStatus status={sandboxStatus} />
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewport("desktop")}
            className={`p-1.5 rounded ${
              viewport === "desktop" ? "bg-zinc-700" : "hover:bg-zinc-700/50"
            }`}
            title="Desktop"
          >
            <Monitor className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={() => setViewport("tablet")}
            className={`p-1.5 rounded ${
              viewport === "tablet" ? "bg-zinc-700" : "hover:bg-zinc-700/50"
            }`}
            title="Tablet"
          >
            <Tablet className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`p-1.5 rounded ${
              viewport === "mobile" ? "bg-zinc-700" : "hover:bg-zinc-700/50"
            }`}
            title="Mobile"
          >
            <Smartphone className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-zinc-800 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-1.5 hover:bg-zinc-800 rounded"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-zinc-800 rounded"
            title="Download HTML"
          >
            <Download className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 flex justify-center">
        <div
          className={`${viewportClasses[viewport]} h-full transition-all duration-300`}
        >
          {isGenerating ? (
            <GenerationAnimation stage={generationStage} />
          ) : sandboxInitStatus === "initializing" ? (
            <div className="w-full h-full bg-zinc-900 rounded-lg flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-zinc-400 text-sm">Restoring your project...</p>
              <p className="text-zinc-500 text-xs mt-1">This may take a moment</p>
            </div>
          ) : hasError ? (
            <PreviewError message={errorMessage} onRetry={handleRetry} />
          ) : previewUrl ? (
            <>
              {isLoading && <PreviewLoading />}
              <iframe
                key={iframeKey}
                src={previewUrl}
                className={`w-full h-full bg-white rounded-lg ${isLoading ? "hidden" : ""}`}
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                title="App Preview"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </>
          ) : isLoading ? (
            <PreviewLoading />
          ) : (
            <iframe
              key={iframeKey}
              srcDoc={code || defaultHtml}
              className="w-full h-full bg-white rounded-lg"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              title="App Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
