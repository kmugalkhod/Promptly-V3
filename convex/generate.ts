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
import { internal, api } from "./_generated/api";
import { Sandbox } from "e2b";

import {
  runArchitectureAgent,
  runCoderAgent,
  runChatAgent,
  runSchemaAgent,
  runQAAgent,
  parseQAFindings,
  type ToolContext,
  type SandboxActions,
  type QAResult,
} from "../lib/agents";
import { deriveAppName, extractAppNameFromArchitecture } from "../lib/utils/app-name";
import { extractDesignTokens, formatDesignTokensForCoder } from "../lib/utils/design-tokens";
import { extractDatabaseSection } from "../lib/utils/database-extraction";
import { validateAndFixDesign } from "../lib/utils/design-validation";
import { validateGeneratedCode } from "../lib/utils/code-validation";
import { validateCoderOutput } from "../lib/utils/coder-validation";
import { formatCoderRetryPrompt, formatQARetryPrompt } from "../lib/prompts";
import { extractPackagesFromArchitecture } from "../lib/utils/package-extraction";
import { SandboxErrorType, type SandboxError } from "../lib/sandbox/types";
import { KEY_FILES, PROJECT_DIR, TEMPLATE, SANDBOX_CONFIG } from "./constants";

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
 * Check if message implies the app needs database/data persistence
 */
function needsDatabaseIntegration(message: string): boolean {
  const keywords = [
    "save", "store", "persist", "database", "backend", "crud",
    "todo", "tasks", "posts", "blog", "users", "user data",
    "inventory", "orders", "bookmark", "favorites", "notes",
    "records", "entries", "items list", "track", "manage",
  ];
  const messageLower = message.toLowerCase();
  return keywords.some((kw) => messageLower.includes(kw));
}

// ============================================================================
// Architecture Complexity Estimation
// ============================================================================

/**
 * Complexity levels for architecture-based resource scaling.
 * Determines coder agent recursion limits and fix-mode budgets.
 */
type ArchitectureComplexity = "simple" | "moderate" | "complex";

/**
 * Recursion limits for the coder agent based on architecture complexity.
 * Initial: budget for first generation pass.
 * Fix: budget for self-healing fix attempts (lower since they're targeted).
 */
const CODER_RECURSION_LIMITS: Record<ArchitectureComplexity, { initial: number; fix: number }> = {
  simple: { initial: 150, fix: 50 },
  moderate: { initial: 200, fix: 75 },
  complex: { initial: 300, fix: 100 },
};

/**
 * Estimate architecture complexity by analyzing the architecture document.
 * Uses heuristics based on table count, route count, auth presence,
 * and component count to classify the app.
 *
 * Complex: 5+ tables, or 8+ routes, or auth + 3+ tables
 * Moderate: 2+ tables, or 4+ routes, or has auth
 * Simple: everything else (landing pages, simple UIs)
 */
function estimateArchitectureComplexity(architecture: string): ArchitectureComplexity {
  const text = architecture.toLowerCase();

  // Count database tables (look for table definitions in DATABASE section)
  const tableMatches = text.match(/\btable\b[:\s]+\w+|\bcreate\s+table\b|\|\s*\w+\s*\|.*\bpk\b/gi);
  const tableCount = tableMatches ? tableMatches.length : 0;

  // Count routes (look for route paths like /dashboard, /settings, /[id])
  const routeSection = architecture.match(/routes?[:\s]*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
  const routeText = routeSection ? routeSection[1] : architecture;
  const routeMatches = routeText.match(/\/[\w[\]-]+/g);
  const routeCount = routeMatches ? new Set(routeMatches).size : 0;

  // Check for auth
  const hasAuth = /\bauth\b|authentication|login\s+page|signup|sign.?up|oauth/i.test(text);

  // Count components (look for component names in COMPONENTS section)
  const componentMatches = text.match(/component[:\s]+\w+|\b\w+(?:page|form|list|card|modal|dialog|sidebar|header|nav)\b/gi);
  const componentCount = componentMatches ? new Set(componentMatches).size : 0;

  // Classification logic
  if (tableCount >= 5 || routeCount >= 8 || componentCount >= 15 || (hasAuth && tableCount >= 3)) {
    return "complex";
  }
  if (tableCount >= 2 || routeCount >= 4 || componentCount >= 8 || hasAuth) {
    return "moderate";
  }
  return "simple";
}

/**
 * Refresh an OAuth access token if it is expired or near expiry.
 * Calls Supabase OAuth token endpoint directly (no Next.js roundtrip).
 * Returns the current or refreshed access token, or null if unavailable.
 */
async function refreshTokenIfNeeded(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  supabaseStatus: {
    supabaseAccessToken: string | null;
    supabaseRefreshToken: string | null;
    supabaseTokenExpiry: number | null;
  }
): Promise<string | null> {
  const token = supabaseStatus.supabaseAccessToken;
  const expiry = supabaseStatus.supabaseTokenExpiry;
  const refreshToken = supabaseStatus.supabaseRefreshToken;

  if (!token) return null;

  // If token not expired (with 2-minute buffer), use it
  if (expiry && Date.now() < expiry - 2 * 60 * 1000) {
    return token;
  }

  // Token expired or near expiry — try refresh
  if (!refreshToken) return token;

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return token;

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: body.toString(),
    });

    if (res.ok) {
      const data = await res.json();

      if (
        typeof data.access_token !== "string" ||
        typeof data.refresh_token !== "string" ||
        typeof data.expires_in !== "number"
      ) {
        console.error("[refreshTokenIfNeeded] Invalid token response shape:", Object.keys(data));
        return token;
      }

      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        supabaseAccessToken: data.access_token,
        supabaseRefreshToken: data.refresh_token,
        supabaseTokenExpiry: Date.now() + (data.expires_in * 1000),
      });
      console.log("[refreshTokenIfNeeded] Token refreshed successfully");
      return data.access_token;
    } else {
      console.error("[refreshTokenIfNeeded] Refresh failed:", res.status);
    }
  } catch (e) {
    console.error("[refreshTokenIfNeeded] Refresh error:", e);
  }

  // Refresh failed — return existing token (may still work)
  return token;
}

/**
 * Schema error types for classification and user messaging.
 */
type SchemaErrorType = "auth" | "syntax" | "rate_limit" | "server" | "timeout" | "network" | "unknown";

interface SchemaError {
  type: SchemaErrorType;
  userMessage: string;
  retryable: boolean;
  rawError: string;
}

/**
 * Classify a schema execution error by HTTP status code and response text.
 * Returns a structured error with user-actionable message.
 */
