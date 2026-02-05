/**
 * Agent Tools
 *
 * Tool definitions and implementations for the three-agent system.
 * Tools are used by agents for file operations and package installation.
 *
 * Ported from: reference-code/backend-v2/tools.py
 */

import type { AnthropicTool, ToolContext, ToolResult } from "./types";
import { loadSkill } from "./skills";

/**
 * Whitelist of allowed packages (matches PACKAGE REFERENCE in architecture prompt)
 */
export const ALLOWED_PACKAGES = new Set([
  // Games
  "phaser",
  "pixi.js",
  // Charts
  "recharts",
  "@tremor/react",
  "d3",
  // Animation
  "framer-motion",
  "gsap",
  "@react-spring/web",
  // Forms
  "react-hook-form",
  "zod",
  "@hookform/resolvers",
  // Rich Content
  "@tiptap/react",
  "@tiptap/starter-kit",
  "react-markdown",
  // State
  "zustand",
  "@tanstack/react-query",
  // Interaction
  "@hello-pangea/dnd",
  "react-window",
  // Date
  "date-fns",
  "react-day-picker",
  // 3D
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  // Maps
  "react-leaflet",
  "leaflet",
  // Types (auto-added when needed)
  "@types/three",
  "@types/leaflet",
  // Database
  "@supabase/supabase-js",
  "@supabase/ssr",
]);

/**
 * Validate package name format and whitelist
 */
export function validatePackageName(name: string): boolean {
  // Check format (npm package name pattern)
  const npmPattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!npmPattern.test(name)) {
    return false;
  }
  // Check whitelist
  return ALLOWED_PACKAGES.has(name);
}

/**
 * Anthropic tool definitions for function calling
 */
export const TOOL_DEFINITIONS: Record<string, AnthropicTool> = {
  write_file: {
    name: "write_file",
    description:
      "Write content to a file. Creates the file if it doesn't exist. Writes to E2B sandbox first (hot reload), then backs up to Convex.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description:
            'Relative path from project root (e.g., "app/page.tsx", "components/Header.tsx")',
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["file_path", "content"],
    },
  },

  read_file: {
    name: "read_file",
    description:
      "Read and return content of a file. Reads from E2B sandbox first, then local fallback.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Relative path from project root",
        },
      },
      required: ["file_path"],
    },
  },

  update_file: {
    name: "update_file",
    description:
      "Update (overwrite) content of an existing file. Uses E2B sandbox if available.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Relative path from project root",
        },
        content: {
          type: "string",
          description: "New content for the file",
        },
      },
      required: ["file_path", "content"],
    },
  },

  install_packages: {
    name: "install_packages",
    description:
      "Install npm packages in the sandbox. Only packages from PACKAGES section in architecture.md should be installed. Packages must be in the allowed list.",
    input_schema: {
      type: "object",
      properties: {
        packages: {
          type: "string",
          description:
            'Space-separated package names (e.g., "phaser" or "recharts zustand")',
        },
      },
      required: ["packages"],
    },
  },

  grep_code: {
    name: "grep_code",
    description:
      "Search for a pattern in generated code files. Returns matching lines with file paths and line numbers.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            'Regex pattern to search for (e.g., "className", "useState", "Header")',
        },
        file_glob: {
          type: "string",
          description: "Glob pattern for files to search (default: **/*.tsx)",
        },
      },
      required: ["pattern"],
    },
  },

  list_project_files: {
    name: "list_project_files",
    description:
      "List all files in the generated project. Helps understand the project structure before making changes.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  load_skill: {
    name: "load_skill",
    description:
      "Load specialized instructions for a skill. Use this when you need detailed guidance for a specific task type like react-component, form-builder, rls-policies, or fix-bug.",
    input_schema: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          description:
            "Name of the skill to load (e.g., 'react-component', 'rls-policies', 'fix-bug')",
        },
      },
      required: ["skill_name"],
    },
  },
};

/**
 * Get tool definitions for a specific agent
 */
export function getToolsForAgent(
  agentName: "architecture" | "coder" | "chat"
): AnthropicTool[] {
  const toolNames = {
    architecture: ["write_file", "load_skill"],
    coder: ["read_file", "write_file", "update_file", "install_packages", "load_skill"],
    chat: [
      "read_file",
      "write_file",
      "update_file",
      "grep_code",
      "list_project_files",
      "install_packages",
      "load_skill",
    ],
  };

  return toolNames[agentName].map((name) => TOOL_DEFINITIONS[name]);
}

/**
 * Tool executor - routes tool calls to implementations
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  switch (toolName) {
    case "write_file":
      return executeWriteFile(
        input.file_path as string,
        input.content as string,
        context,
        sandboxActions
      );

    case "read_file":
      return executeReadFile(
        input.file_path as string,
        context,
        sandboxActions
      );

    case "update_file":
      return executeUpdateFile(
        input.file_path as string,
        input.content as string,
        context,
        sandboxActions
      );

    case "install_packages":
      return executeInstallPackages(
        input.packages as string,
        sandboxActions
      );

    case "grep_code":
      return executeGrepCode(
        input.pattern as string,
        (input.file_glob as string) || "**/*.tsx",
        context
      );

    case "list_project_files":
      return executeListProjectFiles(context, sandboxActions);

    case "load_skill":
      return executeLoadSkill(input.skill_name as string);

    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
  }
}

/**
 * Load skill tool implementation
 */
async function executeLoadSkill(skillName: string): Promise<ToolResult> {
  const result = await loadSkill(skillName);
  return {
    success: result.success,
    message: result.content,
  };
}

