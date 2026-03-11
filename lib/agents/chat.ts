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
 * Classify edit complexity to determine thinking budget.
 * Simple edits need less reasoning; complex edits need more.
 */
function classifyEditComplexity(
  message: string,
  fileCount: number
): "simple" | "moderate" | "complex" {
  const msgLower = message.toLowerCase();

  // Complex: structural changes, new features, multi-file refactors
  const complexPatterns =
    /\b(add page|new page|add route|new route|refactor|restructure|rebuild|authentication|auth|database|crud|supabase|api|middleware|new feature|add feature)\b/i;
  if (complexPatterns.test(msgLower) || fileCount > 10) {
    return "complex";
  }

  // Simple: cosmetic/styling changes
  const simplePatterns =
    /\b(color|colour|font|padding|margin|spacing|text|size|border|radius|shadow|opacity|background|bg-|rounded|bold|italic|underline|center|align|gap|width|height|dark mode|light mode|theme)\b/i;
  // Only simple if the message is short and matches simple patterns
  if (simplePatterns.test(msgLower) && message.length < 200) {
    return "simple";
  }

  return "moderate";
}

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

## Database Awareness

- **schema.sql is auto-executed** after you write it. The system handles execution automatically — you do NOT need to tell the user to run it manually or visit the SQL Editor.
- There are TWO "table not found" errors: 42P01 (PostgreSQL) and "Could not find the table in the schema cache" (PostgREST). BOTH are transient during initial setup.
- **NEVER modify .env.local** — it's auto-provisioned with real Supabase credentials.
- **NEVER join auth.users** via PostgREST — use the profiles table instead.

### Schema Modification Rules

**When the user EXPLICITLY asks to modify the database** (add column, add table, fix RLS, etc.):
1. Load the \`modify-schema\` skill for detailed guidance
2. Read current schema.sql with read_file BEFORE making changes
3. Modify schema.sql following the skill's additive patterns
4. Also update TypeScript interfaces and component queries to match
5. schema.sql is auto-executed after you write it — never tell the user to run it manually

**When the user asks to "execute", "run", or "apply" schema.sql** (without requesting changes):
1. Read schema.sql with read_file
2. Re-write it back using write_file with the same content
3. Respond: "Running your database schema now." (the system auto-executes it)

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

## Examples

### Example 1: Simple Styling Change
**User**: "Make the hero heading larger and change the CTA button to rounded-full"
**Approach**: read_file components/HeroSection.tsx → change text-4xl to text-6xl, add rounded-full to button → write_file with complete file.

### Example 2: Add a Feature
**User**: "Add a dark mode toggle to the navbar"
**Approach**: load_skill understand-request → load_skill hydration-safety → read_file components/Navbar.tsx → read_file app/globals.css → add ThemeToggle component using useState + useEffect for hydration safety → write both files with complete content.

## Current Project Files
`;

/**
 * Score a file's relevance to a user message.
 * Higher score = more likely the user wants to modify this file.
 */
function scoreFileRelevance(
  filePath: string,
  fileContent: string,
  userMessage: string,
  architecture?: string
): number {
  const msgLower = userMessage.toLowerCase();
  const pathLower = filePath.toLowerCase();
  let score = 0;

  // 1. File path or component name mentioned directly in message (+5)
  const fileName = filePath.split("/").pop()?.replace(/\.(tsx?|css|sql)$/, "") || "";
  const fileNameLower = fileName.toLowerCase();
  if (msgLower.includes(fileNameLower) && fileNameLower.length > 2) {
    score += 5;
  }

  // 2. Path segments mentioned (e.g., "page", "layout", "header", "nav") (+3)
  const pathSegments = filePath.split("/").map(s => s.replace(/\.\w+$/, "").toLowerCase());
  for (const seg of pathSegments) {
    if (seg.length > 2 && msgLower.includes(seg)) {
      score += 3;
      break; // Only count once
    }
  }

  // 3. Keyword overlap between message words and file content (+1 per match, max 3)
  const msgWords = msgLower.split(/\s+/).filter(w => w.length > 3);
  const contentLower = fileContent.toLowerCase();
  let keywordMatches = 0;
  for (const word of msgWords) {
    if (contentLower.includes(word)) {
      keywordMatches++;
      if (keywordMatches >= 3) break;
    }
  }
  score += keywordMatches;

  // 4. Key files always get a baseline score
  if (pathLower === "app/page.tsx" || pathLower === "app/layout.tsx") score += 2;
  if (pathLower === "app/globals.css") score += 1;
  if (pathLower === "schema.sql") score += 1;

  // 5. CSS-related messages boost globals.css
  if (pathLower === "app/globals.css" && /color|theme|dark|light|font|style|css/i.test(userMessage)) {
    score += 4;
  }

  // 6. Database-related messages boost schema.sql
  if (pathLower === "schema.sql" && /database|table|column|schema|rls|policy|sql/i.test(userMessage)) {
    score += 4;
  }

  return score;
}

