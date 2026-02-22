"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ChatPanelProps {
  sessionId: Id<"sessions">;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setGenerationStage: (stage: string | undefined) => void;
  onOpenSettings?: () => void;
  initialPrompt?: string;
}

/**
 * Check if message implies the app needs database/data persistence
 */
function needsDatabaseIntegration(message: string): boolean {
  const keywords = [
    "save", "store", "persist", "database", "backend", "crud",
    "todo", "tasks", "posts", "blog", "users", "user data",
    "inventory", "orders", "bookmark", "favorites", "notes",
    "records", "entries", "items list", "track", "manage",
  ];
  const messageLower = message.toLowerCase();
  return keywords.some((kw) => messageLower.includes(kw));
}

/**
 * Check if this looks like a new project request
 */
function isNewProjectRequest(message: string): boolean {
  const keywords = [
    "build",
    "create",
    "make",
    "generate",
    "start",
    "new project",
    "new app",
    "new website",
    "i want a",
    "i need a",
    "can you build",
    "can you create",
  ];
  const messageLower = message.toLowerCase();
  return keywords.some((kw) => messageLower.includes(kw));
}

export function ChatPanel({
  sessionId,
  isProcessing,
  setIsProcessing,
  setGenerationStage,
  onOpenSettings,
  initialPrompt,
}: ChatPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [supabaseWarning, setSupabaseWarning] = useState<string | null>(null);

  // Get messages and session data
  const messages = useQuery(api.messages.listBySession, { sessionId });
  const session = useQuery(api.sessions.get, { id: sessionId });
  const files = useQuery(api.files.listBySession, { sessionId });
  const supabaseStatus = useQuery(api.sessions.getSupabaseStatus, { id: sessionId });

  // Show schema error banner if schema execution failed
  useEffect(() => {
    if (supabaseStatus?.schemaStatus === "error" && supabaseStatus?.schemaError) {
      setError(`Database setup failed: ${supabaseStatus.schemaError}`);
    }
  }, [supabaseStatus?.schemaStatus, supabaseStatus?.schemaError]);

  // Actions for app generation/modification
  const generate = useAction(api.generate.generate);
  const modify = useAction(api.generate.modify);
  const createMessage = useMutation(api.messages.create);

  const handleSend = async (message: string) => {
    if (!message.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setStatusMessage(null);
    setSupabaseWarning(null);
    setGenerationStage("Starting...");

    // Check if this app needs a database but Supabase isn't connected
    if (needsDatabaseIntegration(message) && !supabaseStatus?.supabaseConnected) {
      setSupabaseWarning("This app may need a database. Connect Supabase in Settings > Integrations for data persistence.");
    }

    try {
      // Save user message first
      await createMessage({
        sessionId,
        role: "user",
        content: message,
      });

      // Determine if this is a new project or modification
      const hasFiles = files && files.length > 0;
      const hasSandbox = session?.sandboxId;

      if (!hasFiles && !hasSandbox && isNewProjectRequest(message)) {
        // New project - use generate action
        setStatusMessage("Creating sandbox and generating app...");
        setGenerationStage("Creating sandbox...");

        const result = await generate({ sessionId, prompt: message });

        if (result.success) {
          // Save assistant response
          const responseMessage = result.appName
            ? `I've created "${result.appName}" with ${result.filesCreated} files. You can see the preview on the right!`
            : `Generated ${result.filesCreated} files. Check the preview!`;

          await createMessage({
            sessionId,
            role: "assistant",
            content: responseMessage,
          });

          if (result.error) {
            setError(`Warning: ${result.error}`);
          }
        } else {
          setError(result.error ?? "Failed to generate app");
          await createMessage({
            sessionId,
            role: "assistant",
            content: `Sorry, I couldn't generate the app: ${result.error}`,
          });
        }
      } else {
        // Existing project - use modify action
        if (!hasSandbox) {
          // Need to create sandbox first — generate handles the full flow
          setStatusMessage("Creating sandbox...");
          setGenerationStage("Creating sandbox...");
          const genResult = await generate({ sessionId, prompt: message });
          if (!genResult.success) {
            setError(genResult.error ?? "Failed to create sandbox");
            return;
          }
          // generate() already created the app; save response and return
          const responseMessage = genResult.appName
            ? `I've created "${genResult.appName}" with ${genResult.filesCreated} files. You can see the preview on the right!`
            : `Generated ${genResult.filesCreated} files. Check the preview!`;
          await createMessage({
            sessionId,
            role: "assistant",
            content: responseMessage,
          });
          if (genResult.error) {
            setError(`Warning: ${genResult.error}`);
          }
          return;
        }

        setStatusMessage("Processing your request...");
        setGenerationStage("Writing code...");
        const result = await modify({ sessionId, message });

        if (result.success) {
          // Save assistant response
          const responseMessage =
            result.response ||
            (result.filesChanged && result.filesChanged.length > 0
              ? `Done! I modified ${result.filesChanged.join(", ")}`
              : "Done! I've made the changes you requested.");

          await createMessage({
            sessionId,
            role: "assistant",
            content: responseMessage,
          });

          if (result.error) {
            setError(`Warning: ${result.error}`);
          }
        } else {
          setError(result.error ?? "Failed to modify app");
          await createMessage({
            sessionId,
            role: "assistant",
            content: `Sorry, I couldn't make that change: ${result.error}`,
          });
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
      setGenerationStage(undefined);
    }
  };

  // Auto-submit initialPrompt from welcome experience
  const hasAutoSubmitted = useRef(false);
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  useEffect(() => {
    if (initialPrompt && !hasAutoSubmitted.current && session !== undefined && files !== undefined) {
      hasAutoSubmitted.current = true;
      handleSendRef.current(initialPrompt);
    }
  }, [initialPrompt, session, files]);

  // Transform messages for MessageList component (memoized)
  const formattedMessages = useMemo(
    () =>
      messages?.map((msg) => ({
        _id: msg._id,
        role: msg.role,
        content: msg.content,
      })) ?? [],
    [messages]
  );

  return (
    <div className="w-[400px] shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      {/* Supabase Warning Banner */}
      {supabaseWarning && (
        <div className="p-3 bg-amber-900/50 border-b border-amber-800 text-amber-200 text-sm flex items-center justify-between">
          <span>{supabaseWarning}</span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="ml-3 px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded-lg shrink-0 transition-colors"
            >
              Connect Supabase
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-900/50 border-b border-red-800 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={formattedMessages}
        streamingContent={statusMessage || undefined}
        isLoading={isProcessing}
      />

      {/* Input */}
      <MessageInput onSend={handleSend} disabled={isProcessing} />
    </div>
  );
}
