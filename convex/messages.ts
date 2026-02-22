import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_MESSAGE_LENGTH = 100_000; // 100KB

// Shared handler for creating messages (used by both public and internal mutations)
const messageCreateHandler = async (
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  args: { sessionId: import("./_generated/dataModel").Id<"sessions">; role: "user" | "assistant"; content: string }
) => {
  if (args.content.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Message content exceeds maximum length (100KB)");
  }

  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const messageId = await ctx.db.insert("messages", {
    sessionId: args.sessionId,
    role: args.role,
    content: args.content,
    createdAt: Date.now(),
  });

  if (session.status === "new") {
    await ctx.db.patch(args.sessionId, { status: "active" });
  }

  return messageId;
};

// Add message to session
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: messageCreateHandler,
});

// Get messages for session (ordered by time)
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// Get recent messages (for context building)
export const getRecent = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);

    // Return in chronological order
    return messages.reverse();
  },
});

// Internal mutation for HTTP actions (not exposed to client)
export const createInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: messageCreateHandler,
});
