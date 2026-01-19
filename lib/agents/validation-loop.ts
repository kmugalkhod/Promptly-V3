/**
 * Validation Loop
 *
 * TypeScript-only validation with retry mechanism for fast chat responses.
 * Validates code changes before applying to production.
 *
 * Features:
 * - TypeScript type checking (fast validation)
 * - Automatic retry on error with LLM-generated fixes
 * - Max retries limit
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SandboxActions } from "./tools";
import type { FileDiff, ApplyDiffResult } from "./tools/apply-diff";
import { applyDiff } from "./tools/apply-diff";
import type { ToolContext } from "./types";

const FIX_MODEL = "claude-3-5-haiku-20241022";

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  success: boolean;
  /** TypeScript errors if any */
  errors: TypeScriptError[];
  /** Whether we retried and fixed errors */
  wasRetried: boolean;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * TypeScript error info
 */
export interface TypeScriptError {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Error message */
  message: string;
  /** Error code (e.g., TS2322) */
  code: string;
}

/**
 * Configuration for validation loop
 */
export interface ValidationConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Whether to run TypeScript validation (default: true) */
  runTypeScript?: boolean;
  /** Timeout for TypeScript check in ms (default: 30000) */
  typeScriptTimeout?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ValidationConfig> = {
  maxRetries: 3,
  runTypeScript: true,
  typeScriptTimeout: 30000,
};

/**
 * Validate and apply diffs with retry loop
 */
export async function validateAndApply(
  diffs: FileDiff[],
  context: ToolContext,
  sandboxActions: SandboxActions,
  editableFiles: string[],
  config: ValidationConfig = {}
): Promise<{ result: ValidationResult; appliedDiffs: FileDiff[] }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let currentDiffs = diffs;
  let retryCount = 0;

  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    // 1. Apply diffs to sandbox
    const applyResults = await applyDiffsToSandbox(
      currentDiffs,
      context,
      sandboxActions,
      editableFiles
    );

    // Check if all diffs applied successfully
    const failedDiffs = applyResults.filter((r) => !r.result.success);
    if (failedDiffs.length > 0) {
      console.error(
        `[validation] ${failedDiffs.length} diffs failed to apply:`,
        failedDiffs.map((d) => d.diff.filePath)
      );

      // Return failure if diffs can't even be applied
      return {
        result: {
          success: false,
          errors: failedDiffs.map((d) => ({
            file: d.diff.filePath,
            line: 0,
            column: 0,
            message: d.result.error || "Failed to apply diff",
            code: "APPLY_ERROR",
          })),
          wasRetried: retryCount > 0,
          retryCount,
        },
        appliedDiffs: currentDiffs,
      };
    }

    // 2. Run TypeScript validation
    if (!cfg.runTypeScript) {
      return {
        result: {
          success: true,
          errors: [],
          wasRetried: retryCount > 0,
          retryCount,
        },
        appliedDiffs: currentDiffs,
      };
    }

    const tsResult = await runTypeScriptCheck(sandboxActions, cfg.typeScriptTimeout);

    if (tsResult.success) {
      // Success - TypeScript passes
      return {
        result: {
          success: true,
          errors: [],
          wasRetried: retryCount > 0,
          retryCount,
        },
        appliedDiffs: currentDiffs,
      };
    }

    // 3. TypeScript failed - try to fix
    console.log(
      `[validation] TypeScript check failed with ${tsResult.errors.length} errors (attempt ${attempt}/${cfg.maxRetries})`
    );

    if (attempt < cfg.maxRetries) {
      // Generate fix based on TypeScript errors
      const fixedDiffs = await generateFix(currentDiffs, tsResult.errors, context);
      if (fixedDiffs) {
        currentDiffs = fixedDiffs;
        retryCount++;
        continue;
      }
    }

    // Max retries reached or couldn't generate fix
    return {
      result: {
        success: false,
        errors: tsResult.errors,
        wasRetried: retryCount > 0,
        retryCount,
      },
      appliedDiffs: currentDiffs,
    };
  }

  // Should not reach here
  return {
    result: {
      success: false,
      errors: [],
      wasRetried: retryCount > 0,
      retryCount,
    },
    appliedDiffs: currentDiffs,
  };
}

/**
 * Apply diffs to sandbox
 */
