import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * File Embeddings Module
 *
 * Stores and queries file embeddings for semantic search.
 * Uses Convex vector search for similarity queries.
 */

// Upsert file embedding
export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    filePath: v.string(),
    contentSummary: v.string(),
    embedding: v.array(v.float64()),
    fileType: v.string(),
    exportedNames: v.array(v.string()),
    importCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if embedding exists for this file
    const existing = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("filePath", args.filePath)
      )
      .first();

    if (existing) {
      // Update existing embedding
      await ctx.db.patch(existing._id, {
        contentSummary: args.contentSummary,
        embedding: args.embedding,
        fileType: args.fileType,
        exportedNames: args.exportedNames,
        importCount: args.importCount,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new embedding
      return await ctx.db.insert("fileEmbeddings", {
        sessionId: args.sessionId,
        filePath: args.filePath,
        contentSummary: args.contentSummary,
        embedding: args.embedding,
        fileType: args.fileType,
        exportedNames: args.exportedNames,
        importCount: args.importCount,
        updatedAt: Date.now(),
      });
    }
  },
});

// Internal mutation for batch upsert
export const upsertInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    filePath: v.string(),
    contentSummary: v.string(),
    embedding: v.array(v.float64()),
    fileType: v.string(),
    exportedNames: v.array(v.string()),
    importCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("filePath", args.filePath)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentSummary: args.contentSummary,
        embedding: args.embedding,
        fileType: args.fileType,
        exportedNames: args.exportedNames,
        importCount: args.importCount,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("fileEmbeddings", {
        sessionId: args.sessionId,
        filePath: args.filePath,
        contentSummary: args.contentSummary,
        embedding: args.embedding,
        fileType: args.fileType,
        exportedNames: args.exportedNames,
        importCount: args.importCount,
        updatedAt: Date.now(),
      });
    }
  },
});

// Search similar files by session (non-vector, for listing)
export const searchBySession = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Get embeddings for this session
    const results = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(limit);

    return results.map((r) => ({
      filePath: r.filePath,
      contentSummary: r.contentSummary,
      fileType: r.fileType,
      exportedNames: r.exportedNames,
      importCount: r.importCount,
    }));
  },
});

// Vector search action (uses Convex vector search)
export const vectorSearch = action({
  args: {
    sessionId: v.id("sessions"),
    queryEmbedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Perform vector search
    const results = await ctx.vectorSearch("fileEmbeddings", "by_embedding", {
      vector: args.queryEmbedding,
      limit,
      filter: (q) => q.eq("sessionId", args.sessionId),
    });

    return results.map((r) => ({
      id: r._id,
      score: r._score,
    }));
  },
});

// Get embedding by file path
export const getByPath = query({
  args: {
    sessionId: v.id("sessions"),
    filePath: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("filePath", args.filePath)
      )
      .first();
  },
});

// Get all embeddings for a session
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Delete embedding by file path
export const removeByPath = mutation({
  args: {
    sessionId: v.id("sessions"),
    filePath: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("filePath", args.filePath)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

// Delete all embeddings for a session
export const removeAllBySession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const embeddings = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const embedding of embeddings) {
      await ctx.db.delete(embedding._id);
    }

    return embeddings.length;
  },
});

// Batch create embeddings action (calls OpenAI and stores)
export const batchCreateEmbeddings = action({
  args: {
    sessionId: v.id("sessions"),
    files: v.array(
      v.object({
        filePath: v.string(),
        contentSummary: v.string(),
        fileType: v.string(),
        exportedNames: v.array(v.string()),
        importCount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Create embeddings for all file summaries
    const summaries = args.files.map((f) => f.contentSummary);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: summaries,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const embeddings = data.data as Array<{ embedding: number[]; index: number }>;

    // Store each embedding
    const results: string[] = [];
    for (const embeddingData of embeddings) {
      const file = args.files[embeddingData.index];
      await ctx.runMutation(internal.embeddings.upsertInternal, {
        sessionId: args.sessionId,
        filePath: file.filePath,
        contentSummary: file.contentSummary,
        embedding: embeddingData.embedding,
        fileType: file.fileType,
        exportedNames: file.exportedNames,
        importCount: file.importCount,
      });
      results.push(file.filePath);
    }

    return results;
  },
});

// Create single embedding action
export const createEmbedding = action({
  args: {
    text: v.string(),
  },
  handler: async (_, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: args.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding as number[];
  },
});
