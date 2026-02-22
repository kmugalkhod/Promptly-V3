/**
 * Chat Agent - Simple Code Editing Flow (LangChain)
 *
 * A straightforward code editing agent:
 * 1. Receive user message + file context
 * 2. LLM understands what needs to change
 * 3. LLM uses tools to read/write files
 * 4. Return brief response
 *
 * Uses LangChain agent framework (same as coder agent).
 */

import { createAgent, tool, anthropicPromptCachingMiddleware } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { validatePackageName, type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall } from "./types";
import { extractDesignTokens } from "../utils/design-tokens";
import { validateGlobalsCss } from "../prompts";
import { getSkillsMetadata, formatSkillsForPrompt, loadSkill } from "./skills";

// Use Sonnet for better quality edits (Haiku loses code too often)
const MODEL_NAME = "claude-sonnet-4-6";
const MAX_ITERATIONS = 15;

/**
 * Chat Agent configuration
 */
export interface ChatAgentConfig {
  /** Maximum iterations for agentic loop */
  maxIterations?: number;
}

/**
 * Protected config files that the chat agent must NEVER modify.
 * These are critical build/tooling files — modifying them breaks the sandbox.
 */
const BLOCKED_FILES = new Set([
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "postcss.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "lib/utils.ts",
  ".env.local",
  ".env.local.example",
]);

/**
 * System prompt for the code editing agent
 */
const SYSTEM_PROMPT = `You are a code editing agent for a Next.js website builder. Users describe changes in plain English, you modify their code.

## How To Work

1. **Think first** - Before making any tool calls, use your thinking to:
   - Analyze exactly what the user wants changed
   - Identify which files need modification and why
   - Plan your implementation approach (what to change, in what order)
   - Consider edge cases: state management, event propagation, responsive design
   - If the task is complex (multiple files, new interactions, data flow), plan the full approach before touching any file
1.5. **Read ALL files you plan to modify** — ALWAYS use read_file to get the current version
   of EVERY file before writing changes. Never write from memory alone — files may have
   been modified in previous iterations.
2. **Get additional context** — use read_file for related files (parent components, shared
   types, layout) that might be affected by your changes
3. **Make changes** - use write_file with COMPLETE file content
4. **Respond briefly** - tell user what you changed (1-2 sentences)

## CRITICAL: Code Preservation Rules

When you write a file, you MUST include ALL existing code that wasn't meant to be changed:

1. **Keep ALL imports** - Don't remove imports unless they become unused
2. **Keep ALL functions** - Don't remove functions unless user asked to remove them
3. **Keep ALL styles/CSS** - Don't remove CSS classes or styles
4. **Keep ALL state/hooks** - Don't remove useState, useEffect, etc.
5. **Keep ALL components** - Don't remove child components or JSX

**BEFORE writing a file, mentally verify:**
- [ ] All original imports are still there
- [ ] All original functions/components are still there
- [ ] All original CSS/styles are still there
- [ ] Only the requested change was made

## What NOT To Do

- Do NOT remove existing CSS or styles (even if adding new styles)
- Do NOT remove existing functions or components
- Do NOT simplify or "clean up" code that wasn't asked to change
- Do NOT write partial files with "// ... rest of code"
- Do NOT create extra files user didn't ask for

## Protected Files — NEVER Modify These

The following files are locked and CANNOT be written to. Any attempt will be rejected:
- tailwind.config.ts / .js — Tailwind v4 uses CSS-based config, not JS config
- postcss.config.js / .mjs — build tooling, must not be touched
- next.config.js / .mjs / .ts — Next.js build config
- package.json / package-lock.json — use install_packages tool instead
- tsconfig.json — TypeScript config
- lib/utils.ts — shared utility (cn function)
- .env.local / .env.local.example — auto-provisioned with real credentials

If the user asks to modify these, explain WHY you can't and suggest the correct alternative.

## Pre-installed Components — DO NOT Recreate

ALL shadcn/ui components are pre-installed in the sandbox (components/ui/*.tsx).
NEVER create or overwrite files in components/ui/ — just import them:
- import { Button } from "@/components/ui/button"
- import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
- etc.

Use Tailwind theme classes for colors — NEVER use explicit CSS variable syntax like bg-[var(--varname)]:
- Use bg-primary, NOT explicit --color-primary variable
- Use text-foreground, NOT explicit --color-text variable
- Use bg-card, NOT explicit --color-surface variable
- Use text-muted-foreground, NOT explicit --color-muted variable

## Skills — On-Demand Expertise

When you receive a modification request, load the \`understand-request\` skill FIRST to classify the task and determine which other skills to load. Then load the recommended skills for detailed guidance before making changes.

{ARCHITECTURE_CONTEXT}

## Database Awareness

- **schema.sql is auto-executed** after code generation AND after any chat modification. Changes to schema.sql are automatically applied to the database.
- There are TWO "table not found" errors: 42P01 (PostgreSQL) and "Could not find the table in the schema cache" (PostgREST). BOTH are transient during initial setup.
- **NEVER modify .env.local** — it's auto-provisioned with real Supabase credentials.
- **NEVER join auth.users** via PostgREST — use the profiles table instead.

### Schema Modification Rules

**When the user EXPLICITLY asks to modify the database** (add column, add table, fix RLS, etc.):
1. Load the \`modify-schema\` skill for detailed guidance
2. Read current schema.sql with read_file BEFORE making changes
3. Modify schema.sql following the skill's additive patterns
4. Also update TypeScript interfaces and component queries to match
5. schema.sql will be auto-executed after your changes — no manual step needed

**When you see "table not found" or "schema cache" errors** (transient):
- Do NOT modify schema.sql in response to these errors
- Respond: "The database is still being set up. Tables will be available shortly — please refresh."

**NEVER do these to schema.sql:**
- Do NOT DROP TABLE or DROP COLUMN unless user explicitly asks to remove data
- Do NOT rewrite schema.sql from scratch — always modify the existing file
- Do NOT remove existing CREATE TABLE, RLS, or policy statements

## Project Stack

- Next.js 16+ (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- Load relevant skills for detailed patterns on these technologies.

## Current Project Files
`;

