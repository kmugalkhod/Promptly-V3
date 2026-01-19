"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Header } from "@/components/layout";
import { ChatPanel } from "@/components/chat";
import { RightPanel } from "@/components/preview";
import { Loader2 } from "lucide-react";

interface BuilderPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function BuilderPage({ params }: BuilderPageProps) {
  const router = useRouter();
  const { sessionId } = use(params);

  // Validate and cast sessionId
  const typedSessionId = sessionId as Id<"sessions">;

  // Get session data
  const session = useQuery(api.sessions.get, { id: typedSessionId });

  // Get files for code editor (latest file)
  const files = useQuery(api.files.listBySession, { sessionId: typedSessionId });

  // Loading state
  if (session === undefined) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-4" />
        <p className="text-zinc-400">Loading session...</p>
      </div>
    );
  }

  // Session not found
  if (session === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950">
        <h1 className="text-2xl font-bold text-white mb-2">Session Not Found</h1>
        <p className="text-zinc-400 mb-4">
          The session you&apos;re looking for doesn&apos;t exist.
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Get the latest code from files (for code editor)
  const latestFile = files?.[0];
  const latestCode = latestFile?.content;

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <Header
        projectName={session.appName}
        onBack={() => router.push("/")}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Chat */}
        <ChatPanel sessionId={typedSessionId} />

        {/* Right Panel - Preview / Code */}
        <RightPanel
          previewUrl={session.previewUrl}
          code={latestCode}
          fileName={latestFile?.path}
        />
      </div>
    </div>
  );
}
