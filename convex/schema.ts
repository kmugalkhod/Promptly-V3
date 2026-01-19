import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Sessions - maps to ChatSession dataclass from Python reference
  sessions: defineTable({
    appName: v.optional(v.string()), // kebab-case app name
    previewUrl: v.optional(v.string()), // E2B sandbox URL
    sandboxId: v.optional(v.string()), // E2B sandbox ID for reconnection
    architecture: v.optional(v.string()), // architecture.md content
    status: v.union(
      v.literal("new"),
      v.literal("active"),
      v.literal("archived")
    ),
    createdAt: v.number(), // timestamp ms
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // Messages - maps to ChatMessage
  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_time", ["sessionId", "createdAt"]),

  // Files - maps to generated_files dict
  files: defineTable({
    sessionId: v.id("sessions"),
    path: v.string(), // e.g., "app/page.tsx"
    content: v.string(), // file content
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_path", ["sessionId", "path"]),

  // File embeddings for semantic search
  fileEmbeddings: defineTable({
    sessionId: v.id("sessions"),
    filePath: v.string(),
    // Summary of file content for embedding (not full content)
    contentSummary: v.string(),
    // 1536-dimensional embedding vector (OpenAI ada-002 compatible)
    embedding: v.array(v.float64()),
    // Metadata for filtering
    fileType: v.string(), // e.g., "component", "hook", "util", "style"
    exportedNames: v.array(v.string()), // Names exported from this file
    importCount: v.number(), // Number of imports in this file
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_path", ["sessionId", "filePath"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["sessionId"],
    }),
});
