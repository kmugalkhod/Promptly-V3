import { Id } from "@/convex/_generated/dataModel";

export interface ChatStreamEvent {
  text?: string;
  done?: boolean;
  error?: string;
}

/**
 * Stream chat messages from the Convex HTTP endpoint.
 * Uses Server-Sent Events (SSE) format for streaming.
 */
export async function* streamChat(
  sessionId: Id<"sessions">,
  message: string,
  convexSiteUrl: string
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(`${convexSiteUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send message");
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: ChatStreamEvent = JSON.parse(line.slice(6));
          yield event;
        } catch {
          // Skip malformed events
        }
      }
    }
  }
}
