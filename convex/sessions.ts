import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create new session
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const sessionId = await ctx.db.insert("sessions", {
      status: "new",
      createdAt: Date.now(),
    });
    return sessionId;
  },
});

// Get session by ID
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all sessions
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_created")
      .order("desc")
      .collect();
  },
});

// Update session
export const update = mutation({
  args: {
    id: v.id("sessions"),
    appName: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    architecture: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("new"), v.literal("active"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    await ctx.db.patch(id, cleanUpdates);
  },
});

// Delete session (and related data)
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete all messages for this session
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // Delete all files for this session
    const files = await ctx.db
      .query("files")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }

    // Delete session
    await ctx.db.delete(args.id);
  },
});

// Get session with counts (for list view)
export const getWithCounts = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    const files = await ctx.db
      .query("files")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    return {
      ...session,
      messageCount: messages.length,
      fileCount: files.length,
    };
  },
});