/**
 * Build file context for the system prompt
 */
function buildFileContext(files: Map<string, string>): string {
  const sections: string[] = [];

  // List all files
  const filePaths = Array.from(files.keys());
  sections.push("\n### Available Files:\n");
  for (const path of filePaths) {
    sections.push(`- ${path}`);
  }

  // Include file contents
  sections.push("\n\n### File Contents:\n");
  for (const [path, content] of files.entries()) {
    sections.push(`\n#### ${path}\n\`\`\`\n${content}\n\`\`\`\n`);
  }

  return sections.join("\n");
}

/**
 * Run the Chat Agent
 */
export async function runChatAgent(
  message: string,
  context: ToolContext,
  sandboxActions: SandboxActions,
  config: ChatAgentConfig = {},
  architecture?: string
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = [];

  // Load skills metadata for system prompt
  const skills = await getSkillsMetadata();
  const skillsSection = formatSkillsForPrompt(skills, "chat");

  try {
    // Define tools using the langchain tool() function
    const writeFileTool = tool(
      async ({ path, content }: { path: string; content: string }) => {
        if (!path || typeof path !== "string") {
          return "ERROR: write_file requires a valid path";
        }
        if (content === undefined || typeof content !== "string") {
          return "ERROR: write_file requires content";
        }

        // Block protected config files
        if (BLOCKED_FILES.has(path)) {
          return `ERROR: Cannot modify '${path}' — this is a protected config file. Do NOT attempt to edit build configuration files (tailwind.config, next.config, package.json, etc.).`;
        }

        // Validate globals.css before writing
        if (path === "app/globals.css") {
          const validationError = validateGlobalsCss(content);
          if (validationError) {
            return validationError;
          }
        }

        // Block documentation files
        if (/\.(md|txt)$/i.test(path) || /readme|changelog|guide/i.test(path)) {
          return "ERROR: Cannot create documentation files. Modify actual code files instead.";
        }

        // Check for significant code loss (file shrinking by >40%)
        const existingContent = context.files.get(path);
        if (existingContent) {
          const oldLines = existingContent.split("\n").length;
          const newLines = content.split("\n").length;
          const shrinkPercent = ((oldLines - newLines) / oldLines) * 100;

          if (shrinkPercent > 40 && oldLines > 10) {
            console.warn(`[chat] WARNING: ${path} shrunk by ${shrinkPercent.toFixed(0)}% (${oldLines} → ${newLines} lines)`);
            return `WARNING: Your edit would remove ${shrinkPercent.toFixed(0)}% of the file (${oldLines} → ${newLines} lines). This seems like you're losing existing code. Please rewrite the file including ALL existing code, only changing what was requested. Don't remove imports, functions, styles, or components that weren't asked to be removed.`;
          }
        }

        // Warn on destructive SQL operations in schema.sql
        if (path === "schema.sql" && existingContent) {
          const destructivePatterns = [
            /DROP\s+TABLE/i,
            /DROP\s+COLUMN/i,
            /ALTER\s+TABLE\s+\w+\s+DROP/i,
            /TRUNCATE/i,
          ];
          const hasDestructive = destructivePatterns.some(p => p.test(content));
          if (hasDestructive) {
            console.warn(`[chat] WARNING: schema.sql contains destructive SQL operations`);
            return `WARNING: Your schema.sql modification contains destructive operations (DROP TABLE, DROP COLUMN, or TRUNCATE). These operations will permanently delete data. If the user explicitly requested data removal, rewrite with this exact change. Otherwise, use additive patterns only (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS).`;
          }

          // Ensure schema.sql ends with NOTIFY for PostgREST cache reload
          if (!content.includes("NOTIFY pgrst")) {
            console.warn(`[chat] WARNING: schema.sql missing NOTIFY pgrst statement`);
            return `WARNING: schema.sql must end with "NOTIFY pgrst, 'reload schema';" to ensure PostgREST detects the changes. Add this as the last line.`;
          }
        }

        // Write file
        context.files.set(path, content);
        await sandboxActions.writeFile(path, content);

        toolCalls.push({
          name: "write_file",
          input: { path, content },
          output: `Updated ${path}`,
        });

        if (!filesChanged.includes(path)) {
          filesChanged.push(path);
        }

        return `File updated: ${path}`;
      },
      {
        name: "write_file",
        description:
          "Write or update a file. ALWAYS write the COMPLETE file content, never partial.",
        schema: z.object({
          path: z.string().describe("File path (e.g., 'components/Button.tsx')"),
          content: z.string().describe("Complete file content"),
        }),
      }
    );

    const readFileTool = tool(
      async ({ path }: { path: string }) => {
        if (!path || typeof path !== "string") {
          return "ERROR: read_file requires a valid path";
        }

        // Check cache first
        const cached = context.files.get(path);
        if (cached) {
          return cached;
        }

        // Read from sandbox
        const content = await sandboxActions.readFile(path);
        if (content) {
          context.files.set(path, content);
          toolCalls.push({
            name: "read_file",
            input: { path },
            output: content,
          });
          return content;
        }

        return `File not found: ${path}`;
      },
      {
        name: "read_file",
        description: "Read a file not in the provided context.",
        schema: z.object({
          path: z.string().describe("File path to read"),
        }),
      }
    );

    const deleteFileTool = tool(
      async ({ path }: { path: string }) => {
        if (!path || typeof path !== "string") {
          return "ERROR: delete_file requires a valid path";
        }

        // Block protected config files
        if (BLOCKED_FILES.has(path)) {
          return `ERROR: Cannot delete '${path}' — this is a protected config file.`;
        }

        context.files.delete(path);
        await sandboxActions.deleteFile(path);

        toolCalls.push({
          name: "delete_file",
          input: { path },
          output: `Deleted ${path}`,
        });

        if (!filesChanged.includes(path)) {
          filesChanged.push(path);
        }

        return `File deleted: ${path}`;
      },
      {
        name: "delete_file",
        description: "Delete a file from the project.",
        schema: z.object({
          path: z.string().describe("File path to delete"),
        }),
      }
    );

    const installPackagesTool = tool(
      async ({ packages }: { packages: string }) => {
        if (!packages || typeof packages !== "string") {
          return "ERROR: install_packages requires packages string";
        }

        const packageList = packages.trim().split(/\s+/);
        const invalid = packageList.filter((p) => !validatePackageName(p));

        if (invalid.length > 0) {
          return `ERROR: Package(s) not allowed: ${invalid.join(", ")}`;
        }

        try {
          let result = await sandboxActions.runCommand(`npm install ${packageList.join(" ")}`);

          if (result.exitCode !== 0 && result.stderr.includes("ERESOLVE")) {
            result = await sandboxActions.runCommand(
              `npm install --legacy-peer-deps ${packageList.join(" ")}`
            );
          }

          if (result.exitCode !== 0) {
            return `Failed to install: ${result.stderr.slice(0, 300)}`;
          }

          toolCalls.push({
            name: "install_packages",
            input: { packages },
            output: `Installed: ${packageList.join(", ")}`,
          });

          // After successful install, sync updated package.json back to Convex
          try {
            const pkgContent = await sandboxActions.readFile("package.json");
            if (pkgContent) {
              context.files.set("package.json", pkgContent);
              await sandboxActions.writeFile("package.json", pkgContent);
            }
          } catch {
            // Non-fatal: package.json sync failed, will be caught by keyFiles sync later
          }

          return `Installed: ${packageList.join(", ")}`;
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return `Failed to install packages: ${msg}`;
        }
      },
      {
        name: "install_packages",
        description: "Install npm packages.",
        schema: z.object({
          packages: z.string().describe("Space-separated package names"),
        }),
      }
    );

    const loadSkillTool = tool(
      async ({ skill_name }: { skill_name: string }) => {
        const result = await loadSkill(skill_name);
        toolCalls.push({
          name: "load_skill",
          input: { skill_name },
          output: result.content,
        });
        return result.content;
      },
      {
        name: "load_skill",
        description:
          "Load specialized instructions for a skill. Use this when you need detailed guidance for a specific task type. Check <available_skills> in your system prompt to see what's available.",
        schema: z.object({
          skill_name: z
            .string()
            .describe("Name of the skill to load (e.g., 'react-component', 'rls-policies')"),
        }),
      }
    );

    const tools = [writeFileTool, readFileTool, deleteFileTool, installPackagesTool, loadSkillTool];

    // Build system prompt with file context
    const fileContext = buildFileContext(context.files);

    // Build architecture context section
    let architectureContext = "";
    if (architecture) {
      const tokens = extractDesignTokens(architecture);
      if (tokens) {
        // Map architecture color keys to shadcn variable names
        const shadcnNameMap: Record<string, string> = {
          primary: "primary",
          accent: "accent",
          background: "background",
          surface: "card",
          text: "foreground",
          muted: "muted-foreground",
        };
        const colorEntries = Object.entries(tokens.colors.light)
          .map(([key, val]) => `  --${shadcnNameMap[key] || key}: ${val}`)
          .join("\n");
        const darkColorEntries = Object.entries(tokens.colors.dark)
          .map(([key, val]) => `  --${shadcnNameMap[key] || key}: ${val}`)
          .join("\n");
        architectureContext = `
## Current App Design Tokens (from architecture)

**Aesthetic**: ${tokens.aesthetic}
**Display font**: ${tokens.typography.displayFont}
**Body font**: ${tokens.typography.bodyFont}

**Light mode colors**:
${colorEntries}

**Dark mode colors**:
${darkColorEntries}

Use Tailwind theme classes for these colors (e.g., \`text-foreground\`, \`bg-primary\`, \`bg-card\`, \`text-muted-foreground\`). Do NOT use explicit CSS variable syntax like bg-[var(--varname)].`;
      }
    }

    // Append skills section to system prompt if available
    const systemPromptWithSkills = skillsSection
      ? `${SYSTEM_PROMPT}\n\n${skillsSection}`
      : SYSTEM_PROMPT;

    const fullSystemPrompt = systemPromptWithSkills.replace("{ARCHITECTURE_CONTEXT}", architectureContext) + fileContext;

    // Create the model instance
    const model = new ChatAnthropic({
      model: MODEL_NAME,
      maxTokens: 25000,
      streaming: true,
      thinking: {
        type: "enabled",
        budget_tokens: 10000,
      },
    });

    // Create the agent using the LangChain API
    const agent = createAgent({
      model,
      tools,
      systemPrompt: fullSystemPrompt,
      middleware: [
        anthropicPromptCachingMiddleware({ minMessagesToCache: 1 }),
      ],
    });

    // Run the agent
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: message }],
      },
      {
        recursionLimit: MAX_ITERATIONS * 3, // Each iteration may use multiple recursion steps
      }
    );

    // Log thinking blocks for debugging
    for (const msg of result.messages) {
      if (msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "thinking" && (block as any).thinking) {
            console.log("[chat] Thinking:", String((block as any).thinking).substring(0, 200));
            break;
          }
        }
      }
    }

    // Extract the final response text
    const lastMessage = result.messages[result.messages.length - 1];
    const finalResponse =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : Array.isArray(lastMessage?.content)
          ? lastMessage.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
          : `Modified ${filesChanged.length} files.`;

    return {
      response: finalResponse,
      toolCalls,
      filesChanged,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[chat] Error:", errorMessage);
    return {
      response: "",
      toolCalls,
      filesChanged,
      error: `Chat agent failed: ${errorMessage}`,
    };
  }
}

/**
 * Quick check if request likely needs architecture agent
 */
export function shouldRecommendArchitecture(message: string): boolean {
  const bigChangeKeywords = [
    "authentication",
    "auth",
    "login",
    "signup",
    "payments",
    "stripe",
    "database",
    "new page",
    "add page",
    "add route",
    "restructure",
    "rebuild",
    "save data",
    "store data",
    "persist",
    "persistence",
    "crud",
    "supabase",
  ];

  const messageLower = message.toLowerCase();
  return bigChangeKeywords.some((kw) => messageLower.includes(kw));
}
