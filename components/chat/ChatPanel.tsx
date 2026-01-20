"use client";

import { useState } from "react";
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
}: ChatPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Get messages and session data
  const messages = useQuery(api.messages.listBySession, { sessionId });
  const session = useQuery(api.sessions.get, { id: sessionId });
  const files = useQuery(api.files.listBySession, { sessionId });

  // Actions for app generation/modification
  const generate = useAction(api.generate.generate);
  const modify = useAction(api.generate.modify);
  const createMessage = useMutation(api.messages.create);

  const handleSend = async (message: string) => {
    if (!message.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setStatusMessage(null);
    setGenerationStage("Starting...");

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
          // Need to create sandbox first
          setStatusMessage("Creating sandbox...");
          setGenerationStage("Creating sandbox...");
          const genResult = await generate({ sessionId, prompt: message });
          if (!genResult.success) {
            setError(genResult.error ?? "Failed to create sandbox");
            return;
          }
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

  // Transform messages for MessageList component
  const formattedMessages =
    messages?.map((msg) => ({
      _id: msg._id,
      role: msg.role,
      content: msg.content,
    })) ?? [];

  return (
    <div className="w-[400px] shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
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