/**
 * Build smart file context for the system prompt.
 * Includes top relevant files in full, lists rest as names only.
 */
function buildSmartFileContext(
  files: Map<string, string>,
  userMessage: string,
  architecture?: string
): string {
  const MAX_FULL_FILES = 5;
  const MAX_FULL_CHARS = 15000;

  // Score all files
  const scored = Array.from(files.entries()).map(([path, content]) => ({
    path,
    content,
    score: scoreFileRelevance(path, content, userMessage, architecture),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Low-score fallback: if no file scores >= 2, the message is too vague
  // to determine relevance — include all files so the agent has full context
  const topScore = scored[0]?.score ?? 0;
  if (topScore < 2) {
    const allFiles = scored.map(f => `\n#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n");
    return "\n### All Project Files:\n" + allFiles;
  }

  // Select top files for full inclusion (within char budget)
  const fullFiles: { path: string; content: string }[] = [];
  let totalChars = 0;
  for (const file of scored) {
    if (fullFiles.length >= MAX_FULL_FILES) break;
    if (totalChars + file.content.length > MAX_FULL_CHARS && fullFiles.length > 0) break;
    fullFiles.push({ path: file.path, content: file.content });
    totalChars += file.content.length;
  }

  const fullPaths = new Set(fullFiles.map(f => f.path));
  const remainingFiles = scored.filter(f => !fullPaths.has(f.path));

  const sections: string[] = [];

  // Full file contents for relevant files
  if (fullFiles.length > 0) {
    sections.push("\n### Relevant File Contents:\n");
    for (const { path, content } of fullFiles) {
      sections.push(`\n#### ${path}\n\`\`\`\n${content}\n\`\`\`\n`);
    }
  }

  // List remaining files as names only
  if (remainingFiles.length > 0) {
    sections.push("\n### Other Project Files (use read_file to access):\n");
    for (const file of remainingFiles) {
      sections.push(`- ${file.path}`);
    }
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
            console.warn(`[chat] Auto-appending NOTIFY pgrst to schema.sql`);
            content += `\n-- Notify PostgREST to reload schema cache\nNOTIFY pgrst, 'reload schema';\n`;
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

          // Track package.json as changed
          if (!filesChanged.includes("package.json")) {
            filesChanged.push("package.json");
          }

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

    // Build system prompt with smart file context (relevance-scored)
    const fileContext = buildSmartFileContext(context.files, message, architecture);

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

    // Build full system prompt: static (cacheable) → dynamic
    // Static prefix: SYSTEM_PROMPT + skills section (cached at 90% discount after first call)
    const staticPrefix = skillsSection
      ? `${SYSTEM_PROMPT}\n\n${skillsSection}`
      : SYSTEM_PROMPT;

    // Dynamic suffix: architecture context + file context (changes per session/message)
    const dynamicParts = [architectureContext, fileContext].filter(Boolean).join("\n\n");
    const fullSystemPrompt = `${staticPrefix}\n\n${dynamicParts}`;

    // Adaptive thinking budget based on edit complexity
    const complexity = classifyEditComplexity(message, context.files.size);
    const thinkingBudget = complexity === "simple" ? 2000 : complexity === "moderate" ? 5000 : 10000;

    // Create the model instance
    const model = new ChatAnthropic({
      model: MODEL_NAME,
      maxTokens: 25000,
      streaming: true,
      thinking: {
        type: "enabled",
        budget_tokens: thinkingBudget,
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
