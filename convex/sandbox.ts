"use node";

/**
 * Convex Sandbox Actions
 *
 * Server-side E2B sandbox management via Convex actions.
 * Actions support "use node" directive allowing npm package usage.
 */

import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { Sandbox } from "e2b";
import { TEMPLATE, PROJECT_DIR, SANDBOX_CONFIG, TEMPLATE_CLEANUP_FILES } from "./constants";

/**
 * Sanitize a file path to prevent directory traversal attacks.
 * Rejects paths containing "..", leading "/", or empty paths.
 */
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

  return cleaned;
}

/**
 * Shared helper: create a fresh sandbox, restore files, install packages, restart dev server.
 * Consolidates the 7 duplicated patterns across initializeForSession, recreate, and extendTimeout.
 */
async function createSandboxWithFiles(
  ctx: ActionCtx,
  sessionId: Id<"sessions">,
  files: Array<{ path: string; content: string }>,
  logPrefix: string,
  options?: { setStatusActive?: boolean }
): Promise<{ sandbox: Sandbox; sandboxId: string; previewUrl: string; restoredFiles: number }> {
  // 1. Create sandbox + wait for dev server
  const sandbox = await Sandbox.create(TEMPLATE, {
    timeoutMs: SANDBOX_CONFIG.SHORT_TIMEOUT_SECONDS * 1000,
  });

  console.log(`[${logPrefix}] Waiting for dev server to start...`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 2. Clean up default template files
  for (const filePath of TEMPLATE_CLEANUP_FILES) {
    await sandbox.commands.run(`rm -f ${filePath}`);
  }

  // 3. Restore files from Convex
  let restoredFiles = 0;
  for (const file of files) {
    try {
      const safePath = sanitizePath(file.path);
      const fullPath = `${PROJECT_DIR}/${safePath}`;
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath) {
        await sandbox.commands.run(`mkdir -p ${dirPath}`);
      }
      await sandbox.files.write(fullPath, file.content);
      restoredFiles++;
    } catch (error) {
      console.error(`[${logPrefix}] Failed to restore ${file.path}:`, error);
    }
  }
  console.log(`[${logPrefix}] Restored ${restoredFiles}/${files.length} files`);

  // 4. Restore .env.local with Supabase credentials if connected
  const supabaseStatus = await ctx.runQuery(internal.sessions.getSupabaseStatusInternal, { id: sessionId });
  if (supabaseStatus?.supabaseConnected && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
    await sandbox.files.write(
      `${PROJECT_DIR}/.env.local`,
      `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`
    );
    console.log(`[${logPrefix}] Restored .env.local with Supabase credentials`);
  }

  // 5. npm install with ERESOLVE fallback
  console.log(`[${logPrefix}] Running npm install...`);
  try {
    let installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
    if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
      installResult = await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
    }
  } catch (installError) {
    console.warn(`[${logPrefix}] npm install error (non-fatal): ${installError}`);
  }

  // 6. Restart dev server
  console.log(`[${logPrefix}] Restarting dev server for clean compilation...`);
  try {
    await sandbox.commands.run(`pkill -f "next" || true`);
  } catch {
    // pkill may throw due to signal termination — safe to ignore
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    await sandbox.commands.run(`cd ${PROJECT_DIR} && npm run dev > /tmp/next-dev.log 2>&1 &`, { timeoutMs: 5000 });
  } catch {
    // Background process launch may throw — safe to ignore
  }
  await new Promise((resolve) => setTimeout(resolve, 8000));

  const sandboxId = sandbox.sandboxId;
  const previewUrl = `https://${sandbox.getHost(3000)}`;

  // 7. Update session
  await ctx.runMutation(internal.sessions.updateInternal, {
    id: sessionId,
    sandboxId,
    previewUrl,
    ...(options?.setStatusActive ? { status: "active" as const } : {}),
  });

  console.log(`[${logPrefix}] Sandbox ready: ${sandboxId}`);
  return { sandbox, sandboxId, previewUrl, restoredFiles };
}

/**
 * Create a new E2B sandbox for a session.
 * Stores sandboxId and previewUrl in the session.
 */