function classifySchemaError(statusCode: number, errorText: string): SchemaError {
  const rawError = errorText.substring(0, 500);

  // Try to parse JSON error message
  let parsedMessage = errorText;
  try {
    const parsed = JSON.parse(errorText);
    if (parsed.message) parsedMessage = parsed.message;
  } catch {
    // Not JSON — use raw text
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      type: "auth",
      userMessage: "Your Supabase session expired. Please reconnect Supabase in Settings and regenerate.",
      retryable: false,
      rawError,
    };
  }

  if (statusCode === 429) {
    return {
      type: "rate_limit",
      userMessage: "Supabase API is busy. Please run schema.sql manually in the Supabase SQL Editor.",
      retryable: true,
      rawError,
    };
  }

  if (statusCode >= 500) {
    return {
      type: "server",
      userMessage: "Supabase server error. Please try again or run schema.sql manually in the Supabase SQL Editor.",
      retryable: true,
      rawError,
    };
  }

  if (statusCode === 400) {
    return {
      type: "syntax",
      userMessage: `SQL error in schema.sql: ${parsedMessage}. The generated schema may have an issue — try regenerating.`,
      retryable: false,
      rawError,
    };
  }

  return {
    type: "unknown",
    userMessage: `${parsedMessage}. You may need to run schema.sql manually in the Supabase SQL Editor.`,
    retryable: false,
    rawError,
  };
}

/**
 * Classify a fetch/network error (when fetch itself throws).
 */
function classifySchemaFetchError(error: unknown): SchemaError {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Error && error.name === "AbortError") {
    return {
      type: "timeout",
      userMessage: "Database setup timed out. Please run schema.sql manually in the Supabase SQL Editor.",
      retryable: true,
      rawError: message,
    };
  }

  return {
    type: "network",
    userMessage: "Network error connecting to Supabase. Please check your connection and try again.",
    retryable: true,
    rawError: message,
  };
}

/** Timeout for Management API fetch calls (30 seconds) */
const SCHEMA_FETCH_TIMEOUT_MS = 30_000;

/**
 * Execute schema.sql against Supabase with validation and retry logic.
 * Uses exponential backoff with jitter, 30s fetch timeout, and error classification.
 * Updates session schemaStatus throughout the process.
 */
async function executeSchemaWithRetry(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  schemaContent: string,
  projectRef: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Step 1: Validate with dry-run (read_only: true)
  await ctx.runMutation(internal.sessions.updateInternal, {
    id: sessionId,
    schemaStatus: "validating" as const,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCHEMA_FETCH_TIMEOUT_MS);

    const validateRes = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: schemaContent, read_only: true }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!validateRes.ok) {
      const errText = await validateRes.text();
      // DDL statements (CREATE TABLE, etc.) cannot run in read-only mode — this is expected, skip to execution
      if (errText.includes("read-only transaction") || errText.includes("25006")) {
        console.warn("[executeSchema] Dry-run validation skipped: DDL not supported in read-only mode");
      } else {
        // Genuine SQL syntax error — fail early with classified error
        const classified = classifySchemaError(validateRes.status, errText);
        await ctx.runMutation(internal.sessions.updateInternal, {
          id: sessionId,
          schemaStatus: "error" as const,
          schemaError: classified.userMessage,
        });
        return { success: false, error: classified.userMessage };
      }
    }
  } catch (e) {
    // Network error or other issue — skip validation, proceed to execution
    console.warn("[executeSchema] Dry-run validation skipped:", e);
  }

  // Step 2: Execute with retry (max 3 attempts, exponential backoff + jitter)
  await ctx.runMutation(internal.sessions.updateInternal, {
    id: sessionId,
    schemaStatus: "executing" as const,
  });

  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 1000;
  let lastClassifiedError: SchemaError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCHEMA_FETCH_TIMEOUT_MS);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: schemaContent, read_only: false }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        await ctx.runMutation(internal.sessions.updateInternal, {
          id: sessionId,
          schemaStatus: "success" as const,
          schemaError: "",
        });
        console.log(`[executeSchema] Schema executed successfully (attempt ${attempt})`);

        // Reload PostgREST schema cache so the JS client can see new tables immediately
        try {
          const reloadRes = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema'", read_only: false }),
          });
          if (reloadRes.ok) {
            console.log("[executeSchema] PostgREST schema cache reload triggered");
            // Wait for PostgREST to process the reload — without this delay,
            // the app may query before PostgREST refreshes, causing
            // "Could not find the table in the schema cache" errors
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log("[executeSchema] PostgREST reload delay complete");
          } else {
            console.warn("[executeSchema] Schema cache reload failed (non-fatal):", await reloadRes.text());
          }
        } catch (e) {
          console.warn("[executeSchema] Schema cache reload error (non-fatal):", e);
        }

        return { success: true };
      }

      const errText = await res.text();
      lastClassifiedError = classifySchemaError(res.status, errText);
      console.error(`[executeSchema] Attempt ${attempt} failed (${lastClassifiedError.type}): ${errText.substring(0, 200)}`);

      // Skip remaining retries for non-retryable errors
      if (!lastClassifiedError.retryable) {
        break;
      }
    } catch (e) {
      lastClassifiedError = classifySchemaFetchError(e);
      console.error(`[executeSchema] Attempt ${attempt} error (${lastClassifiedError.type}): ${lastClassifiedError.rawError}`);

      // Skip remaining retries for non-retryable errors
      if (!lastClassifiedError.retryable) {
        break;
      }
    }

    // Exponential backoff with jitter before next attempt
    if (attempt < MAX_ATTEMPTS) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
      console.log(`[executeSchema] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const errorMessage = lastClassifiedError?.userMessage ?? "Unknown error during schema execution";
  await ctx.runMutation(internal.sessions.updateInternal, {
    id: sessionId,
    schemaStatus: "error" as const,
    schemaError: errorMessage,
  });
  return { success: false, error: errorMessage };
}

/**
 * Verify that tables were actually created after schema execution.
 * Queries information_schema.tables to get public table names.
 * Gracefully degrades on failure — schema execution is still considered successful.
 */
async function verifySchemaHealthCheck(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  projectRef: string,
  token: string,
): Promise<{ success: boolean; tableCount: number; tables: string[]; error?: string }> {
  const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const healthCheckQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCHEMA_FETCH_TIMEOUT_MS);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: healthCheckQuery, read_only: true }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[healthCheck] Query failed (${res.status}): ${errText.substring(0, 200)}`);
      // Graceful degradation — don't fail the overall schema execution
      return { success: true, tableCount: 0, tables: [], error: errText };
    }

    const data = await res.json();
    // Supabase API returns array of row objects: [{"table_name": "posts"}, ...]
    const tables: string[] = Array.isArray(data)
      ? data.map((row: { table_name: string }) => row.table_name).filter(Boolean)
      : [];

    const tableCount = tables.length;
    console.log(`[healthCheck] Found ${tableCount} public tables: ${tables.join(", ")}`);

    // Update session with verified table count
    await ctx.runMutation(internal.sessions.updateInternal, {
      id: sessionId,
      schemaTablesCreated: tableCount,
    });

    if (tableCount === 0) {
      // Schema executed but no tables found — likely a problem
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        schemaStatus: "error" as const,
        schemaError: "Schema executed but no tables were created. The SQL may have errors — try regenerating.",
      });
      return {
        success: false,
        tableCount: 0,
        tables: [],
        error: "Schema executed but no tables were created. The SQL may have errors — try regenerating.",
      };
    }

    return { success: true, tableCount, tables };
  } catch (e) {
    // Network/timeout error on health check — graceful degradation
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[healthCheck] Health check failed (non-fatal): ${message}`);
    return { success: true, tableCount: 0, tables: [], error: message };
  }
}

// TEMPLATE, PROJECT_DIR, SANDBOX_CONFIG imported from ./constants

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
 * Replace default template files with minimal stubs instead of deleting them.
 * Deleting app/layout.tsx crashes the Next.js dev server (it's required by App Router).
 * Stubs keep the dev server alive while the Coder Agent writes proper files.
 */
async function cleanupTemplateFiles(sandbox: Sandbox): Promise<void> {
  // Minimal stubs that keep Next.js dev server happy
  const STUB_LAYOUT = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}`;
  const STUB_PAGE = `export default function Page() { return null; }`;
  const STUB_CSS = `@import "tailwindcss";`;

  await sandbox.files.write(`${PROJECT_DIR}/app/layout.tsx`, STUB_LAYOUT);
  await sandbox.files.write(`${PROJECT_DIR}/app/page.tsx`, STUB_PAGE);
  await sandbox.files.write(`${PROJECT_DIR}/app/globals.css`, STUB_CSS);
  // resizable.tsx can be safely deleted — not required by Next.js
  await sandbox.commands.run(`rm -f ${PROJECT_DIR}/components/ui/resizable.tsx`);
}

