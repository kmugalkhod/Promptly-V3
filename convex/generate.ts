"use node";

/**
 * Convex Generate Actions
 *
 * Main actions for AI app generation using the three-agent system:
 * - generate: Architecture → Coder workflow for new apps
 * - modify: Chat agent for modifying existing apps
 *
 * Uses E2B sandbox for live preview with hot reload.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Sandbox } from "e2b";

import {
  runArchitectureAgent,
  runCoderAgent,
  runChatAgent,
  type ToolContext,
  type SandboxActions,
} from "../lib/agents";
import { deriveAppName, extractAppNameFromArchitecture } from "../lib/utils/app-name";
import { SandboxErrorType, type SandboxError } from "../lib/sandbox/types";

// ============================================================================
// Simple Request Classification (from reference code)
// ============================================================================

/**
 * Check if message is requesting a new project (not a modification)
 */
function isNewProjectRequest(message: string): boolean {
  const keywords = [
    "build", "create", "make", "generate", "start",
    "new project", "new app", "new website",
    "i want a", "i need a", "can you build", "can you create",
  ];
  const messageLower = message.toLowerCase();
  return keywords.some((kw) => messageLower.includes(kw));
}

/**
 * Check if message requires architectural changes (recommend full rebuild)
 */
function isBigChangeRequest(message: string): boolean {
  const keywords = [
    "authentication", "auth", "login", "signup", "register",
    "payment", "stripe", "checkout",
    "new page", "add page", "create page", "new route",
    "database", "backend", "api endpoint",
    "restructure", "rebuild", "redesign completely",
  ];
  const messageLower = message.toLowerCase();
  return keywords.some((kw) => messageLower.includes(kw));
}

/** E2B template with Next.js 16 + Tailwind v4 + shadcn/ui */
const TEMPLATE = "nextjs16-tailwind4";
/** Project directory in sandbox */
const PROJECT_DIR = "/home/user";

/** Sandbox configuration with improved timeout and retry settings */
const SANDBOX_CONFIG = {
  /** Base timeout in seconds (15 minutes) */
  TIMEOUT_SECONDS: 900,
  /** Extended timeout for long operations in seconds (20 minutes) */
  EXTENDED_TIMEOUT_SECONDS: 1200,
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,
  /** Base delay between retries in milliseconds */
  RETRY_DELAY_MS: 2000,
} as const;

/**
 * Classify a sandbox error for appropriate handling.
 * Determines if the error is retryable and categorizes the type.
 */