export const create = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{ sandboxId: string; previewUrl: string }> => {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error("E2B_API_KEY is not configured");
    }

    console.log(`Creating sandbox with template: ${TEMPLATE}`);

    // Create sandbox
    const sandbox = await Sandbox.create(TEMPLATE, {
      timeoutMs: SANDBOX_CONFIG.SHORT_TIMEOUT_SECONDS * 1000,
    });

    // Clean up default template files
    console.log("Cleaning up default files...");
    for (const filePath of TEMPLATE_CLEANUP_FILES) {
      await sandbox.commands.run(`rm -f ${filePath}`);
    }

    const sandboxId = sandbox.sandboxId;
    const previewUrl = `https://${sandbox.getHost(3000)}`;

    console.log(`Sandbox ready: ${sandboxId}`);
    console.log(`Preview URL: ${previewUrl}`);

    // Update session with sandbox info
    await ctx.runMutation(internal.sessions.updateInternal, {
      id: args.sessionId,
      sandboxId,
      previewUrl,
      status: "active",
    });

    return { sandboxId, previewUrl };
  },
});

/**
 * Initialize or restore sandbox for an existing session.
 * Called when entering the builder page to ensure sandbox is ready.
 * - If session has no files, returns early (new project flow handles creation)
 * - If sandbox is still alive, returns existing info
 * - If sandbox expired, creates fresh one and restores files from Convex
 */
export const initializeForSession = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    previewUrl?: string;
    sandboxId?: string;
    error?: string;
  }> => {
    // 1. Get session
    const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // 2. Get files from Convex
    const files = await ctx.runQuery(api.files.listBySession, { sessionId: args.sessionId });

    // 3. If no files, don't create sandbox (new project flow will handle it)
    if (!files || files.length === 0) {
      return { success: true }; // No sandbox needed yet
    }

    // 4. Try to connect to existing sandbox first
    if (session.sandboxId) {
      try {
        const sandbox = await Sandbox.connect(session.sandboxId);
        const result = await sandbox.commands.run("echo ok");
        if (result.exitCode === 0) {
          // Sandbox still alive, just return current info
          console.log(`[initializeForSession] Sandbox ${session.sandboxId} still alive`);
          return {
            success: true,
            previewUrl: session.previewUrl,
            sandboxId: session.sandboxId,
          };
        }
      } catch {
        // Sandbox expired, will create new one
        console.log(`[initializeForSession] Sandbox expired, creating new one...`);
      }
    }

    // 5. Create fresh sandbox with file restoration
    console.log(`[initializeForSession] Creating new sandbox for session ${args.sessionId}`);
    const result = await createSandboxWithFiles(
      ctx, args.sessionId, files,
      "initializeForSession",
      { setStatusActive: true }
    );

    return { success: true, previewUrl: result.previewUrl, sandboxId: result.sandboxId };
  },
});

/**
 * Write a file to the sandbox (triggers hot reload).
 * Also backs up the file to Convex for persistence.
 */
export const writeFile = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Verify sandbox belongs to session
      const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
      if (!session || session.sandboxId !== args.sandboxId) {
        return { success: false, error: "Sandbox does not belong to session" };
      }

      // Connect to existing sandbox
      const sandbox = await Sandbox.connect(args.sandboxId);

      const safePath = sanitizePath(args.path);
      const fullPath = `${PROJECT_DIR}/${safePath}`;

      // Create directory if needed
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath) {
        await sandbox.commands.run(`mkdir -p ${dirPath}`);
      }

      // Write to sandbox (triggers hot reload)
      await sandbox.files.write(fullPath, args.content);
      console.log(`Hot reload: ${args.path}`);

      // Backup to Convex
      await ctx.runMutation(api.files.upsert, {
        sessionId: args.sessionId,
        path: args.path,
        content: args.content,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Write failed for ${args.path}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Read a file from the sandbox.
 */
export const readFile = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args): Promise<{ content: string | null; error?: string }> => {
    try {
      // Verify sandbox belongs to session
      const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
      if (!session || session.sandboxId !== args.sandboxId) {
        return { content: null, error: "Sandbox does not belong to session" };
      }

      const sandbox = await Sandbox.connect(args.sandboxId);
      const safePath = sanitizePath(args.path);
      const fullPath = `${PROJECT_DIR}/${safePath}`;
      const content = await sandbox.files.read(fullPath);
      return { content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { content: null, error: errorMessage };
    }
  },
});

/**
 * Check if sandbox is still alive.
 */
