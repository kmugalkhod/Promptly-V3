import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
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

// List recent sessions (bounded to prevent unbounded growth)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_created")
      .order("desc")
      .take(50);
  },
});

// Client-facing update — limited to safe fields only
export const update = mutation({
  args: {
    id: v.id("sessions"),
    appName: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("new"), v.literal("active"), v.literal("archived"))
    ),
    supabaseUrl: v.optional(v.string()),
    supabaseAnonKey: v.optional(v.string()),
    supabaseConnected: v.optional(v.boolean()),
    supabaseProjectRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const session = await ctx.db.get(id);
    if (!session) {
      throw new Error("Session not found");
    }
    const cleanUpdates: Record<string, string | boolean | number> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value as string | boolean | number;
      }
    }
    await ctx.db.patch(id, cleanUpdates);
  },
});

// Internal update — for server-side use only (actions, other mutations)
export const updateInternal = internalMutation({
  args: {
    id: v.id("sessions"),
    appName: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    architecture: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("new"), v.literal("active"), v.literal("archived"))
    ),
    supabaseUrl: v.optional(v.string()),
    supabaseAnonKey: v.optional(v.string()),
    supabaseConnected: v.optional(v.boolean()),
    supabaseAccessToken: v.optional(v.string()),
    supabaseProjectRef: v.optional(v.string()),
    supabaseRefreshToken: v.optional(v.string()),
    supabaseTokenExpiry: v.optional(v.number()),
    schemaStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("validating"),
      v.literal("executing"),
      v.literal("success"),
      v.literal("error")
    )),
    schemaError: v.optional(v.string()),
    schemaTablesCreated: v.optional(v.number()),
    coderStatus: v.optional(v.union(
      v.literal("generating"),
      v.literal("validating"),
      v.literal("fixing"),
      v.literal("success"),
      v.literal("error")
    )),
    coderRetryCount: v.optional(v.number()),
    coderError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates: Record<string, string | boolean | number> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value as string | boolean | number;
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

// Get Supabase connection status for a session (public — no tokens)
export const getSupabaseStatus = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;
    return {
      supabaseUrl: session.supabaseUrl ?? null,
      supabaseAnonKey: session.supabaseAnonKey ?? null,
      supabaseConnected: session.supabaseConnected ?? false,
      supabaseProjectRef: session.supabaseProjectRef ?? null,
      schemaStatus: session.schemaStatus ?? null,
      schemaError: session.schemaError ?? null,
    };
  },
});

// Internal query — returns full status including tokens (for server use)
export const getSupabaseStatusInternal = internalQuery({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;
    return {
      supabaseUrl: session.supabaseUrl ?? null,
      supabaseAnonKey: session.supabaseAnonKey ?? null,
      supabaseConnected: session.supabaseConnected ?? false,
      supabaseAccessToken: session.supabaseAccessToken ?? null,
      supabaseProjectRef: session.supabaseProjectRef ?? null,
      supabaseRefreshToken: session.supabaseRefreshToken ?? null,
      supabaseTokenExpiry: session.supabaseTokenExpiry ?? null,
      schemaStatus: session.schemaStatus ?? null,
      schemaError: session.schemaError ?? null,
    };
  },
});

// Action for client to store Supabase OAuth credentials
export const connectSupabase = action({
  args: {
    sessionId: v.id("sessions"),
    supabaseUrl: v.string(),
    supabaseAnonKey: v.string(),
    supabaseProjectRef: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.sessions.updateInternal, {
      id: args.sessionId,
      supabaseUrl: args.supabaseUrl,
      supabaseAnonKey: args.supabaseAnonKey,
      supabaseConnected: true,
      supabaseProjectRef: args.supabaseProjectRef,
      supabaseAccessToken: args.accessToken,
      ...(args.refreshToken ? { supabaseRefreshToken: args.refreshToken } : {}),
      ...(args.expiresIn ? { supabaseTokenExpiry: Date.now() + args.expiresIn * 1000 } : {}),
    });
  },
});

// Action for client to clear Supabase credentials
export const disconnectSupabase = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.sessions.updateInternal, {
      id: args.sessionId,
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabaseConnected: false,
      supabaseAccessToken: "",
      supabaseProjectRef: "",
      supabaseRefreshToken: "",
    });
  },
});
