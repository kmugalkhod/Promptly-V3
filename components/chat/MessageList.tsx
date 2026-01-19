"use client";

import { useEffect, useRef } from "react";
import { Sparkles, User, Loader2 } from "lucide-react";
import { StreamingMessage } from "./StreamingMessage";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  isLoading?: boolean;
}

export function MessageList({
  messages,
  streamingContent,
  isLoading,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Start building your app
          </h3>
          <p className="text-sm text-zinc-400 max-w-xs">
            Describe what you want to build and I&apos;ll generate the code for
            you
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message._id} className="flex gap-3">
          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              message.role === "assistant"
                ? "bg-gradient-to-br from-violet-500 to-purple-600"
                : "bg-zinc-700"
            }`}
          >
            {message.role === "assistant" ? (
              <Sparkles className="w-4 h-4 text-white" />
            ) : (
              <User className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 pt-1">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        </div>
      ))}

      {/* Streaming response */}
      {streamingContent && <StreamingMessage content={streamingContent} />}

      {/* Loading indicator (when streaming hasn't started yet) */}
      {isLoading && !streamingContent && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-zinc-500">Generating response...</p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