export const checkStatus = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<{ alive: boolean; error?: string }> => {
    try {
      // Verify sandbox belongs to session
      const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
      if (!session || session.sandboxId !== args.sandboxId) {
        return { alive: false, error: "Sandbox does not belong to session" };
      }

      const sandbox = await Sandbox.connect(args.sandboxId);
      // Run a simple command to verify it's responsive
      const result = await sandbox.commands.run("echo ok");
      return { alive: result.exitCode === 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { alive: false, error: errorMessage };
    }
  },
});

/**
 * Recreate sandbox after timeout and restore files from Convex.
 */
export const recreate = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{ sandboxId: string; previewUrl: string; restoredFiles: number }> => {
    console.log("Recreating sandbox after timeout...");

    // Get files from Convex backup
    const files = await ctx.runQuery(api.files.listBySession, {
      sessionId: args.sessionId,
    });

    const result = await createSandboxWithFiles(ctx, args.sessionId, files, "recreate");
    return { sandboxId: result.sandboxId, previewUrl: result.previewUrl, restoredFiles: result.restoredFiles };
  },
});

/**
 * Run a command in the sandbox.
 */
export const runCommand = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
    command: v.string(),
  },
  handler: async (ctx, args): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    // Verify sandbox belongs to session
    const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
    if (!session || session.sandboxId !== args.sandboxId) {
      throw new Error("Sandbox does not belong to session");
    }

    const sandbox = await Sandbox.connect(args.sandboxId);
    const result = await sandbox.commands.run(args.command);
    return {
      exitCode: result.exitCode,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  },
});

/**
 * Keep sandbox alive during long operations.
 * Runs a lightweight command to prevent timeout.
 */
export const keepAlive = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Verify sandbox belongs to session
      const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
      if (!session || session.sandboxId !== args.sandboxId) {
        return { success: false, error: "Sandbox does not belong to session" };
      }

      const sandbox = await Sandbox.connect(args.sandboxId);
      // Run a lightweight command to keep the sandbox alive
      const result = await sandbox.commands.run("echo keepalive");
      if (result.exitCode === 0) {
        console.log(`[keepAlive] Sandbox ${args.sandboxId} kept alive`);
        return { success: true };
      }
      return { success: false, error: "Keep-alive command failed" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[keepAlive] Failed for ${args.sandboxId}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Extend sandbox timeout.
 * Creates a new sandbox if the current one is expired and restores files.
 */
export const extendTimeout = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    sandboxId?: string;
    previewUrl?: string;
    wasRecreated?: boolean;
    error?: string;
  }> => {
    try {
      // First try to keep the existing sandbox alive
      const sandbox = await Sandbox.connect(args.sandboxId);
      const result = await sandbox.commands.run("echo ok");

      if (result.exitCode === 0) {
        console.log(`[extendTimeout] Sandbox ${args.sandboxId} still alive`);
        return {
          success: true,
          sandboxId: args.sandboxId,
          previewUrl: `https://${sandbox.getHost(3000)}`,
          wasRecreated: false,
        };
      }

      throw new Error("Sandbox not responsive");
    } catch {
      // Sandbox expired - recreate it
      console.log(`[extendTimeout] Sandbox expired, recreating...`);

      try {
        // Get files from Convex backup
        const files = await ctx.runQuery(api.files.listBySession, {
          sessionId: args.sessionId,
        });

        const result = await createSandboxWithFiles(ctx, args.sessionId, files, "extendTimeout");

        return {
          success: true,
          sandboxId: result.sandboxId,
          previewUrl: result.previewUrl,
          wasRecreated: true,
        };
      } catch (createError) {
        const errorMessage = createError instanceof Error ? createError.message : "Unknown error";
        console.error(`[extendTimeout] Failed to recreate sandbox: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    }
  },
});

/**
 * Close/kill a sandbox.
 */
export const close = action({
  args: {
    sessionId: v.id("sessions"),
    sandboxId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    try {
      // Verify sandbox belongs to session
      const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId });
      if (!session || session.sandboxId !== args.sandboxId) {
        return { success: false };
      }

      const sandbox = await Sandbox.connect(args.sandboxId);
      await sandbox.kill();
      console.log(`Sandbox closed: ${args.sandboxId}`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to close sandbox: ${error}`);
      return { success: false };
    }
  },
});