function classifySandboxError(error: unknown): SandboxError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const messageLower = errorMessage.toLowerCase();

  // Timeout errors - retryable
  if (
    messageLower.includes("timeout") ||
    messageLower.includes("timed out") ||
    messageLower.includes("deadline exceeded")
  ) {
    return {
      type: SandboxErrorType.TIMEOUT,
      message: errorMessage,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Connection errors - retryable
  if (
    messageLower.includes("connection") ||
    messageLower.includes("connect") ||
    messageLower.includes("network") ||
    messageLower.includes("econnrefused") ||
    messageLower.includes("enotfound") ||
    messageLower.includes("socket") ||
    messageLower.includes("sandbox not found") ||
    messageLower.includes("not responsive")
  ) {
    return {
      type: SandboxErrorType.CONNECTION_FAILED,
      message: errorMessage,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Command execution errors - usually not retryable
  if (
    messageLower.includes("command failed") ||
    messageLower.includes("exit code") ||
    messageLower.includes("non-zero")
  ) {
    return {
      type: SandboxErrorType.COMMAND_FAILED,
      message: errorMessage,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // File operation errors - sometimes retryable
  if (
    messageLower.includes("file") ||
    messageLower.includes("enoent") ||
    messageLower.includes("permission denied") ||
    messageLower.includes("eacces")
  ) {
    return {
      type: SandboxErrorType.FILE_OPERATION_FAILED,
      message: errorMessage,
      retryable: messageLower.includes("enoent"), // Only retry if file not found (might be timing)
      originalError: error instanceof Error ? error : undefined,
    };
  }

  // Unknown error - conservative, not retryable
  return {
    type: SandboxErrorType.UNKNOWN,
    message: errorMessage,
    retryable: false,
    originalError: error instanceof Error ? error : undefined,
  };
}

/**
 * Retry options for withRetry function
 */
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, error: SandboxError) => void;
}

/**
 * Execute an operation with exponential backoff retry logic.
 * Only retries if the error is classified as retryable.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelayMs, onRetry } = options;
  let lastError: SandboxError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifySandboxError(error);

      // If not retryable, throw immediately
      if (!lastError.retryable) {
        throw error;
      }

      // If this was our last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `[withRetry] Attempt ${attempt}/${maxRetries} failed (${lastError.type}), retrying in ${delay}ms...`
      );

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError?.originalError ?? new Error("Max retries exceeded");
}

/**
 * Result of sandbox connection attempt
 */
interface SandboxConnectionResult {
  sandbox: Sandbox;
  sandboxId: string;
  previewUrl: string;
  wasRecreated: boolean;
}

/**
 * Connect to an existing sandbox or create a new one if expired.
 * Uses retry logic for transient connection failures.
 */
async function connectOrRecreateSandbox(
  existingSandboxId: string
): Promise<SandboxConnectionResult> {
  // First, try to connect to existing sandbox with retry
  try {
    const sandbox = await withRetry(
      async () => {
        const s = await Sandbox.connect(existingSandboxId);
        // Verify it's alive with a simple command
        const result = await s.commands.run("echo ok");
        if (result.exitCode !== 0) {
          throw new Error("Sandbox not responsive");
        }
        return s;
      },
      {
        maxRetries: 2, // Quick retry for connection
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          console.log(`[connectOrRecreateSandbox] Connection attempt ${attempt} failed: ${error.type}`);
        },
      }
    );

    return {
      sandbox,
      sandboxId: existingSandboxId,
      previewUrl: `https://${sandbox.getHost(3000)}`,
      wasRecreated: false,
    };
  } catch (error) {
    // Connection failed - need to recreate
    const sandboxError = classifySandboxError(error);
    console.log(
      `[connectOrRecreateSandbox] Sandbox expired or unreachable (${sandboxError.type}), recreating...`
    );
  }

  // Create new sandbox
  const sandbox = await Sandbox.create(TEMPLATE, {
    timeoutMs: SANDBOX_CONFIG.TIMEOUT_SECONDS * 1000,
  });

  // Clean up default files
  await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);
  await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

  const sandboxId = sandbox.sandboxId;
  const previewUrl = `https://${sandbox.getHost(3000)}`;

  console.log(`[connectOrRecreateSandbox] New sandbox created: ${sandboxId}`);

  return {
    sandbox,
    sandboxId,
    previewUrl,
    wasRecreated: true,
  };
}

/**
 * Restore files from Convex storage to a sandbox.
 */
async function restoreFilesToSandbox(
  sandbox: Sandbox,
  files: Array<{ path: string; content: string }>
): Promise<number> {
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
      console.log(`[restoreFilesToSandbox] Restored: ${file.path}`);
    } catch (error) {
      const sandboxError = classifySandboxError(error);
      console.error(
        `[restoreFilesToSandbox] Failed to restore ${file.path}: ${sandboxError.message}`
      );
    }
  }

  return restoredCount;
}

/**
 * Generate a new app from user requirements.
 * Runs: Architecture Agent → Coder Agent
 *
 * @returns Generated app info with preview URL
 */
