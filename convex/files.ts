import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create or update file
export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if file exists
    const existing = await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", args.path)
      )
      .first();

    if (existing) {
      // Update existing file
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new file
      return await ctx.db.insert("files", {
        sessionId: args.sessionId,
        path: args.path,
        content: args.content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get all files for session
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get file by path
export const getByPath = query({
  args: {
    sessionId: v.id("sessions"),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", args.path)
      )
      .first();
  },
});

// Delete file by ID
export const remove = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Delete file by session and path
export const removeByPath = mutation({
  args: {
    sessionId: v.id("sessions"),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", args.path)
      )
      .first();

    if (file) {
      await ctx.db.delete(file._id);
    }
  },
});

// Get file paths only (for tree view)
export const listPaths = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return files.map((f) => f.path).sort();
  },
});