async function applyDiffsToSandbox(
  diffs: FileDiff[],
  context: ToolContext,
  sandboxActions: SandboxActions,
  editableFiles: string[]
): Promise<Array<{ diff: FileDiff; result: ApplyDiffResult }>> {
  const results: Array<{ diff: FileDiff; result: ApplyDiffResult }> = [];

  for (const diff of diffs) {
    // Get current file content
    let fileContent = context.files.get(diff.filePath);

    if (!fileContent) {
      // Try to read from sandbox
      const content = await sandboxActions.readFile(diff.filePath);
      if (content) {
        fileContent = content;
        context.files.set(diff.filePath, content);
      } else {
        // File doesn't exist - for inserts only, we can create it
        const hasOnlyInserts = diff.hunks.every((h) => h.operation === "insert");
        if (hasOnlyInserts) {
          fileContent = "";
        } else {
          results.push({
            diff,
            result: {
              success: false,
              error: `File not found: ${diff.filePath}`,
              warnings: [],
              linesModified: 0,
            },
          });
          continue;
        }
      }
    }

    // Apply diff
    const result = applyDiff(fileContent, diff, {
      editableFiles,
      verifyContent: true,
      fuzzyMatch: true,
    });

    if (result.success && result.newContent) {
      // Update context and sandbox
      context.files.set(diff.filePath, result.newContent);
      context.recentFiles = [
        diff.filePath,
        ...context.recentFiles.filter((f) => f !== diff.filePath),
      ].slice(0, 10);

      await sandboxActions.writeFile(diff.filePath, result.newContent);
    }

    results.push({ diff, result });
  }

  return results;
}

/**
 * Run TypeScript check in sandbox
 */
async function runTypeScriptCheck(
  sandboxActions: SandboxActions,
  timeout: number
): Promise<{ success: boolean; errors: TypeScriptError[] }> {
  try {
    const result = await sandboxActions.runCommand("npx tsc --noEmit 2>&1 || true");

    // Parse TypeScript output
    const errors = parseTypeScriptOutput(result.stdout + result.stderr);

    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("[validation] TypeScript check error:", error);
    return {
      success: false,
      errors: [
        {
          file: "",
          line: 0,
          column: 0,
          message: error instanceof Error ? error.message : "TypeScript check failed",
          code: "TS_CHECK_ERROR",
        },
      ],
    };
  }
}

/**
 * Parse TypeScript compiler output into structured errors
 */
function parseTypeScriptOutput(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];

  // TypeScript error format: file(line,column): error TSxxxx: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
    });
  }

  return errors;
}

/**
 * Generate fix for TypeScript errors using LLM
 */
async function generateFix(
  diffs: FileDiff[],
  errors: TypeScriptError[],
  context: ToolContext
): Promise<FileDiff[] | null> {
  const client = new Anthropic();

  // Build context about the errors
  const errorContext = errors
    .map((e) => `${e.file}(${e.line},${e.column}): ${e.code}: ${e.message}`)
    .join("\n");

  // Get relevant file contents
  const relevantFiles = [...new Set(errors.map((e) => e.file))];
  const fileContext = relevantFiles
    .map((file) => {
      const content = context.files.get(file);
      if (!content) return null;
      return `### ${file}\n\`\`\`typescript\n${content}\n\`\`\``;
    })
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: FIX_MODEL,
      max_tokens: 2048,
      system: `You are a TypeScript expert. Fix the TypeScript errors by providing corrected diffs.

Return your fixes as a JSON object with this structure:
{
  "fixes": [
    {
      "filePath": "path/to/file.tsx",
      "hunks": [
        {
          "startLine": 10,
          "endLine": 12,
          "operation": "replace",
          "oldContent": "original lines",
          "newContent": "fixed lines"
        }
      ]
    }
  ]
}

Only fix what's necessary to resolve the TypeScript errors. Don't make unrelated changes.`,
      messages: [
        {
          role: "user",
          content: `Fix these TypeScript errors:

${errorContext}

Current file contents:
${fileContext}

Return ONLY the JSON object with fixes.`,
        },
      ],
    });

    // Extract text content
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      console.error("[validation] No text response from fix generation");
      return null;
    }

    // Parse JSON response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[validation] No JSON found in fix response");
      return null;
    }

    const fixData = JSON.parse(jsonMatch[0]) as { fixes: FileDiff[] };
    return fixData.fixes;
  } catch (error) {
    console.error("[validation] Fix generation failed:", error);
    return null;
  }
}

/**
 * Quick validation - just check if diffs can be applied without TypeScript
 */
export async function quickValidate(
  diffs: FileDiff[],
  context: ToolContext,
  editableFiles: string[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const diff of diffs) {
    // Check edit scope
    if (!editableFiles.includes(diff.filePath)) {
      errors.push(`File "${diff.filePath}" is not in edit scope`);
      continue;
    }

    // Check file exists (unless all operations are inserts)
    const hasNonInsert = diff.hunks.some((h) => h.operation !== "insert");
    if (hasNonInsert && !context.files.has(diff.filePath)) {
      errors.push(`File "${diff.filePath}" does not exist`);
      continue;
    }

    // Validate hunks
    const fileContent = context.files.get(diff.filePath) || "";
    const lines = fileContent.split("\n");

    for (let i = 0; i < diff.hunks.length; i++) {
      const hunk = diff.hunks[i];

      if (hunk.operation !== "insert" && hunk.endLine > lines.length) {
        errors.push(
          `${diff.filePath}: Hunk ${i + 1} endLine (${hunk.endLine}) exceeds file length (${lines.length})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
