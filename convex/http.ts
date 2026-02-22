import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

const http = httpRouter();
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

/**
 * Chat endpoint with streaming
 *
 * DEPRECATED: This is the basic chat endpoint that uses a simple prompt.
 * For the full unified pipeline with intent extraction, file resolution,
 * edit scope enforcement, and validation, use the runChatAgent() function
 * from lib/agents/chat.ts instead.
 *
 * This endpoint is kept for backwards compatibility with existing clients
 * that expect streaming text responses without tool usage.
 *
 * TODO: Migrate to unified pipeline:
 * 1. Create a new /chat/v2 endpoint that uses runChatAgent
 * 2. The v2 endpoint should return tool calls and file changes
 * 3. Consider WebSocket for real-time updates
 */
http.route({
  path: "/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Parse request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sessionId: any, message: any;
    try {
      const body = await request.json();
      sessionId = body.sessionId;
      message = body.message;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "sessionId and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (message.length > 100_000) {
      return new Response(
        JSON.stringify({ error: "Message exceeds maximum length (100KB)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1b. Validate session exists
    try {
      const session = await ctx.runQuery(api.sessions.get, { id: sessionId });
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Save user message
    try {
      await ctx.runMutation(internal.messages.createInternal, {
        sessionId,
        role: "user",
        content: message,
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Get conversation history
    const history = await ctx.runQuery(api.messages.getRecent, {
      sessionId,
      limit: 10,
    });

    // 4. Build messages for Anthropic API
    const anthropicMessages = history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // 5. Create streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // 6. Stream from Anthropic API (fire and forget)
    (async () => {
      let fullResponse = "";

      try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error("ANTHROPIC_API_KEY is not configured");
        }

        // Call Anthropic API with streaming
        // Note: This basic endpoint doesn't use the unified pipeline
        // For full functionality (intent extraction, edit scope, etc.),
        // use the runChatAgent() function from lib/agents/chat.ts
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 2048,
            stream: true,
            system:
              "You are a helpful assistant that helps users build web applications. " +
              "Be concise and practical. " +
              "For code modifications, recommend using the full Chat Agent for better results.",
            messages: anthropicMessages,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          throw new Error("No response body from Anthropic API");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);

                // Handle content_block_delta events
                if (
                  event.type === "content_block_delta" &&
                  event.delta?.type === "text_delta"
                ) {
                  const text = event.delta.text;
                  fullResponse += text;

                  // Stream as SSE to client
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }

        // Signal completion
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );

        // 7. Save assistant message
        await ctx.runMutation(internal.messages.createInternal, {
          sessionId,
          role: "assistant",
          content: fullResponse,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();

    // 8. Return streaming response
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": allowedOrigin,
      },
    });
  }),
});

// CORS preflight
http.route({
  path: "/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

/**
 * Health check endpoint
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: "ok",
        version: "2.0",
        pipeline: "unified",
        message: "Chat endpoint available. Use runChatAgent() for full pipeline.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
        },
      }
    );
  }),
});

export default http;