/**
 * Check if the Next.js dev server is responding to HTTP on port 3000.
 * Uses curl which is more reliable than ss port check — catches servers that
 * bind the port then immediately crash from compilation errors.
 * Returns true if the server responds with any HTTP status code.
 */
async function isDevServerResponding(sandbox: Sandbox): Promise<boolean> {
  try {
    const result = await sandbox.commands.run(
      `curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000`,
      { timeoutMs: 10000 }
    );
    // curl exit code 0 = got HTTP response (any status: 200, 404, 500 all mean server is alive)
    // curl exit code 7 = connection refused, 28 = timeout
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Ensure the Next.js dev server is running on port 3000 in the sandbox.
 * Uses HTTP-level check (curl) instead of port check (ss) to catch servers
 * that bind the port then crash. Adds a 2s stability delay after restart.
 */
async function ensureDevServerRunning(
  sandbox: Sandbox,
  logPrefix: string
): Promise<void> {
  if (await isDevServerResponding(sandbox)) {
    return; // Dev server is running and responding to HTTP
  }

  console.warn(`[${logPrefix}] Dev server not responding — restarting...`);

  // Phase 1: Quick restart (handles transient crashes, ~7s)
  try { await sandbox.commands.run(`pkill -f "next" || true`); } catch { /* safe to ignore */ }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  try {
    await sandbox.commands.run(
      `cd ${PROJECT_DIR} && npm run dev > /tmp/next-dev.log 2>&1 &`,
      { timeoutMs: 5000 }
    );
  } catch { /* Background process launch may throw */ }

  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isDevServerResponding(sandbox)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`[${logPrefix}] Dev server restarted (quick: ${i + 3}s)`);
      return;
    }
  }

  // Phase 2: npm install + clean cache + restart (handles missing packages, ~25s)
  console.warn(`[${logPrefix}] Quick restart failed — running npm install...`);
  try { await sandbox.commands.run(`pkill -f "next" || true`); } catch { /* safe to ignore */ }
  try {
    const installResult = await sandbox.commands.run(`npm install`, { cwd: PROJECT_DIR, timeoutMs: 30000 });
    if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
      await sandbox.commands.run(`npm install --legacy-peer-deps`, { cwd: PROJECT_DIR, timeoutMs: 30000 });
    }
  } catch (e) { console.warn(`[${logPrefix}] npm install error: ${e}`); }
  try { await sandbox.commands.run(`rm -rf ${PROJECT_DIR}/.next`); } catch { /* safe to ignore */ }
  try {
    await sandbox.commands.run(
      `cd ${PROJECT_DIR} && npm run dev > /tmp/next-dev.log 2>&1 &`,
      { timeoutMs: 5000 }
    );
  } catch { /* Background process launch may throw */ }

  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isDevServerResponding(sandbox)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`[${logPrefix}] Dev server restarted (full recovery: ${i + 3}s)`);
      return;
    }
  }

  // Log failure with dev server output for diagnosis
  try {
    const log = await sandbox.commands.run(`tail -20 /tmp/next-dev.log`);
    console.error(`[${logPrefix}] Dev server log:\n${log.stdout}`);
  } catch { /* safe to ignore */ }
  console.error(`[${logPrefix}] Dev server failed to start after full recovery`);
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

  // Clean up default template files — write minimal stubs instead of deleting
  // (deleting layout.tsx crashes the Next.js dev server)
  await cleanupTemplateFiles(sandbox);
  // NOTE: components/ui/*.tsx (other than resizable) are pre-installed by shadcn and intentionally preserved

  // Ensure the dev server survived the stub writes before returning the preview URL
  await ensureDevServerRunning(sandbox, "connectOrRecreateSandbox");

  const sandboxId = sandbox.sandboxId;
  const previewUrl = `https://${sandbox.getHost(3000)}`;

  console.log(`[connectOrRecreateSandbox] New sandbox created: ${sandboxId} (shadcn components pre-installed)`);

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
 * Run the Coder Agent with self-healing validation loop.
 * Retries up to MAX_CODER_ATTEMPTS times, validating output after each attempt.
 */
