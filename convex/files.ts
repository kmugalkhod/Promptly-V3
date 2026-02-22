import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_PATH_LENGTH = 500;
const MAX_CONTENT_LENGTH = 1_000_000; // 1MB

function sanitizePath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");

  if (normalized.includes("..")) {
    throw new Error(`Invalid path: directory traversal not allowed: ${inputPath}`);
  }

  if (normalized.startsWith("/")) {
    throw new Error(`Invalid path: absolute paths not allowed: ${inputPath}`);
  }

  const cleaned = normalized.replace(/^\/+|\/+$/g, "");

  if (cleaned.length === 0) {
    throw new Error("Invalid path: empty path");
  }

  if (cleaned.length > MAX_PATH_LENGTH) {
    throw new Error(`Invalid path: exceeds maximum length (${MAX_PATH_LENGTH} chars)`);
  }

  return cleaned;
}

// Create or update file
export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const path = sanitizePath(args.path);

    if (args.content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`File content exceeds maximum length (${MAX_CONTENT_LENGTH} chars)`);
    }

    // Check if file exists
    const existing = await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", path)
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
        path,
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
    const path = sanitizePath(args.path);
    return await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", path)
      )
      .first();
  },
});

// Delete file by ID (with session ownership check)
export const remove = mutation({
  args: {
    id: v.id("files"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file || file.sessionId !== args.sessionId) {
      throw new Error("File not found or access denied");
    }
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
    const path = sanitizePath(args.path);
    const file = await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", path)
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
