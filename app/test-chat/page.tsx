"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { streamChat } from "@/lib/chat";
import { Id } from "@/convex/_generated/dataModel";

export default function TestChatPage() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [input, setInput] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useMutation(api.sessions.create);
  const messages = useQuery(
    api.messages.listBySession,
    sessionId ? { sessionId } : "skip"
  );

  const handleCreateSession = async () => {
    try {
      const id = await createSession({});
      setSessionId(id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    }
  };

  const handleSend = async () => {
    if (!sessionId || !input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");
    setStreamingResponse("");
    setIsStreaming(true);
    setError(null);

    try {
      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      if (!siteUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is not configured");
      }

      for await (const event of streamChat(sessionId, message, siteUrl)) {
        if (event.text) {
          setStreamingResponse((prev) => prev + event.text);
        }
        if (event.done) {
          // Clear streaming response when done - the persisted message will show via useQuery
          setStreamingResponse("");
        }
        if (event.error) {
          setError(event.error);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat error");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat Test</h1>
      <p className="text-sm text-gray-600 mb-4">
        This page tests the chat backend with streaming responses.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}

      {!sessionId ? (
        <button
          onClick={handleCreateSession}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create Session
        </button>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Session: <code className="bg-gray-100 px-1 rounded">{sessionId}</code>
          </div>

          {/* Messages */}
          <div className="border rounded p-4 h-96 overflow-y-auto space-y-2 bg-gray-50">
            {messages?.length === 0 && !streamingResponse && (
              <div className="text-gray-400 text-center py-8">
                No messages yet. Send a message to start chatting!
              </div>
            )}

            {messages?.map((msg) => (
              <div
                key={msg._id}
                className={`p-3 rounded ${
                  msg.role === "user"
                    ? "bg-blue-100 ml-8"
                    : "bg-white border mr-8"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {msg.role === "user" ? "You" : "Assistant"}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}

            {/* Streaming response */}
            {streamingResponse && (
              <div className="p-3 rounded bg-white border mr-8">
                <div className="text-xs text-gray-500 mb-1">
                  Assistant <span className="text-blue-500">(typing...)</span>
                </div>
                <div className="whitespace-pre-wrap">{streamingResponse}</div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming ? "..." : "Send"}
            </button>
          </div>

          <div className="text-xs text-gray-400">
            Press Enter to send. Messages are persisted in Convex.
          </div>
        </div>
      )}
    </div>
  );
}
