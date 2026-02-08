"use node";

/**
 * Convex Sandbox Actions
 *
 * Server-side E2B sandbox management via Convex actions.
 * Actions support "use node" directive allowing npm package usage.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Sandbox } from "e2b";

/** E2B template with Next.js 16 + Tailwind v4 + shadcn/ui */
const TEMPLATE = "nextjs16-tailwind4";
/** Project directory in sandbox */
const PROJECT_DIR = "/home/user";
/** Sandbox timeout in seconds */
const TIMEOUT = 600;

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
      timeoutMs: TIMEOUT * 1000,
    });

    // Clean up default page.tsx to avoid conflicts
    console.log("Cleaning up default files...");
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);

    // Remove broken shadcn/ui components (resizable.tsx has compatibility issues)
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

    const sandboxId = sandbox.sandboxId;
    const previewUrl = `https://${sandbox.getHost(3000)}`;

    console.log(`Sandbox ready: ${sandboxId}`);
    console.log(`Preview URL: ${previewUrl}`);

    // Update session with sandbox info
    await ctx.runMutation(api.sessions.update, {
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

    // 5. Create fresh sandbox
    console.log(`[initializeForSession] Creating new sandbox for session ${args.sessionId}`);
    const sandbox = await Sandbox.create(TEMPLATE, {
      timeoutMs: TIMEOUT * 1000,
    });

    // Wait for sandbox dev server to be fully ready
    console.log(`[initializeForSession] Waiting for dev server to start...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 6. Clean up default template files (so restored files take precedence)
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/layout.tsx`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/globals.css`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

    // 7. Restore all files from Convex
    let restoredCount = 0;
    for (const file of files) {
      try {
        const fullPath = `${PROJECT_DIR}/${file.path}`;
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dirPath) {
          await sandbox.commands.run(`mkdir -p ${dirPath}`);
        }
        await sandbox.files.write(fullPath, file.content);
        restoredCount++;
      } catch (error) {
        console.error(`[initializeForSession] Failed to restore ${file.path}:`, error);
      }
    }
    console.log(`[initializeForSession] Restored ${restoredCount}/${files.length} files`);

    // 7a. Restore .env.local with Supabase credentials if connected
    const supabaseStatus = await ctx.runQuery(api.sessions.getSupabaseStatus, { id: args.sessionId });
    if (supabaseStatus?.supabaseConnected && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
      await sandbox.files.write(
        `${PROJECT_DIR}/.env.local`,
        `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`
      );
      console.log("[initializeForSession] Restored .env.local with Supabase credentials");
    }

    // 7b. Run npm install to restore packages
    console.log(`[initializeForSession] Running npm install...`);
    try {
      let installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
      if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
        installResult = await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
      }
    } catch (installError) {
      console.warn(`[initializeForSession] npm install error (non-fatal): ${installError}`);
    }

    // 8. Restart Next.js dev server for clean compilation with restored files
    // Hot reload can't reliably recompile CSS variables, @theme directives, and next/font declarations
    console.log(`[initializeForSession] Restarting dev server for clean compilation...`);
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
    // Wait for dev server to compile and be ready
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const sandboxId = sandbox.sandboxId;
    const previewUrl = `https://${sandbox.getHost(3000)}`;

    // 10. Update session with new sandbox info
    await ctx.runMutation(api.sessions.update, {
      id: args.sessionId,
      sandboxId,
      previewUrl,
      status: "active",
    });

    console.log(`[initializeForSession] Sandbox ready: ${sandboxId}`);
    return { success: true, previewUrl, sandboxId };
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
      // Connect to existing sandbox
      const sandbox = await Sandbox.connect(args.sandboxId);

      const fullPath = `${PROJECT_DIR}/${args.path}`;

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
    sandboxId: v.string(),
    path: v.string(),
  },
  handler: async (_, args): Promise<{ content: string | null; error?: string }> => {
    try {
      const sandbox = await Sandbox.connect(args.sandboxId);
      const fullPath = `${PROJECT_DIR}/${args.path}`;
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
    sandboxId: v.string(),
  },
  handler: async (_, args): Promise<{ alive: boolean; error?: string }> => {
    try {
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

    // Create new sandbox
    const sandbox = await Sandbox.create(TEMPLATE, {
      timeoutMs: TIMEOUT * 1000,
    });

    // Wait for sandbox dev server to be fully ready
    console.log(`[recreate] Waiting for dev server to start...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Clean up default template files (so restored files take precedence)
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/layout.tsx`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/globals.css`);
    await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

    const sandboxId = sandbox.sandboxId;
    const previewUrl = `https://${sandbox.getHost(3000)}`;

    // Get files from Convex backup
    const files = await ctx.runQuery(api.files.listBySession, {
      sessionId: args.sessionId,
    });

    // Restore files to new sandbox
    let restoredFiles = 0;
    for (const file of files) {
      try {
        const fullPath = `${PROJECT_DIR}/${file.path}`;
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dirPath) {
          await sandbox.commands.run(`mkdir -p ${dirPath}`);
        }
        await sandbox.files.write(fullPath, file.content);
        restoredFiles++;
        console.log(`Restored: ${file.path}`);
      } catch (error) {
        console.error(`Failed to restore ${file.path}: ${error}`);
      }
    }

    console.log(`Sandbox recreated: ${sandboxId}, restored ${restoredFiles} files`);

    // Restore .env.local with Supabase credentials if connected
    const supabaseStatus = await ctx.runQuery(api.sessions.getSupabaseStatus, { id: args.sessionId });
    if (supabaseStatus?.supabaseConnected && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
      await sandbox.files.write(
        `${PROJECT_DIR}/.env.local`,
        `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`
      );
      console.log("[recreate] Restored .env.local with Supabase credentials");
    }

    // Run npm install to restore packages
    console.log(`[recreate] Running npm install...`);
    try {
      let installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
      if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
        installResult = await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
      }
    } catch (installError) {
      console.warn(`[recreate] npm install error (non-fatal): ${installError}`);
    }

    // Restart Next.js dev server for clean compilation with restored files
    console.log(`[recreate] Restarting dev server for clean compilation...`);
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

    // Update session with new sandbox info
    await ctx.runMutation(api.sessions.update, {
      id: args.sessionId,
      sandboxId,
      previewUrl,
    });

    return { sandboxId, previewUrl, restoredFiles };
  },
});

/**
 * Run a command in the sandbox.
 */
export const runCommand = action({
  args: {
    sandboxId: v.string(),
    command: v.string(),
  },
  handler: async (_, args): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
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
    sandboxId: v.string(),
  },
  handler: async (_, args): Promise<{ success: boolean; error?: string }> => {
    try {
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
        const newSandbox = await Sandbox.create(TEMPLATE, {
          timeoutMs: TIMEOUT * 1000,
        });

        // Wait for sandbox dev server to be fully ready
        console.log(`[extendTimeout] Waiting for dev server to start...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Clean up default template files (so restored files take precedence)
        await newSandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);
        await newSandbox.commands.run(`rm -f ${PROJECT_DIR}/app/layout.tsx`);
        await newSandbox.commands.run(`rm -f ${PROJECT_DIR}/app/globals.css`);
        await newSandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

        const newSandboxId = newSandbox.sandboxId;
        const newPreviewUrl = `https://${newSandbox.getHost(3000)}`;

        // Get files from Convex backup
        const files = await ctx.runQuery(api.files.listBySession, {
          sessionId: args.sessionId,
        });

        // Restore files to new sandbox
        let restoredFiles = 0;
        for (const file of files) {
          try {
            const fullPath = `${PROJECT_DIR}/${file.path}`;
            const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
            if (dirPath) {
              await newSandbox.commands.run(`mkdir -p ${dirPath}`);
            }
            await newSandbox.files.write(fullPath, file.content);
            restoredFiles++;
          } catch (restoreError) {
            console.error(`Failed to restore ${file.path}: ${restoreError}`);
          }
        }

        console.log(`[extendTimeout] Sandbox recreated: ${newSandboxId}, restored ${restoredFiles} files`);

        // Restore .env.local with Supabase credentials if connected
        const supabaseStatus = await ctx.runQuery(api.sessions.getSupabaseStatus, { id: args.sessionId });
        if (supabaseStatus?.supabaseConnected && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
          await newSandbox.files.write(
            `${PROJECT_DIR}/.env.local`,
            `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`
          );
          console.log("[extendTimeout] Restored .env.local with Supabase credentials");
        }

        // Run npm install to restore packages
        console.log(`[extendTimeout] Running npm install...`);
        try {
          let installResult = await newSandbox.commands.run("npm install", { cwd: PROJECT_DIR });
          if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
            installResult = await newSandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
          }
        } catch (installError) {
          console.warn(`[extendTimeout] npm install error (non-fatal): ${installError}`);
        }

        // Restart Next.js dev server for clean compilation with restored files
        console.log(`[extendTimeout] Restarting dev server for clean compilation...`);
        try {
          await newSandbox.commands.run(`pkill -f "next" || true`);
        } catch {
          // pkill may throw due to signal termination — safe to ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          await newSandbox.commands.run(`cd ${PROJECT_DIR} && npm run dev > /tmp/next-dev.log 2>&1 &`, { timeoutMs: 5000 });
        } catch {
          // Background process launch may throw — safe to ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 8000));

        // Update session with new sandbox info
        await ctx.runMutation(api.sessions.update, {
          id: args.sessionId,
          sandboxId: newSandboxId,
          previewUrl: newPreviewUrl,
        });

        return {
          success: true,
          sandboxId: newSandboxId,
          previewUrl: newPreviewUrl,
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
    sandboxId: v.string(),
  },
  handler: async (_, args): Promise<{ success: boolean }> => {
    try {
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
