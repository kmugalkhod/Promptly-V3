"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Header } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { RightPanel } from "@/components/preview";
import { DownloadModal } from "@/components/modals/DownloadModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { Loader2 } from "lucide-react";

interface BuilderPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function BuilderPage({ params }: BuilderPageProps) {
  const router = useRouter();
  const { sessionId } = use(params);

  // Validate sessionId format before casting
  // Convex IDs are URL-safe base64-like strings (alphanumeric + possibly some special chars)
  const isValidSessionId = !!sessionId && sessionId.length >= 5;
  const typedSessionId = sessionId as Id<"sessions">;

  // Get session data (skip query if invalid)
  const session = useQuery(api.sessions.get, isValidSessionId ? { id: typedSessionId } : "skip");

  // Get files for code editor
  const files = useQuery(api.files.listBySession, isValidSessionId ? { sessionId: typedSessionId } : "skip");

  // Get messages to detect generation state
  const messages = useQuery(api.messages.listBySession, isValidSessionId ? { sessionId: typedSessionId } : "skip");

  // Selected file state for file explorer
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Processing state lifted from ChatPanel for animation coordination
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationStage, setGenerationStage] = useState<string | undefined>();

  // Sandbox initialization state
  const initializeSandbox = useAction(api.sandbox.initializeForSession);
  const [sandboxStatus, setSandboxStatus] = useState<"idle" | "initializing" | "ready" | "error">("idle");
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const initializationAttempted = useRef(false);

  // Download modal state
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  // Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Read pending prompt from welcome experience (sessionStorage)
  const [initialPrompt] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const pending = sessionStorage.getItem("pendingPrompt");
    if (pending) {
      sessionStorage.removeItem("pendingPrompt");
      return pending;
    }
    return undefined;
  });

  // Effect to initialize sandbox on mount (only for existing projects with files)
  useEffect(() => {
    if (files && files.length > 0 && sandboxStatus === "idle" && !initializationAttempted.current) {
      initializationAttempted.current = true;
      setSandboxStatus("initializing");
      initializeSandbox({ sessionId: typedSessionId })
        .then((result) => {
          if (result.success) {
            setSandboxStatus("ready");
            // Store the previewUrl from the promise result to avoid race condition with query
            if (result.previewUrl) {
              setLocalPreviewUrl(result.previewUrl);
            }
          } else {
            setSandboxStatus("error");
            setSandboxError(result.error || "Failed to initialize sandbox");
          }
        })
        .catch((err) => {
          setSandboxStatus("error");
          setSandboxError(err.message);
        });
    }
  }, [files, sandboxStatus, initializeSandbox, typedSessionId]);

  // Compute effective selected path - if nothing selected but files exist, use first file
  const effectiveSelectedPath =
    selectedFilePath ?? (files && files.length > 0 ? files[0].path : null);

  // Get the selected file object
  const selectedFile =
    files?.find((f) => f.path === effectiveSelectedPath) || null;

  // Invalid sessionId — redirect
  if (!isValidSessionId) {
    router.push("/builder");
    return null;
  }

  // Loading state
  if (session === undefined) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
        <p className="text-zinc-400">Loading session...</p>
      </div>
    );
  }

  // Session not found
  if (session === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950">
        <h1 className="text-2xl font-bold text-white mb-2">Session Not Found</h1>
        <p className="text-zinc-400 mb-4">
          The session you&apos;re looking for doesn&apos;t exist.
        </p>
        <button
          onClick={() => router.push("/builder")}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }


  // Get the latest code from files (for code editor fallback)
  const latestFile = files?.[0];
  const latestCode = latestFile?.content;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <Header
        projectName={session.appName}
        onSettings={() => setIsSettingsModalOpen(true)}
        onDownload={() => setIsDownloadModalOpen(true)}
      />

      {/* Download Modal */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        files={(files || []).map((f) => ({ path: f.path, content: f.content }))}
        appName={session.appName || "project"}
        supabaseCredentials={
          session.supabaseUrl && session.supabaseAnonKey
            ? { url: session.supabaseUrl, anonKey: session.supabaseAnonKey }
            : undefined
        }
      />

      {/* Settings Modal — only mounted when open to avoid background queries */}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          sessionId={typedSessionId}
        />
      )}

      {/* Sandbox Initialization Banner */}
      {sandboxStatus === "initializing" && (
        <div className="bg-violet-900/50 text-white text-sm py-2 px-4 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restoring your project...
        </div>
      )}
      {sandboxStatus === "error" && (
        <div className="bg-red-900/50 text-white text-sm py-2 px-4 text-center">
          Failed to restore sandbox: {sandboxError}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <ChatPanel
          sessionId={typedSessionId}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          setGenerationStage={setGenerationStage}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          initialPrompt={initialPrompt}
        />

        {/* Right Panel - Preview / Code (with FileExplorer in Code tab) */}
        <RightPanel
          previewUrl={localPreviewUrl || session.previewUrl}
          code={latestCode}
          fileName={latestFile?.path}
          selectedFile={selectedFile}
          files={files || []}
          selectedPath={effectiveSelectedPath}
          onSelectFile={setSelectedFilePath}
          isGenerating={isProcessing && (!files || files.length === 0)}
          generationStage={generationStage}
          sandboxStatus={sandboxStatus}
        />
      </div>
    </div>
  );
}