/**
 * Interface for sandbox actions (to be injected from Convex)
 *
 * These are closures that capture sessionId/sandboxId from the outer scope.
 * This allows the tool execution functions to work without knowing the specific IDs.
 */
export interface SandboxActions {
  /** Write file to sandbox (triggers hot reload) and backup to Convex */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Read file from sandbox, returns null if not found */
  readFile: (path: string) => Promise<string | null>;
  /** Delete file from sandbox */
  deleteFile: (path: string) => Promise<void>;
  /** Run command in sandbox */
  runCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  /** List files in directory */
  listFiles: (directory: string) => Promise<string[]>;
}

/**
 * Write file tool implementation
 */
async function executeWriteFile(
  filePath: string,
  content: string,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  try {
    // Update local cache
    context.files.set(filePath, content);

    // Track as recently modified
    context.recentFiles = [
      filePath,
      ...context.recentFiles.filter((f) => f !== filePath),
    ].slice(0, 10);

    // Write to sandbox (the sandboxActions.writeFile handles both E2B and Convex backup)
    await sandboxActions.writeFile(filePath, content);

    return {
      success: true,
      message: `Hot reload: ${filePath}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to write: ${filePath} - ${errorMessage}`,
    };
  }
}

/**
 * Read file tool implementation
 */
async function executeReadFile(
  filePath: string,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  // Check local cache first
  const cached = context.files.get(filePath);
  if (cached) {
    return {
      success: true,
      message: cached,
    };
  }

  // Read from sandbox
  try {
    const content = await sandboxActions.readFile(filePath);

    if (content !== null) {
      // Cache for future reads
      context.files.set(filePath, content);
      return {
        success: true,
        message: content,
      };
    }
    return {
      success: false,
      message: `File not found: ${filePath}`,
    };
  } catch {
    return {
      success: false,
      message: `File not found: ${filePath}`,
    };
  }
}

/**
 * Update file tool implementation
 */
async function executeUpdateFile(
  filePath: string,
  content: string,
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  // Check if file exists in local cache
  const exists = context.files.has(filePath);

  if (!exists) {
    // Check sandbox
    try {
      const sandboxContent = await sandboxActions.readFile(filePath);
      if (sandboxContent === null) {
        return {
          success: false,
          message: `File does not exist: ${filePath}`,
        };
      }
    } catch {
      return {
        success: false,
        message: `File does not exist: ${filePath}`,
      };
    }
  }

  // Use write_file implementation
  return executeWriteFile(filePath, content, context, sandboxActions);
}

/**
 * Install packages tool implementation
 */
async function executeInstallPackages(
  packages: string,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  // Parse and validate packages
  const packageList = packages.trim().split(/\s+/);
  const invalid = packageList.filter((p) => !validatePackageName(p));

  if (invalid.length > 0) {
    return {
      success: false,
      message: `Error: Package(s) not in allowed list: ${invalid.join(", ")}`,
    };
  }

  if (packageList.length === 0) {
    return {
      success: false,
      message: "Error: No packages specified",
    };
  }

  try {
    // Install all packages in one command (faster)
    const packagesStr = packageList.join(" ");
    const command = `npm install ${packagesStr}`;

    let result = await sandboxActions.runCommand(command);

    // If peer dependency conflict, retry with --legacy-peer-deps
    if (result.exitCode !== 0 && result.stderr.includes("ERESOLVE")) {
      console.log(
        "Peer dependency conflict detected, retrying with --legacy-peer-deps..."
      );
      const retryCommand = `npm install --legacy-peer-deps ${packagesStr}`;
      result = await sandboxActions.runCommand(retryCommand);
    }

    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to install packages: ${result.stderr.slice(0, 500)}`,
      };
    }

    return {
      success: true,
      message: `Installed: ${packageList.join(", ")}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to install packages: ${errorMessage}`,
    };
  }
}

/**
 * Grep code tool implementation
 */
function executeGrepCode(
  pattern: string,
  fileGlob: string,
  context: ToolContext
): ToolResult {
  const results: string[] = [];

  // Simple glob matching (just handles *.tsx type patterns)
  const globPattern = fileGlob.replace("**/*", "*").replace("*", ".*");
  const globRegex = new RegExp(globPattern);

  for (const [filePath, content] of context.files.entries()) {
    // Check if file matches glob pattern
    if (!globRegex.test(filePath)) {
      continue;
    }

    const lines = content.split("\n");
    const patternRegex = new RegExp(pattern, "i");

    for (let i = 0; i < lines.length; i++) {
      if (patternRegex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }

  if (results.length === 0) {
    return {
      success: true,
      message: `No matches found for pattern '${pattern}' in ${fileGlob}`,
    };
  }

  // Limit results to avoid token overflow
  if (results.length > 20) {
    return {
      success: true,
      message:
        results.slice(0, 20).join("\n") +
        `\n... and ${results.length - 20} more matches`,
    };
  }

  return {
    success: true,
    message: results.join("\n"),
  };
}

/**
 * List project files tool implementation
 */
async function executeListProjectFiles(
  context: ToolContext,
  sandboxActions: SandboxActions
): Promise<ToolResult> {
  // Get files from local cache
  let files = Array.from(context.files.keys());

  // Also get files from sandbox for completeness
  try {
    const sandboxFiles = await sandboxActions.listFiles("");
    // Merge and dedupe
    const allFiles = new Set([...files, ...sandboxFiles]);
    files = Array.from(allFiles).sort();
  } catch {
    // Fall back to just cached files
    files = files.sort();
  }

  if (files.length === 0) {
    return {
      success: true,
      message: "No files generated yet",
    };
  }

  return {
    success: true,
    message: "Project files:\n" + files.map((f) => `  - ${f}`).join("\n"),
  };
}