async function runCoderWithValidation(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  architecture: string,
  previewUrl: string,
  toolContext: ToolContext,
  sandboxActions: SandboxActions,
  sandbox: Sandbox,
  options: {
    designTokensBlock?: string;
    schemaGenerated?: boolean;
    coderLimits: { initial: number; fix: number };
    complexity: ArchitectureComplexity;
  },
  logPrefix: string
): Promise<{
  coderResult: Awaited<ReturnType<typeof runCoderAgent>> | null;
  cumulativeFiles: Set<string>;
  lastError?: string;
}> {
  const MAX_CODER_ATTEMPTS = 3;
  let lastCoderError: string | undefined;
  let coderResult: Awaited<ReturnType<typeof runCoderAgent>> | null = null;
  const cumulativeFiles = new Set<string>();

  for (let coderAttempt = 1; coderAttempt <= MAX_CODER_ATTEMPTS; coderAttempt++) {
    if (coderAttempt === 1) {
      console.log(`[${logPrefix}] Running Coder Agent...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        coderStatus: "generating",
        coderRetryCount: 0,
      });
    } else {
      console.log(`[${logPrefix}] Coder fix attempt ${coderAttempt}/${MAX_CODER_ATTEMPTS}...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        coderStatus: "fixing",
        coderRetryCount: coderAttempt - 1,
      });

      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: `Code validation found issues (attempt ${coderAttempt - 1}/${MAX_CODER_ATTEMPTS}). Auto-fixing...`,
      });
    }

    const errorFeedback = lastCoderError && coderResult
      ? formatCoderRetryPrompt(
          architecture,
          lastCoderError,
          coderAttempt,
          [...cumulativeFiles]
        )
      : undefined;

    coderResult = await runCoderAgent(
      architecture,
      previewUrl,
      toolContext,
      sandboxActions,
      options.designTokensBlock,
      options.schemaGenerated,
      errorFeedback,
      { recursionLimit: options.coderLimits.initial, fixRecursionLimit: options.coderLimits.fix }
    );

    if (coderResult.error) {
      const isExhaustion = coderResult.error.startsWith("recursion_exhaustion:");

      if (isExhaustion && coderResult.filesChanged.length > 0) {
        console.warn(`[${logPrefix}] Coder recursion exhausted after ${coderResult.filesChanged.length} files (complexity: ${options.complexity}, limit: ${options.coderLimits.initial})`);

        await ctx.runMutation(internal.sessions.updateInternal, {
          id: sessionId,
          coderStatus: "error",
          coderError: `Generation incomplete: ${coderResult.filesChanged.length} files created before reaching iteration limit`,
          coderRetryCount: coderAttempt - 1,
        });

        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: `App generation completed partially (${coderResult.filesChanged.length} files created). This app is complex and reached the generation limit. The preview should work — use the chat to add any missing components or fix issues.`,
        });

        break;
      }

      console.error(`[${logPrefix}] Coder failed: ${coderResult.error}`);
      break;
    }

    console.log(`[${logPrefix}] Created/modified ${coderResult.filesChanged.length} files`);

    for (const f of coderResult.filesChanged) {
      cumulativeFiles.add(f);
    }

    // Run npm install before validation
    console.log(`[${logPrefix}] Running npm install...`);
    try {
      let postInstallResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
      if (postInstallResult.exitCode !== 0 && postInstallResult.stderr.includes("ERESOLVE")) {
        postInstallResult = await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
      }
    } catch (error) {
      console.warn(`[${logPrefix}] Post-install error (non-fatal): ${error}`);
    }

    // Validate coder output
    console.log(`[${logPrefix}] Validating coder output...`);
    await ctx.runMutation(internal.sessions.updateInternal, {
      id: sessionId,
      coderStatus: "validating",
    });

    const validation = await validateCoderOutput(
      sandboxActions,
      [...cumulativeFiles]
    );

    if (validation.success) {
      console.log(`[${logPrefix}] Coder validation passed`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        coderStatus: "success",
        coderRetryCount: coderAttempt - 1,
      });

      if (coderAttempt > 1) {
        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: `Code validated successfully after ${coderAttempt - 1} fix${coderAttempt - 1 === 1 ? "" : "es"}.`,
        });
      }
      break;
    }

    lastCoderError = validation.formattedErrors;
    console.warn(
      `[${logPrefix}] Coder validation failed (attempt ${coderAttempt}/${MAX_CODER_ATTEMPTS}): ${validation.errors.length} errors`
    );

    if (validation.warnings.length > 0) {
      console.warn(`[${logPrefix}] Coder validation warnings:`, validation.warnings);
    }

    if (coderAttempt === MAX_CODER_ATTEMPTS) {
      console.error(`[${logPrefix}] Coder self-healing failed after ${MAX_CODER_ATTEMPTS} attempts`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        coderStatus: "error",
        coderError: `${validation.errors.length} validation errors after ${MAX_CODER_ATTEMPTS} attempts`,
        coderRetryCount: MAX_CODER_ATTEMPTS,
      });

      const errorSummary = validation.errors
        .slice(0, 5)
        .map(e => `- ${e.file}: ${e.message}`)
        .join('\n');
      const moreCount = validation.errors.length > 5
        ? `\n- ... and ${validation.errors.length - 5} more`
        : '';

      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: `Code generation completed with ${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"} that couldn't be auto-fixed:\n${errorSummary}${moreCount}\n\nThe app may still work — try the preview and use the chat to fix remaining issues.`,
      });
    }
  }

  return { coderResult, cumulativeFiles, lastError: lastCoderError };
}

/**
 * Run QA Agent with retry loop: QA → Coder fix → QA → Coder fix → deliver.
 * Max 2 QA cycles. If QA passes or retries exhausted, returns.
 */
async function runQAWithRetry(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  architecture: string,
  previewUrl: string,
  toolContext: ToolContext,
  sandboxActions: SandboxActions,
  sandbox: Sandbox,
  options: {
    coderLimits: { initial: number; fix: number };
    designTokensBlock?: string;
    schemaGenerated?: boolean;
  },
  cumulativeFiles: Set<string>,
  logPrefix: string,
  generateStartTime: number
): Promise<{
  qaPassed: boolean;
  qaResult: QAResult | null;
}> {
  const MAX_QA_CYCLES = 2;
  let qaResult: QAResult | null = null;

  for (let qaCycle = 1; qaCycle <= MAX_QA_CYCLES; qaCycle++) {
    // 1. Check remaining sandbox time budget (leave 60s buffer)
    const elapsedMs = Date.now() - generateStartTime;
    const remainingMs = (SANDBOX_CONFIG.TIMEOUT_SECONDS * 1000) - elapsedMs;
    if (remainingMs < 60_000) {
      console.warn(`[${logPrefix}] Skipping QA — insufficient time remaining (${Math.round(remainingMs / 1000)}s)`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "skipped",
        qaError: "Insufficient time remaining",
      });
      return { qaPassed: true, qaResult: null };
    }

    // 2. Update status
    if (qaCycle === 1) {
      console.log(`[${logPrefix}] Running QA Agent...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "validating",
        qaRetryCount: 0,
      });
      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: "Validating your website for visual quality, accessibility, and responsive behavior...",
      });
    } else {
      console.log(`[${logPrefix}] QA re-validation (cycle ${qaCycle}/${MAX_QA_CYCLES})...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "validating",
        qaRetryCount: qaCycle - 1,
      });
    }

    // 3. Run QA Agent
    const qaAgentResult = await runQAAgent(
      previewUrl,
      architecture,
      toolContext,
      sandboxActions
    );

    // 4. Parse findings
    qaResult = parseQAFindings(qaAgentResult.response);
    console.log(`[${logPrefix}] QA result: ${qaResult.issuesFound} issues found across ${qaResult.routesChecked} routes`);

    // 5. Check if passed
    if (qaResult.passed || qaResult.issuesFound === 0) {
      console.log(`[${logPrefix}] QA validation passed`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "success",
        qaRetryCount: qaCycle - 1,
      });

      if (qaCycle > 1) {
        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: `Website validated successfully after ${qaCycle - 1} fix${qaCycle - 1 === 1 ? "" : "es"}.`,
        });
      } else {
        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: "Website validated — no visual or accessibility issues found.",
        });
      }
      return { qaPassed: true, qaResult };
    }

    // 6. QA found issues — if retries remain, fix and re-validate
    if (qaCycle < MAX_QA_CYCLES) {
      console.log(`[${logPrefix}] QA found ${qaResult.issuesFound} issues, routing to Coder for fixes...`);

      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "fixing",
        qaRetryCount: qaCycle,
      });

      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: `Website validation found ${qaResult.issuesFound} issue${qaResult.issuesFound === 1 ? "" : "s"}. Auto-fixing...`,
      });

      // Format QA findings as Coder fix instructions
      const qaErrorFeedback = formatQARetryPrompt(
        qaResult.allFindings,
        architecture,
        [...cumulativeFiles]
      );

      // Run Coder Agent in fix mode
      const fixResult = await runCoderAgent(
        architecture,
        previewUrl,
        toolContext,
        sandboxActions,
        options.designTokensBlock,
        options.schemaGenerated,
        qaErrorFeedback,
        { recursionLimit: options.coderLimits.fix, fixRecursionLimit: options.coderLimits.fix }
      );

      // Track fixed files
      if (fixResult.filesChanged) {
        for (const f of fixResult.filesChanged) {
          cumulativeFiles.add(f);
        }
      }

      // Run npm install after fixes
      try {
        const installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
        if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
          await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
        }
      } catch (error) {
        console.warn(`[${logPrefix}] Post-QA-fix install error (non-fatal): ${error}`);
      }

      // Restart dev server for clean state before next QA cycle
      await ensureDevServerRunning(sandbox, logPrefix);

      continue;
    }

    // 7. Max QA retries exhausted — deliver with best effort
    console.warn(`[${logPrefix}] QA validation incomplete after ${MAX_QA_CYCLES} cycles — ${qaResult.issuesFound} remaining issues`);

    await ctx.runMutation(internal.sessions.updateInternal, {
      id: sessionId,
      qaStatus: "error",
      qaError: `${qaResult.issuesFound} issues after ${MAX_QA_CYCLES} QA cycles`,
      qaRetryCount: MAX_QA_CYCLES,
    });

    const issueSummary = qaResult.allFindings
      .filter((f) => f.severity !== "minor")
      .slice(0, 3)
      .map((f) => `- ${f.category}: ${f.description}`)
      .join("\n");

    await ctx.runMutation(api.messages.create, {
      sessionId,
      role: "assistant",
      content: `Website validation completed with ${qaResult.issuesFound} remaining issue${qaResult.issuesFound === 1 ? "" : "s"}:\n${issueSummary}\n\nThe app should still work — use the chat to address remaining issues.`,
    });

    return { qaPassed: false, qaResult };
  }

  return { qaPassed: false, qaResult };
}

