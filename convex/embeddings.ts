import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * File Embeddings Module
 *
 * Stores and queries file embeddings for semantic search.
 * Uses Convex vector search for similarity queries.
 */

const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_BATCH_SIZE = 20;

// Shared handler for upserting embeddings (used by both public and internal mutations)
const embeddingUpsertHandler = async (
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  args: {
    sessionId: import("./_generated/dataModel").Id<"sessions">;
    filePath: string;
    contentSummary: string;
    embedding: number[];
    fileType: string;
    exportedNames: string[];
    importCount: number;
  }
) => {
  if (args.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding must be exactly ${EMBEDDING_DIMENSIONS} dimensions, got ${args.embedding.length}`);
  }

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
};

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
  handler: embeddingUpsertHandler,
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
  handler: embeddingUpsertHandler,
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
    if (args.queryEmbedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Query embedding must be exactly ${EMBEDDING_DIMENSIONS} dimensions, got ${args.queryEmbedding.length}`);
    }

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

// Get all embeddings for a session (metadata only — excludes 1536D vectors)
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("fileEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return results.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      sessionId: r.sessionId,
      filePath: r.filePath,
      contentSummary: r.contentSummary,
      fileType: r.fileType,
      exportedNames: r.exportedNames,
      importCount: r.importCount,
      updatedAt: r.updatedAt,
    }));
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

    const results: string[] = [];

    // Process in batches of EMBEDDING_BATCH_SIZE
    for (let i = 0; i < args.files.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = args.files.slice(i, i + EMBEDDING_BATCH_SIZE);
      const summaries = batch.map((f) => f.contentSummary);

      // Retry up to 3 times per batch
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
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

          if (!data || !Array.isArray(data.data)) {
            throw new Error("Invalid OpenAI API response: missing data array");
          }
          for (const item of data.data) {
            if (!Array.isArray(item.embedding) || typeof item.index !== "number") {
              throw new Error("Invalid OpenAI API response: malformed embedding data");
            }
            if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
              throw new Error(`OpenAI returned ${item.embedding.length}-dimensional embedding, expected ${EMBEDDING_DIMENSIONS}`);
            }
          }

          const embeddings = data.data as Array<{ embedding: number[]; index: number }>;

          // Store each embedding
          for (const embeddingData of embeddings) {
            const file = batch[embeddingData.index];
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

          lastError = null;
          break; // Success — exit retry loop
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (attempt < 2) {
            const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
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

    if (!data?.data?.[0]?.embedding || !Array.isArray(data.data[0].embedding)) {
      throw new Error("Invalid OpenAI API response: missing embedding");
    }

    return data.data[0].embedding as number[];
  },
});