export const generate = action({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    appName?: string;
    previewUrl?: string;
    filesCreated?: number;
    error?: string;
  }> => {
    const { sessionId, prompt } = args;

    console.log(`[generate] Starting generation for session ${sessionId}`);
    console.log(`[generate] Prompt: ${prompt.substring(0, 100)}...`);

    // Track recent files for context scoring
    const recentFiles: string[] = [];

    try {
      // 1. Create sandbox
      console.log("[generate] Creating E2B sandbox...");
      const sandbox = await Sandbox.create(TEMPLATE, {
        timeoutMs: SANDBOX_CONFIG.TIMEOUT_SECONDS * 1000,
      });

      // Clean up default files
      await sandbox.commands.run(`rm -f ${PROJECT_DIR}/app/page.tsx`);
      await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);

      const sandboxId = sandbox.sandboxId;
      const previewUrl = `https://${sandbox.getHost(3000)}`;

      console.log(`[generate] Sandbox ready: ${sandboxId}`);
      console.log(`[generate] Preview: ${previewUrl}`);

      // Update session with sandbox info
      await ctx.runMutation(api.sessions.update, {
        id: sessionId,
        sandboxId,
        previewUrl,
        status: "active",
      });

      // 2. Build tool context
      const files = new Map<string, string>();

      const toolContext: ToolContext = {
        sessionId,
        sandboxId,
        files,
        recentFiles,
      };

      // 3. Create sandbox actions for tools
      const sandboxActions: SandboxActions = {
        writeFile: async (path: string, content: string) => {
          const fullPath = `${PROJECT_DIR}/${path}`;
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
          if (dirPath) {
            await sandbox.commands.run(`mkdir -p ${dirPath}`);
          }
          await sandbox.files.write(fullPath, content);
          console.log(`[generate] Hot reload: ${path}`);

          // Backup to Convex
          await ctx.runMutation(api.files.upsert, {
            sessionId,
            path,
            content,
          });

          // Update local tracking
          files.set(path, content);
          if (!recentFiles.includes(path)) {
            recentFiles.unshift(path);
            if (recentFiles.length > 10) recentFiles.pop();
          }
        },

        readFile: async (path: string) => {
          // Check local cache first
          if (files.has(path)) {
            return files.get(path) ?? null;
          }
          // Read from sandbox
          try {
            const fullPath = `${PROJECT_DIR}/${path}`;
            const content = await sandbox.files.read(fullPath);
            files.set(path, content);
            return content;
          } catch {
            return null;
          }
        },

        runCommand: async (command: string) => {
          const result = await sandbox.commands.run(command, {
            cwd: PROJECT_DIR,
          });
          return {
            exitCode: result.exitCode,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
          };
        },

        deleteFile: async (path: string) => {
          const fullPath = `${PROJECT_DIR}/${path}`;
          await sandbox.commands.run(`rm -f ${fullPath}`);
          files.delete(path);
          // Remove from Convex
          await ctx.runMutation(api.files.removeByPath, {
            sessionId,
            path,
          });
        },

        listFiles: async (directory: string) => {
          const fullPath = directory ? `${PROJECT_DIR}/${directory}` : PROJECT_DIR;
          const result = await sandbox.commands.run(
            `find ${fullPath} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.json" 2>/dev/null | head -100`
          );
          if (result.exitCode !== 0) {
            return [];
          }
          return result.stdout
            .split("\n")
            .filter(Boolean)
            .map((p) => p.replace(`${PROJECT_DIR}/`, ""));
        },
      };

      // 4. Run Architecture Agent
      console.log("[generate] Running Architecture Agent...");
      const archResult = await runArchitectureAgent(prompt, toolContext, sandboxActions);

      if (archResult.error) {
        console.error(`[generate] Architecture failed: ${archResult.error}`);
        return {
          success: false,
          error: `Architecture planning failed: ${archResult.error}`,
        };
      }

      // Get architecture content
      const architecture = files.get("architecture.md") ?? archResult.response;
      console.log(`[generate] Architecture created (${architecture.length} chars)`);

      // Extract app name from architecture
      let appName = extractAppNameFromArchitecture(architecture);
      if (!appName) {
        appName = deriveAppName(prompt);
      }

      // Update session with architecture and app name
      await ctx.runMutation(api.sessions.update, {
        id: sessionId,
        architecture,
        appName,
      });

      // 5. Run Coder Agent
      console.log("[generate] Running Coder Agent...");
      const coderResult = await runCoderAgent(
        architecture,
        previewUrl,
        toolContext,
        sandboxActions
      );

      if (coderResult.error) {
        console.error(`[generate] Coder failed: ${coderResult.error}`);
        // Still return partial success if some files were created
        if (coderResult.filesChanged.length > 0) {
          return {
            success: true,
            appName,
            previewUrl,
            filesCreated: coderResult.filesChanged.length,
            error: coderResult.error,
          };
        }
        return {
          success: false,
          error: `Code generation failed: ${coderResult.error}`,
        };
      }

      console.log(`[generate] Created ${coderResult.filesChanged.length} files`);
      console.log(`[generate] Files: ${coderResult.filesChanged.join(", ")}`);

      // 6. Ensure all key files are saved to Convex (including template files that might have been used)
      console.log("[generate] Syncing all key files to Convex...");
      const keyFiles = [
        "app/globals.css",
        "app/layout.tsx",
        "app/page.tsx",
        "tailwind.config.ts",
        "tailwind.config.js",
      ];

      for (const filePath of keyFiles) {
        // Skip if already saved
        if (files.has(filePath)) continue;

        try {
          const fullPath = `${PROJECT_DIR}/${filePath}`;
          const content = await sandbox.files.read(fullPath);
          if (content) {
            await ctx.runMutation(api.files.upsert, {
              sessionId,
              path: filePath,
              content,
            });
            console.log(`[generate] Synced template file: ${filePath}`);
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      return {
        success: true,
        appName,
        previewUrl,
        filesCreated: coderResult.filesChanged.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[generate] Fatal error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Modify an existing app using the Chat Agent.
 *
 * @returns Modification result with updated files
 */
export const modify = action({
  args: {
    sessionId: v.id("sessions"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    response?: string;
    filesChanged?: string[];
    error?: string;
  }> => {
    const { sessionId, message } = args;

    console.log(`[modify] Starting modification for session ${sessionId}`);
    console.log(`[modify] Message: ${message.substring(0, 100)}...`);

    try {
      // 1. Get session info
      const session = await ctx.runQuery(api.sessions.get, { id: sessionId });
      if (!session) {
        return { success: false, error: "Session not found" };
      }

      // 2. Connect to existing sandbox or recreate
      if (!session.sandboxId) {
        return { success: false, error: "No sandbox associated with session" };
      }

      let sandbox: Sandbox;
      let sandboxId = session.sandboxId;
      let previewUrl = session.previewUrl;

      try {
        const connectionResult = await connectOrRecreateSandbox(
          session.sandboxId
        );

        sandbox = connectionResult.sandbox;
        sandboxId = connectionResult.sandboxId;
        previewUrl = connectionResult.previewUrl;

        // If sandbox was recreated, restore files and update session
        if (connectionResult.wasRecreated) {
          const storedFiles = await ctx.runQuery(api.files.listBySession, {
            sessionId,
          });

          const restoredCount = await restoreFilesToSandbox(sandbox, storedFiles);
          console.log(`[modify] Restored ${restoredCount} files to new sandbox`);

          // Update session with new sandbox info
          await ctx.runMutation(api.sessions.update, {
            id: sessionId,
            sandboxId,
            previewUrl,
          });
        }
      } catch (error) {
        const sandboxError = classifySandboxError(error);
        console.error(`[modify] Failed to connect/recreate sandbox: ${sandboxError.message}`);
        return {
          success: false,
          error: `Sandbox connection failed: ${sandboxError.message}. Please try again.`,
        };
      }

      // 3. Load files from Convex into map
      const storedFiles = await ctx.runQuery(api.files.listBySession, {
        sessionId,
      });
      const files = new Map<string, string>();
      const recentFiles: string[] = [];

      for (const file of storedFiles) {
        files.set(file.path, file.content);
      }

      // 4. Build tool context
      const toolContext: ToolContext = {
        sessionId,
        sandboxId: sandboxId!,
        files,
        recentFiles,
      };

      // 5. Create sandbox actions
      const sandboxActions: SandboxActions = {
        writeFile: async (path: string, content: string) => {
          const fullPath = `${PROJECT_DIR}/${path}`;
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
          if (dirPath) {
            await sandbox.commands.run(`mkdir -p ${dirPath}`);
          }
          await sandbox.files.write(fullPath, content);
          console.log(`[modify] Hot reload: ${path}`);

          await ctx.runMutation(api.files.upsert, {
            sessionId,
            path,
            content,
          });

          files.set(path, content);
          if (!recentFiles.includes(path)) {
            recentFiles.unshift(path);
            if (recentFiles.length > 10) recentFiles.pop();
          }
        },

        readFile: async (path: string) => {
          if (files.has(path)) {
            return files.get(path) ?? null;
          }
          try {
            const fullPath = `${PROJECT_DIR}/${path}`;
            const content = await sandbox.files.read(fullPath);
            files.set(path, content);
            return content;
          } catch {
            return null;
          }
        },

        runCommand: async (command: string) => {
          const result = await sandbox.commands.run(command, {
            cwd: PROJECT_DIR,
          });
          return {
            exitCode: result.exitCode,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
          };
        },

        deleteFile: async (path: string) => {
          const fullPath = `${PROJECT_DIR}/${path}`;
          await sandbox.commands.run(`rm -f ${fullPath}`);
          files.delete(path);
          // Remove from Convex
          await ctx.runMutation(api.files.removeByPath, {
            sessionId,
            path,
          });
        },

        listFiles: async (directory: string) => {
          const fullPath = directory ? `${PROJECT_DIR}/${directory}` : PROJECT_DIR;
          const result = await sandbox.commands.run(
            `find ${fullPath} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.json" 2>/dev/null | head -100`
          );
          if (result.exitCode !== 0) {
            return [];
          }
          return result.stdout
            .split("\n")
            .filter(Boolean)
            .map((p) => p.replace(`${PROJECT_DIR}/`, ""));
        },
      };

      // 6. Route based on request type (from reference code)

      // If it's a new project request and no files exist, tell user to use generate
      if (isNewProjectRequest(message) && files.size === 0) {
        return {
          success: false,
          error: "This looks like a new project request. Please use the generate workflow instead of modify.",
        };
      }

      // If it's a big change request, warn the user
      if (isBigChangeRequest(message)) {
        console.log("[modify] Big change detected, warning user...");
        // Still try with Chat Agent but include warning in response
      }

      // 7. Run Chat Agent
      console.log("[modify] Running Chat Agent...");
      const chatResult = await runChatAgent(message, toolContext, sandboxActions);

      if (chatResult.error) {
        console.error(`[modify] Chat agent error: ${chatResult.error}`);
        // Return partial success if some changes were made
        if (chatResult.filesChanged.length > 0) {
          return {
            success: true,
            response: chatResult.response,
            filesChanged: chatResult.filesChanged,
            error: chatResult.error,
          };
        }
        return {
          success: false,
          error: chatResult.error,
        };
      }

      console.log(`[modify] Modified ${chatResult.filesChanged.length} files`);

      // 8. Ensure all key files are saved to Convex
      console.log("[modify] Syncing key files to Convex...");
      const keyFiles = [
        "app/globals.css",
        "app/layout.tsx",
        "app/page.tsx",
      ];

      for (const filePath of keyFiles) {
        if (files.has(filePath)) continue;
        try {
          const fullPath = `${PROJECT_DIR}/${filePath}`;
          const content = await sandbox.files.read(fullPath);
          if (content) {
            await ctx.runMutation(api.files.upsert, {
              sessionId,
              path: filePath,
              content,
            });
            console.log(`[modify] Synced file: ${filePath}`);
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      return {
        success: true,
        response: chatResult.response,
        filesChanged: chatResult.filesChanged,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[modify] Fatal error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