/**
 * Run QA Agent with retry loop for the modify flow.
 * Same as runQAWithRetry() but routes fixes to Chat Agent instead of Coder Agent.
 * Max 2 QA cycles: QA → Chat fix → QA → Chat fix → deliver.
 */
async function runQAForModify(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  architecture: string,
  previewUrl: string,
  toolContext: ToolContext,
  sandboxActions: SandboxActions,
  sandbox: Sandbox,
  allFilesChanged: string[],
  logPrefix: string,
  modifyStartTime: number
): Promise<{
  qaPassed: boolean;
  qaResult: QAResult | null;
  additionalFilesChanged: string[];
}> {
  const MAX_QA_CYCLES = 2;
  let qaResult: QAResult | null = null;
  const additionalFilesChanged: string[] = [];

  for (let qaCycle = 1; qaCycle <= MAX_QA_CYCLES; qaCycle++) {
    // 1. Check remaining time budget (use SHORT_TIMEOUT for modify, 60s buffer)
    const elapsedMs = Date.now() - modifyStartTime;
    const remainingMs = (SANDBOX_CONFIG.SHORT_TIMEOUT_SECONDS * 1000) - elapsedMs;
    if (remainingMs < 60_000) {
      console.warn(`[${logPrefix}] Skipping QA — insufficient time remaining (${Math.round(remainingMs / 1000)}s)`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "skipped",
        qaError: "Insufficient time remaining",
      });
      return { qaPassed: true, qaResult: null, additionalFilesChanged };
    }

    // 2. Update status
    if (qaCycle === 1) {
      console.log(`[${logPrefix}] Running QA Agent...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "validating",
        qaRetryCount: 0,
      });
      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: "Validating your website for visual quality, accessibility, and responsive behavior...",
      });
    } else {
      console.log(`[${logPrefix}] QA re-validation (cycle ${qaCycle}/${MAX_QA_CYCLES})...`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "validating",
        qaRetryCount: qaCycle - 1,
      });
    }

    // 3. Run QA Agent
    const qaAgentResult = await runQAAgent(
      previewUrl,
      architecture,
      toolContext,
      sandboxActions
    );

    // 4. Parse findings
    qaResult = parseQAFindings(qaAgentResult.response);
    console.log(`[${logPrefix}] QA result: ${qaResult.issuesFound} issues found across ${qaResult.routesChecked} routes`);

    // 5. Check if passed
    if (qaResult.passed || qaResult.issuesFound === 0) {
      console.log(`[${logPrefix}] QA validation passed`);
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "success",
        qaRetryCount: qaCycle - 1,
      });

      if (qaCycle > 1) {
        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: `Website validated successfully after ${qaCycle - 1} fix${qaCycle - 1 === 1 ? "" : "es"}.`,
        });
      } else {
        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: "Website validated — no visual or accessibility issues found.",
        });
      }
      return { qaPassed: true, qaResult, additionalFilesChanged };
    }

    // 6. QA found issues — if retries remain, fix via Chat Agent
    if (qaCycle < MAX_QA_CYCLES) {
      console.log(`[${logPrefix}] QA found ${qaResult.issuesFound} issues, routing to Chat Agent for fixes...`);

      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        qaStatus: "fixing",
        qaRetryCount: qaCycle,
      });

      await ctx.runMutation(api.messages.create, {
        sessionId,
        role: "assistant",
        content: `Website validation found ${qaResult.issuesFound} issue${qaResult.issuesFound === 1 ? "" : "s"}. Auto-fixing...`,
      });

      // Format QA findings as Chat Agent fix instructions
      const qaFixMessage = formatQARetryPrompt(
        qaResult.allFindings,
        architecture,
        [...allFilesChanged, ...additionalFilesChanged]
      );

      // Run Chat Agent in fix mode
      const fixResult = await runChatAgent(
        qaFixMessage,
        toolContext,
        sandboxActions,
        {},
        architecture
      );

      // Track fixed files
      if (fixResult.filesChanged) {
        for (const f of fixResult.filesChanged) {
          if (!additionalFilesChanged.includes(f)) {
            additionalFilesChanged.push(f);
          }
        }
      }

      // Run npm install after fixes
      try {
        const installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
        if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
          await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
        }
      } catch (error) {
        console.warn(`[${logPrefix}] Post-QA-fix install error (non-fatal): ${error}`);
      }

      // Restart dev server for clean state before next QA cycle
      await ensureDevServerRunning(sandbox, logPrefix);

      continue;
    }

    // 7. Max QA retries exhausted — deliver with best effort
    console.warn(`[${logPrefix}] QA validation incomplete after ${MAX_QA_CYCLES} cycles — ${qaResult.issuesFound} remaining issues`);

    await ctx.runMutation(internal.sessions.updateInternal, {
      id: sessionId,
      qaStatus: "error",
      qaError: `${qaResult.issuesFound} issues after ${MAX_QA_CYCLES} QA cycles`,
      qaRetryCount: MAX_QA_CYCLES,
    });

    const issueSummary = qaResult.allFindings
      .filter((f) => f.severity !== "minor")
      .slice(0, 3)
      .map((f) => `- ${f.category}: ${f.description}`)
      .join("\n");

    await ctx.runMutation(api.messages.create, {
      sessionId,
      role: "assistant",
      content: `Website validation completed with ${qaResult.issuesFound} remaining issue${qaResult.issuesFound === 1 ? "" : "s"}:\n${issueSummary}\n\nThe app should still work — use the chat to address remaining issues.`,
    });

    return { qaPassed: false, qaResult, additionalFilesChanged };
  }

  return { qaPassed: false, qaResult, additionalFilesChanged };
}

/**
 * Run the Schema-First Pipeline: generate schema.sql, execute against Supabase, verify tables.
 * Retries up to MAX_SCHEMA_ATTEMPTS times with the schema agent.
 */
async function runSchemaFirstPipeline(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"]; runQuery: typeof import("./_generated/server").action["prototype"]["runQuery"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  databaseSection: string,
  sandboxActions: SandboxActions,
  toolContext: ToolContext,
  supabaseStatus: {
    supabaseAccessToken: string | null;
    supabaseRefreshToken: string | null;
    supabaseTokenExpiry: number | null;
    supabaseProjectRef: string;
  },
  logPrefix: string
): Promise<{ schemaGenerated: boolean; error?: string }> {
  const MAX_SCHEMA_ATTEMPTS = 3;
  let lastSchemaError: string | undefined;

  for (let schemaAttempt = 1; schemaAttempt <= MAX_SCHEMA_ATTEMPTS; schemaAttempt++) {
    console.log(`[${logPrefix}] Schema attempt ${schemaAttempt}/${MAX_SCHEMA_ATTEMPTS}...`);

    const schemaResult = await runSchemaAgent(
      databaseSection,
      toolContext,
      sandboxActions,
      lastSchemaError
    );

    if (schemaResult.error) {
      lastSchemaError = schemaResult.error;
      console.error(`[${logPrefix}] Schema agent failed (attempt ${schemaAttempt}): ${schemaResult.error}`);
      continue;
    }

    const schemaContent = await sandboxActions.readFile("schema.sql");
    if (!schemaContent?.trim()) {
      lastSchemaError = "Schema agent did not generate schema.sql";
      console.error(`[${logPrefix}] Schema agent did not write schema.sql (attempt ${schemaAttempt})`);
      continue;
    }

    console.log(`[${logPrefix}] Executing schema.sql via Management API...`);
    const token = await refreshTokenIfNeeded(ctx, sessionId, supabaseStatus);

    if (!token) {
      lastSchemaError = "Could not obtain Supabase token";
      break;
    }

    const execResult = await executeSchemaWithRetry(
      ctx, sessionId, schemaContent,
      supabaseStatus.supabaseProjectRef, token,
    );

    if (!execResult.success) {
      lastSchemaError = execResult.error ?? "Schema execution failed";
      console.error(`[${logPrefix}] Schema execution failed (attempt ${schemaAttempt}): ${lastSchemaError}`);
      continue;
    }

    const healthCheck = await verifySchemaHealthCheck(
      ctx, sessionId,
      supabaseStatus.supabaseProjectRef, token,
    );

    if (!healthCheck.success) {
      lastSchemaError = healthCheck.error ?? "Health check failed: no tables created";
      console.error(`[${logPrefix}] Health check failed (attempt ${schemaAttempt}): ${lastSchemaError}`);
      continue;
    }

    // Success
    console.log(`[${logPrefix}] Schema-first pipeline succeeded on attempt ${schemaAttempt}: ${healthCheck.tableCount} tables created`);

    await ctx.runMutation(api.messages.create, {
      sessionId,
      role: "assistant",
      content: `Database ready: ${healthCheck.tableCount} table${healthCheck.tableCount === 1 ? "" : "s"} created successfully.`,
    });

    return { schemaGenerated: true };
  }

  console.warn(`[${logPrefix}] Schema-first pipeline failed after ${MAX_SCHEMA_ATTEMPTS} attempts. Falling back to coder-generated schema.`);
  return { schemaGenerated: false, error: lastSchemaError };
}

/**
 * Sync key files from sandbox to Convex storage.
 * Always re-reads from sandbox to catch npm-modified files (e.g. package.json).
 */
async function syncFilesToConvex(
  ctx: { runMutation: typeof import("./_generated/server").action["prototype"]["runMutation"] },
  sessionId: import("./_generated/dataModel").Id<"sessions">,
  sandbox: Sandbox,
  logPrefix: string
): Promise<void> {
  console.log(`[${logPrefix}] Syncing all key files to Convex...`);
  for (const filePath of KEY_FILES) {
    try {
      const fullPath = `${PROJECT_DIR}/${filePath}`;
      const content = await sandbox.files.read(fullPath);
      if (content) {
        await ctx.runMutation(api.files.upsert, {
          sessionId,
          path: filePath,
          content,
        });
        console.log(`[${logPrefix}] Synced file: ${filePath}`);
      }
    } catch {
      // File doesn't exist, skip
    }
  }
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
    const generateStartTime = Date.now();

    try {
      // 1. Create sandbox
      console.log("[generate] Creating E2B sandbox...");
      const sandbox = await Sandbox.create(TEMPLATE, {
        timeoutMs: SANDBOX_CONFIG.TIMEOUT_SECONDS * 1000,
      });

      // Clean up default template files — write minimal stubs instead of deleting
      // (deleting layout.tsx crashes the Next.js dev server)
      await cleanupTemplateFiles(sandbox);
      // NOTE: components/ui/*.tsx (other than resizable) are pre-installed by shadcn and intentionally preserved

      // Ensure the dev server survived the stub writes before returning the preview URL
      await ensureDevServerRunning(sandbox, "generate");

      const sandboxId = sandbox.sandboxId;
      const previewUrl = `https://${sandbox.getHost(3000)}`;

      console.log(`[generate] Sandbox ready: ${sandboxId} (shadcn components pre-installed)`);
      console.log(`[generate] Preview: ${previewUrl}`);

      // Update session with sandbox info
      await ctx.runMutation(internal.sessions.updateInternal, {
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

      // 4. Check Supabase status and build augmented prompt
      const supabaseStatus = await ctx.runQuery(internal.sessions.getSupabaseStatusInternal, { id: sessionId });
      const hasSupabase = supabaseStatus?.supabaseConnected ?? false;
      const needsDb = needsDatabaseIntegration(prompt);

      let architecturePrompt = prompt;
      if (needsDb && hasSupabase) {
        architecturePrompt += `\n\n[SYSTEM: User has Supabase connected (${supabaseStatus?.supabaseUrl}). This app needs data persistence. Include a DATABASE section in the architecture with table definitions. Add @supabase/supabase-js and @supabase/ssr to PACKAGES.]`;
      } else if (needsDb && !hasSupabase) {
        architecturePrompt += `\n\n[SYSTEM: This app may benefit from data persistence, but user has not connected Supabase yet. Generate frontend-only architecture using useState for now.]`;
      }

      // 5. Run Architecture Agent
      console.log("[generate] Running Architecture Agent...");
      const archResult = await runArchitectureAgent(architecturePrompt, toolContext, sandboxActions);

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

      // Estimate architecture complexity for dynamic coder limits
      const complexity = estimateArchitectureComplexity(architecture);
      const coderLimits = CODER_RECURSION_LIMITS[complexity];
      console.log(`[generate] Architecture complexity: ${complexity} (recursion: ${coderLimits.initial}/${coderLimits.fix})`);

      // Extract app name from architecture
      let appName = extractAppNameFromArchitecture(architecture);
      if (!appName) {
        appName = deriveAppName(prompt);
      }

      // Update session with architecture and app name
      await ctx.runMutation(internal.sessions.updateInternal, {
        id: sessionId,
        architecture,
        appName,
      });

      // 5. Extract design tokens for coder
      const designTokens = extractDesignTokens(architecture);
      let designTokensBlock = "";
      if (designTokens) {
        designTokensBlock = formatDesignTokensForCoder(designTokens);
        console.log(`[generate] Extracted design tokens: ${designTokens.aesthetic}, ${designTokens.typography.pairing}`);
      } else {
        console.log("[generate] Could not extract design tokens from architecture");
      }

      // 5b. Write .env.local with Supabase credentials if connected
      if (hasSupabase && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
        const envContent = `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`;
        await sandbox.files.write(`${PROJECT_DIR}/.env.local`, envContent);
        console.log('[generate] Wrote .env.local with Supabase credentials');
      }

      // 5c. Pre-install architecture packages before coder starts
      try {
        const packagesToInstall = extractPackagesFromArchitecture(architecture);
        if (packagesToInstall.length > 0) {
          console.log(`[generate] Pre-installing packages: ${packagesToInstall.join(", ")}`);
          let installResult = await sandbox.commands.run(
            `npm install ${packagesToInstall.join(" ")}`, { cwd: PROJECT_DIR }
          );
          if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
            installResult = await sandbox.commands.run(
              `npm install --legacy-peer-deps ${packagesToInstall.join(" ")}`, { cwd: PROJECT_DIR }
            );
          }
        }
      } catch (error) {
        console.warn(`[generate] Pre-install error (non-fatal): ${error}`);
      }

      // 5d. Schema-First Pipeline: Generate & validate schema BEFORE coder
      let schemaGenerated = false;
      if (hasSupabase && supabaseStatus?.supabaseAccessToken && supabaseStatus?.supabaseProjectRef) {
        const databaseSection = extractDatabaseSection(architecture);

        if (databaseSection) {
          console.log("[generate] DATABASE section found — running Schema-First Pipeline...");
          const schemaPipelineResult = await runSchemaFirstPipeline(
            ctx, sessionId, databaseSection, sandboxActions, toolContext,
            supabaseStatus as { supabaseAccessToken: string; supabaseRefreshToken: string | null; supabaseTokenExpiry: number | null; supabaseProjectRef: string },
            "generate"
          );
          schemaGenerated = schemaPipelineResult.schemaGenerated;
        }
      } else if (hasSupabase) {
        console.warn(`[generate] Supabase connected but Management API unavailable — ` +
          `accessToken=${!!supabaseStatus?.supabaseAccessToken}, projectRef=${!!supabaseStatus?.supabaseProjectRef}. ` +
          `Schema-first pipeline skipped.`);
      }

      // 6. Run Coder Agent with self-healing validation loop
      const { coderResult, cumulativeFiles } = await runCoderWithValidation(
        ctx, sessionId, architecture, previewUrl, toolContext, sandboxActions, sandbox,
        {
          designTokensBlock,
          schemaGenerated,
          coderLimits,
          complexity,
        },
        "generate"
      );

      // Handle case where coder agent itself failed (not validation)
      if (!coderResult || (coderResult.error && coderResult.filesChanged.length === 0)) {
        // Distinguish error types for user messaging
        const isExhaustion = coderResult?.error?.startsWith("recursion_exhaustion:");
        const errorMsg = isExhaustion
          ? "App generation couldn't start — the architecture may be too complex. Try simplifying your prompt or breaking it into phases."
          : `Code generation failed: ${coderResult?.error ?? "Unknown error"}`;

        return {
          success: false,
          error: errorMsg,
        };
      }

      // Partial success if agent error but some files were created
      if (coderResult.error && coderResult.filesChanged.length > 0) {
        return {
          success: true,
          appName,
          previewUrl,
          filesCreated: coderResult.filesChanged.length,
          error: coderResult.error,
        };
      }

      console.log(`[generate] Final file count: ${coderResult.filesChanged.length} files`);

      // 6b. Run QA Agent with retry loop (after coder validation passes)
      console.log("[generate] Running QA validation...");
      const { qaPassed, qaResult: qaValidationResult } = await runQAWithRetry(
        ctx, sessionId, architecture, previewUrl, toolContext, sandboxActions, sandbox,
        {
          coderLimits,
          designTokensBlock,
          schemaGenerated,
        },
        cumulativeFiles,
        "generate",
        generateStartTime
      );

      if (!qaPassed && qaValidationResult) {
        console.warn(`[generate] QA completed with ${qaValidationResult.issuesFound} remaining issues`);
      }

      // 7a. Auto-execute schema.sql if Supabase Management API is available
      // SKIP if schema was already executed in the schema-first pipeline
      let schemaResult: { success: boolean; error?: string; tableCount?: number } | null = null;
      if (!schemaGenerated) {
        if (hasSupabase && supabaseStatus?.supabaseAccessToken && supabaseStatus?.supabaseProjectRef) {
          const schemaContent = await sandboxActions.readFile("schema.sql");
          if (schemaContent?.trim()) {
            console.log("[generate] Executing schema.sql via Management API...");
            const token = await refreshTokenIfNeeded(ctx, sessionId, supabaseStatus);
            if (token) {
              schemaResult = await executeSchemaWithRetry(
                ctx,
                sessionId,
                schemaContent,
                supabaseStatus.supabaseProjectRef,
                token,
              );

              // Health check: verify tables actually exist
              if (schemaResult.success) {
                const healthCheck = await verifySchemaHealthCheck(ctx, sessionId, supabaseStatus.supabaseProjectRef, token);
                if (!healthCheck.success) {
                  schemaResult = { success: false, error: healthCheck.error };
                } else {
                  schemaResult.tableCount = healthCheck.tableCount;
                }
              }
            }
          }
        } else if (hasSupabase) {
          console.warn(`[generate] schema.sql exists but Management API unavailable — schema execution skipped`);
          const schemaContent = await sandboxActions.readFile("schema.sql");
          if (schemaContent?.trim()) {
            await ctx.runMutation(api.messages.create, {
              sessionId,
              role: "assistant",
              content: `⚠️ Schema generated but could not be auto-executed — Supabase Management API access is not available. ` +
                `Please copy the contents of \`schema.sql\` and run it manually in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).`,
            });
          }
        }
      }

      // 7b. Post-generation design validation
      console.log("[generate] Validating design tokens...");
      const validationResult = await validateAndFixDesign(
        designTokens,
        appName,
        sandboxActions.readFile,
        sandboxActions.writeFile
      );
      if (validationResult.filesFixed.length > 0) {
        console.log(`[generate] Fixed design files: ${validationResult.filesFixed.join(", ")}`);
      } else {
        console.log("[generate] Design validation passed");
      }

      // 7b2. Post-generation code validation
      const codeValidation = await validateGeneratedCode(
        sandboxActions.readFile,
        coderResult.filesChanged
      );
      if (codeValidation.errors.length > 0) {
        console.error("[generate] Code validation errors:", codeValidation.errors);
      }
      if (codeValidation.warnings.length > 0) {
        console.warn("[generate] Code validation warnings:", codeValidation.warnings);
      }

      // 7c. Send schema execution result as chat message
      if (schemaResult) {
        const schemaMessage = schemaResult.success
          ? `✅ Database ready: ${schemaResult.tableCount ?? 0} table${(schemaResult.tableCount ?? 0) === 1 ? "" : "s"} created successfully.`
          : `⚠️ Database setup failed: ${schemaResult.error}`;

        await ctx.runMutation(api.messages.create, {
          sessionId,
          role: "assistant",
          content: schemaMessage,
        });
      }

      // 8. Ensure dev server is running before delivering preview
      await ensureDevServerRunning(sandbox, "generate");

      // 9. Sync key files to Convex
      await syncFilesToConvex(ctx, sessionId, sandbox, "generate");

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
 * Detect if Chat Agent changes are significant enough to warrant QA validation.
 * Triggers QA for: >=3 files changed OR any Next.js route files (page.tsx/layout.tsx) modified.
 */
function isBigUpdate(filesChanged: string[]): boolean {
  if (filesChanged.length >= 3) return true;

  // Check for route-related file changes (new/modified pages or layouts)
  return filesChanged.some(
    (f) => /^app\/.*page\.tsx$/.test(f) || /^app\/.*layout\.tsx$/.test(f)
  );
}

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
    const modifyStartTime = Date.now();

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

          // Reinstall packages from restored package.json
          console.log("[modify] Running npm install to restore packages...");
          let installResult = await sandbox.commands.run("npm install", { cwd: PROJECT_DIR });
          if (installResult.exitCode !== 0 && installResult.stderr.includes("ERESOLVE")) {
            installResult = await sandbox.commands.run("npm install --legacy-peer-deps", { cwd: PROJECT_DIR });
          }
          if (installResult.exitCode === 0) {
            console.log("[modify] Packages reinstalled successfully");
          } else {
            console.error(`[modify] Package install failed: ${installResult.stderr.slice(0, 300)}`);
          }

          // Restart Next.js dev server for clean compilation with restored files
          console.log("[modify] Restarting dev server for clean compilation...");
          await ensureDevServerRunning(sandbox, "modify");

          // Update session with new sandbox info
          await ctx.runMutation(internal.sessions.updateInternal, {
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

      // 6b. Ensure .env.local has Supabase credentials
      const supabaseStatus = await ctx.runQuery(internal.sessions.getSupabaseStatusInternal, { id: sessionId });
      if (supabaseStatus?.supabaseConnected && supabaseStatus?.supabaseUrl && supabaseStatus?.supabaseAnonKey) {
        await sandbox.files.write(
          `${PROJECT_DIR}/.env.local`,
          `NEXT_PUBLIC_SUPABASE_URL=${supabaseStatus.supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseStatus.supabaseAnonKey}\n`
        );
        console.log('[modify] Wrote .env.local with Supabase credentials');
      }

      // 6. Route based on request type (from reference code)

      // If it's a new project request and no files exist, tell user to use generate
      if (isNewProjectRequest(message) && files.size === 0) {
        return {
          success: false,
          error: "This looks like a new project request. Please use the generate workflow instead of modify.",
        };
      }


      // 7. Run Chat Agent
      console.log("[modify] Running Chat Agent...");
      const chatResult = await runChatAgent(
        message,
        toolContext,
        sandboxActions,
        {},
        session.architecture ?? undefined
      );

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

      // 7a. QA validation for big updates
      if (isBigUpdate(chatResult.filesChanged)) {
        console.log(`[modify] Big update detected (${chatResult.filesChanged.length} files changed) — running QA validation...`);

        const architecture = session.architecture ?? "";
        const { qaPassed, qaResult: modifyQAResult, additionalFilesChanged } = await runQAForModify(
          ctx, sessionId, architecture, previewUrl!, toolContext, sandboxActions, sandbox,
          chatResult.filesChanged,
          "modify",
          modifyStartTime
        );

        if (!qaPassed && modifyQAResult) {
          console.warn(`[modify] QA completed with ${modifyQAResult.issuesFound} remaining issues`);
        }

        // Include QA-fix files in the result
        if (additionalFilesChanged.length > 0) {
          for (const f of additionalFilesChanged) {
            if (!chatResult.filesChanged.includes(f)) {
              chatResult.filesChanged.push(f);
            }
          }
        }
      } else {
        console.log(`[modify] Small update (${chatResult.filesChanged.length} files) — skipping QA validation`);
      }

      // 7b. Auto-execute schema.sql if it was changed
      if (chatResult.filesChanged.includes("schema.sql")) {
        const hasAccessToken = !!supabaseStatus?.supabaseAccessToken;
        const hasProjectRef = !!supabaseStatus?.supabaseProjectRef;

        if (!hasAccessToken || !hasProjectRef) {
          console.warn(
            `[modify] schema.sql changed but cannot auto-execute: ` +
            `accessToken=${hasAccessToken}, projectRef=${hasProjectRef}`
          );
          await ctx.runMutation(api.messages.create, {
            sessionId,
            role: "assistant",
            content: `⚠️ Schema updated but could not be auto-executed — Supabase Management API access is not available. ` +
              `Please copy the contents of \`schema.sql\` and run it manually in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).`,
          });
        } else {
          const projectRef = supabaseStatus!.supabaseProjectRef!;
          const schemaContent = await sandboxActions.readFile("schema.sql");
          if (schemaContent?.trim()) {
            console.log("[modify] Executing updated schema.sql via Management API...");
            const token = await refreshTokenIfNeeded(ctx, sessionId, supabaseStatus);
            if (token) {
              let schemaResult = await executeSchemaWithRetry(
                ctx,
                sessionId,
                schemaContent,
                projectRef,
                token,
              );

              // Health check: verify tables actually exist
              let tableCount = 0;
              if (schemaResult.success) {
                const healthCheck = await verifySchemaHealthCheck(ctx, sessionId, projectRef, token);
                if (!healthCheck.success) {
                  schemaResult = { success: false, error: healthCheck.error };
                } else {
                  tableCount = healthCheck.tableCount;
                }
              }

              if (schemaResult.success) {
                await ctx.runMutation(api.messages.create, {
                  sessionId,
                  role: "assistant",
                  content: `✅ Database ready: ${tableCount} table${tableCount === 1 ? "" : "s"} updated successfully.`,
                });
              } else {
                await ctx.runMutation(api.messages.create, {
                  sessionId,
                  role: "assistant",
                  content: `⚠️ Database setup failed: ${schemaResult.error}`,
                });
              }
            } else {
              console.warn("[modify] Token refresh returned null — cannot execute schema");
              await ctx.runMutation(api.messages.create, {
                sessionId,
                role: "assistant",
                content: `⚠️ Database token expired and could not be refreshed. Please reconnect Supabase via OAuth or run \`schema.sql\` manually in the SQL Editor.`,
              });
            }
          }
        }
      }

      // 8. Ensure dev server is running before delivering preview
      await ensureDevServerRunning(sandbox, "modify");

      // 9. Sync key files to Convex
      await syncFilesToConvex(ctx, sessionId, sandbox, "modify");

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
