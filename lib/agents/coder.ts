/**
 * Coder Agent
 *
 * Implements the architecture plan by creating all necessary files.
 * Files are written to E2B sandbox for hot reload preview.
 *
 * Uses: read_file, write_file, update_file, install_packages
 * Model: Claude Haiku
 */

import { createAgent, tool, anthropicPromptCachingMiddleware } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { CODER_PROMPT, validateGlobalsCss } from "../prompts";
import { validatePackageName, type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall } from "./types";
import { getSkillsMetadata, formatSkillsForPrompt, loadSkill } from "./skills";

const MODEL_NAME = "claude-sonnet-4-6";

/**
 * Run the Coder Agent to implement architecture.
 *
 * @param architecture - Architecture document content
 * @param previewUrl - E2B preview URL for reference
 * @param context - Tool context for file operations
 * @param sandboxActions - Sandbox action functions
 * @returns Agent result with generated files
 */
export async function runCoderAgent(
  architecture: string,
  previewUrl: string,
  context: ToolContext,
  sandboxActions: SandboxActions,
  designTokensBlock?: string,
  schemaGenerated?: boolean,
  errorFeedback?: string,
  options?: { recursionLimit?: number; fixRecursionLimit?: number }
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = [];

  // Load skills metadata for system prompt
  const skills = await getSkillsMetadata();
  const skillsSection = formatSkillsForPrompt(skills, "coder");

  // Shared helper for write_file and update_file — validates, caches, writes, and tracks
  async function performFileWrite(
    file_path: string,
    content: string,
    toolName: "write_file" | "update_file"
  ): Promise<string> {
    try {
      // Validate globals.css before writing (block v3 syntax)
      if (file_path === "app/globals.css") {
        const validationError = validateGlobalsCss(content);
        if (validationError) return validationError;
      }

      context.files.set(file_path, content);
      context.recentFiles = [
        file_path,
        ...context.recentFiles.filter((f) => f !== file_path),
      ].slice(0, 10);

      await sandboxActions.writeFile(file_path, content);

      toolCalls.push({
        name: toolName,
        input: { file_path, content },
        output: `Hot reload: ${file_path}`,
      });

      if (!filesChanged.includes(file_path)) {
        filesChanged.push(file_path);
      }

      return `Hot reload: ${file_path}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return `Failed to ${toolName === "write_file" ? "write" : "update"}: ${file_path} - ${msg}`;
    }
  }

  // Define tools using the langchain tool() function
  const writeFileTool = tool(
    async ({ file_path, content }: { file_path: string; content: string }) => {
      return performFileWrite(file_path, content, "write_file");
    },
    {
      name: "write_file",
      description:
        "Write content to a file. Creates the file if it doesn't exist. Writes to E2B sandbox first (hot reload), then backs up to Convex.",
      schema: z.object({
        file_path: z
          .string()
          .describe(
            'Relative path from project root (e.g., "app/page.tsx", "components/Header.tsx")'
          ),
        content: z.string().describe("Content to write to the file"),
      }),
    }
  );

  const readFileTool = tool(
    async ({ file_path }: { file_path: string }) => {
      const cached = context.files.get(file_path);
      if (cached) {
        toolCalls.push({
          name: "read_file",
          input: { file_path },
          output: cached,
        });
        return cached;
      }

      try {
        const content = await sandboxActions.readFile(file_path);
        if (content !== null) {
          context.files.set(file_path, content);
          toolCalls.push({
            name: "read_file",
            input: { file_path },
            output: content,
          });
          return content;
        }
        return `File not found: ${file_path}`;
      } catch {
        return `File not found: ${file_path}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read and return content of a file. Reads from E2B sandbox first, then local fallback.",
      schema: z.object({
        file_path: z.string().describe("Relative path to the file to read"),
      }),
    }
  );

  const updateFileTool = tool(
    async ({ file_path, content }: { file_path: string; content: string }) => {
      // Verify file exists before updating
      const exists = context.files.has(file_path);
      if (!exists) {
        try {
          const sandboxContent = await sandboxActions.readFile(file_path);
          if (sandboxContent === null) {
            return `File does not exist: ${file_path}`;
          }
        } catch {
          return `File does not exist: ${file_path}`;
        }
      }

      return performFileWrite(file_path, content, "update_file");
    },
    {
      name: "update_file",
      description:
        "Update an existing file with new content. File must already exist.",
      schema: z.object({
        file_path: z.string().describe("Relative path to the file to update"),
        content: z.string().describe("New content for the file"),
      }),
    }
  );

  const installPackagesTool = tool(
    async ({ packages }: { packages: string }) => {
      const packageList = packages.trim().split(/\s+/).filter(Boolean);
      const invalid = packageList.filter(
        (p: string) => !validatePackageName(p)
      );

      if (invalid.length > 0) {
        return `Error: Package(s) not in allowed list: ${invalid.join(", ")}`;
      }

      if (packageList.length === 0) {
        return "Error: No packages specified";
      }

      try {
        const packagesStr = packageList.join(" ");
        let result = await sandboxActions.runCommand(
          `npm install ${packagesStr}`
        );

        if (result.exitCode !== 0 && result.stderr.includes("ERESOLVE")) {
          result = await sandboxActions.runCommand(
            `npm install --legacy-peer-deps ${packagesStr}`
          );
        }

        if (result.exitCode !== 0) {
          return `Failed to install packages: ${result.stderr.slice(0, 500)}`;
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
      description:
        "Install npm packages. Only allowed packages can be installed.",
      schema: z.object({
        packages: z
          .string()
          .describe("Space-separated list of packages to install"),
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

  const tools = [
    writeFileTool,
    readFileTool,
    updateFileTool,
    installPackagesTool,
    loadSkillTool,
  ];

  try {
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

    // Build system prompt with skills metadata
    const systemPromptWithSkills = skillsSection
      ? `${CODER_PROMPT}\n\n${skillsSection}`
      : CODER_PROMPT;

    // Create the agent using the new API
    const agent = createAgent({
      model,
      tools,
      systemPrompt: systemPromptWithSkills,
      middleware: [
        anthropicPromptCachingMiddleware({ minMessagesToCache: 1 }),
      ],
    });

    // Build the input message with explicit design extraction instructions
    const designSection = designTokensBlock
      ? `\n\n${designTokensBlock}\n`
      : `\n\n## ⚠️ CRITICAL: EXTRACT DESIGN TOKENS FIRST

Before writing ANY code, find DESIGN_DIRECTION in architecture above and extract:
1. aesthetic → determines overall style
2. color_scheme.light → CSS variables for :root
3. color_scheme.dark → CSS variables for .dark
4. typography.pairing → font imports for layout.tsx
5. motion_level → transition classes
6. spacing_scale → gap/padding choices
7. shadow_system → shadow classes
8. radius_system → rounded classes\n`;

    const schemaBlock = schemaGenerated
      ? `\n## SCHEMA ALREADY GENERATED
schema.sql has been pre-generated, validated, and executed against Supabase.
DO NOT create or modify schema.sql — it already exists and the database is ready.
Use read_file to check schema.sql for exact table/column names before writing components.
All tables referenced in the DATABASE section are confirmed to exist.\n`
      : "";

    // Build user message — first attempt vs fix retry
    const userMessage = errorFeedback
      ? errorFeedback  // Already formatted by formatCoderRetryPrompt
      : `Implement based on architecture:

${architecture}
${designSection}${schemaBlock}
## FILE ORDER (MANDATORY):
1. FIRST: CREATE app/globals.css with design tokens (file does NOT exist yet)
2. SECOND: CREATE app/layout.tsx with fonts (file does NOT exist yet)
3. THEN: app components and pages using Tailwind theme classes

## PRE-INSTALLED (DO NOT CREATE):
- lib/utils.ts (cn utility) — already exists
- components/ui/*.tsx (ALL shadcn components) — already pre-installed
- Just import: import { Button } from "@/components/ui/button"

## VALIDATION:
- If you use "bg-white" or "text-gray-500" → WRONG, use Tailwind theme classes (bg-primary, text-foreground, bg-card)
- If globals.css has "#______" placeholders → WRONG, fill in actual hex values
- If layout.tsx uses Geist or Inter font when pairing specifies different → WRONG
- If you create files in components/ui/ → WRONG, they are pre-installed

The Next.js app is ALREADY SETUP in E2B sandbox.
Check if PACKAGES section exists - install FIRST if needed.
FILE PATHS:
- app/globals.css (CREATE with design tokens - does not exist yet!)
- app/layout.tsx (CREATE with custom fonts - does not exist yet!)
- app/page.tsx
- components/Name.tsx (app-specific custom components only)
- types/index.ts

Preview is live at: ${previewUrl}`;

    // Run the agent with dynamic recursion limit based on architecture complexity
    // Fix mode uses lower limit since it only needs to read + fix specific files
    const baseLimit = options?.recursionLimit ?? 150;
    const fixLimit = options?.fixRecursionLimit ?? 50;
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: userMessage }],
      },
      {
        recursionLimit: errorFeedback ? fixLimit : baseLimit,
      }
    );

    // Log thinking blocks for debugging
    for (const msg of result.messages) {
      if (msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "thinking" && block.thinking) {
            console.log("[coder] Thinking:", String((block as any).thinking).substring(0, 200));
            break; // Only log first thinking block
          }
        }
      }
    }

    // Extract the final output from messages
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : `Created ${filesChanged.length} files. Preview is live!`;

    return {
      response: responseText,
      toolCalls,
      filesChanged,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Detect recursion limit exhaustion — agent ran out of steps, not a crash
    const isRecursionExhaustion =
      error instanceof Error && (
        error.name === "GraphRecursionError" ||
        errorMessage.includes("Recursion limit") ||
        errorMessage.includes("recursion limit")
      );

    if (isRecursionExhaustion) {
      console.warn(`[coder] Recursion limit exhausted after generating ${filesChanged.length} files`);
      return {
        response: `Generated ${filesChanged.length} files before reaching the iteration limit.`,
        toolCalls,
        filesChanged,
        error: `recursion_exhaustion:${filesChanged.length}`,
      };
    }

    console.error("[coder] Error:", errorMessage);
    return {
      response: "",
      toolCalls,
      filesChanged,
      error: `Coder agent failed: ${errorMessage}`,
    };
  }
}
