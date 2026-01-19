/**
 * Chat Agent - Simple Code Editing Flow
 *
 * A straightforward code editing agent:
 * 1. Receive user message + file context
 * 2. LLM understands what needs to change
 * 3. LLM uses tools to read/write files
 * 4. Return brief response
 *
 * No complex intent extraction or file resolution - just direct editing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { validatePackageName, type SandboxActions } from "./tools";
import type { AgentResult, ToolContext, ToolCall } from "./types";

// Use Sonnet for better quality edits (Haiku loses code too often)
const MODEL_NAME = "claude-sonnet-4-20250514";
const MAX_ITERATIONS = 15;

/**
 * Chat Agent configuration
 */
export interface ChatAgentConfig {
  /** Maximum iterations for agentic loop */
  maxIterations?: number;
}

/**
 * System prompt for the code editing agent
 */
const SYSTEM_PROMPT = `You are a code editing agent for a Next.js website builder. Users describe changes in plain English, you modify their code.

## How To Work

1. **Read the user's request** - understand what files need to change
2. **Get missing context** - use read_file if you need to see files not provided
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

- ❌ Remove existing CSS or styles (even if adding new styles)
- ❌ Remove existing functions or components
- ❌ Simplify or "clean up" code that wasn't asked to change
- ❌ Write partial files with "// ... rest of code"
- ❌ Create extra files user didn't ask for

## Project Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS

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
  config: ChatAgentConfig = {}
): Promise<AgentResult> {
  const { maxIterations = MAX_ITERATIONS } = config;

  const toolCalls: ToolCall[] = [];
  const filesChanged: string[] = [];

  try {
    const client = new Anthropic();

    // Build system prompt with file context
    const fileContext = buildFileContext(context.files);
    const systemPrompt = SYSTEM_PROMPT + fileContext;

    // Define simple tools
    const tools: Anthropic.Tool[] = [
      {
        name: "write_file",
        description:
          "Write or update a file. ALWAYS write the COMPLETE file content, never partial.",
        input_schema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "File path (e.g., 'components/Button.tsx')",
            },
            content: {
              type: "string",
              description: "Complete file content",
            },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "read_file",
        description: "Read a file not in the provided context.",
        input_schema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "File path to read",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "delete_file",
        description: "Delete a file from the project.",
        input_schema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "File path to delete",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "install_packages",
        description: "Install npm packages.",
        input_schema: {
          type: "object" as const,
          properties: {
            packages: {
              type: "string",
              description: "Space-separated package names",
            },
          },
          required: ["packages"],
        },
      },
    ];

    // Agentic loop
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];
    let iterations = 0;
    let finalResponse = "";

    while (iterations < maxIterations) {
      iterations++;

      const response = await client.messages.create({
        model: MODEL_NAME,
        max_tokens: 8192,
        system: systemPrompt,
        tools,
        messages,
      });

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (textBlocks.length > 0) {
        finalResponse = textBlocks.map((b) => b.text).join("\n");
      }

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          context,
          sandboxActions,
          toolCalls,
          filesChanged
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add assistant message and tool results
      messages.push({
        role: "assistant",
        content: response.content,
      });

      messages.push({
        role: "user",
        content: toolResults,
      });
    }

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
 * Execute a tool call
 */
async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
  sandboxActions: SandboxActions,
  toolCalls: ToolCall[],
  filesChanged: string[]
): Promise<string> {
  switch (name) {
    case "write_file": {
      const path = input.path as string | undefined;
      const content = input.content as string | undefined;

      if (!path || typeof path !== "string") {
        return "ERROR: write_file requires a valid path";
      }
      if (content === undefined || typeof content !== "string") {
        return "ERROR: write_file requires content";
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
    }

    case "read_file": {
      const path = input.path as string | undefined;

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
    }

    case "delete_file": {
      const path = input.path as string | undefined;

      if (!path || typeof path !== "string") {
        return "ERROR: delete_file requires a valid path";
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
    }

    case "install_packages": {
      const packages = input.packages as string | undefined;

      if (!packages || typeof packages !== "string") {
        return "ERROR: install_packages requires packages string";
      }

      const packageList = packages.trim().split(/\s+/);
      const invalid = packageList.filter((p) => !validatePackageName(p));

      if (invalid.length > 0) {
        return `ERROR: Package(s) not allowed: ${invalid.join(", ")}`;
      }

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

      return `Installed: ${packageList.join(", ")}`;
    }

    default:
      return `Unknown tool: ${name}`;
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
  ];

  const messageLower = message.toLowerCase();
  return bigChangeKeywords.some((kw) => messageLower.includes(kw));
}
