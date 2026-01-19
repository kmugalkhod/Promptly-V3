/**
 * Apply Diff Tool
 *
 * Diff-based surgical code editing that replaces full-file updates.
 * This approach prevents losing unrelated code by only modifying
 * specific sections of files.
 *
 * Features:
 * - Hunk-based editing (replace, insert, delete)
 * - Content verification before applying
 * - Edit scope enforcement
 * - Warnings for large replacements
 */

import { z } from "zod";

/**
 * A single diff hunk representing a change
 */
export interface DiffHunk {
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed, inclusive) */
  endLine: number;
  /** Type of operation */
  operation: "replace" | "insert" | "delete";
  /** Original content for verification (required for replace/delete) */
  oldContent: string;
  /** New content to insert/replace with */
  newContent: string;
}

/**
 * A file diff containing multiple hunks
 */
export interface FileDiff {
  /** File path relative to project root */
  filePath: string;
  /** List of hunks to apply */
  hunks: DiffHunk[];
}

/**
 * Result of applying a diff
 */
export interface ApplyDiffResult {
  /** Whether the diff was applied successfully */
  success: boolean;
  /** New file content after applying diff */
  newContent?: string;
  /** Error message if failed */
  error?: string;
  /** Warnings (e.g., large replacement) */
  warnings: string[];
  /** Lines modified */
  linesModified: number;
}

/**
 * Configuration for apply diff
 */
export interface ApplyDiffConfig {
  /** Allowed editable files */
  editableFiles: string[];
  /** Whether to verify old content before applying */
  verifyContent?: boolean;
  /** Maximum percentage of file that can be replaced (default: 50) */
  maxReplacementPercent?: number;
  /** Whether to allow fuzzy matching for old content */
  fuzzyMatch?: boolean;
}

/**
 * Zod schema for DiffHunk (for tool definition)
 */
export const DiffHunkSchema = z.object({
  startLine: z.number().int().positive().describe("Starting line number (1-indexed)"),
  endLine: z.number().int().positive().describe("Ending line number (1-indexed, inclusive)"),
  operation: z.enum(["replace", "insert", "delete"]).describe("Type of operation"),
  oldContent: z.string().describe("Original content for verification (required for replace/delete)"),
  newContent: z.string().describe("New content to insert/replace with"),
});

/**
 * Zod schema for FileDiff (for tool definition)
 */
export const FileDiffSchema = z.object({
  filePath: z.string().describe("File path relative to project root"),
  hunks: z.array(DiffHunkSchema).describe("List of diff hunks to apply"),
});

/**
 * Apply a diff to file content
 */
export function applyDiff(
  fileContent: string,
  diff: FileDiff,
  config: ApplyDiffConfig
): ApplyDiffResult {
  const warnings: string[] = [];

  // 1. Check edit scope
  if (!config.editableFiles.includes(diff.filePath)) {
    return {
      success: false,
      error: `File "${diff.filePath}" is not in edit scope. Allowed files: ${config.editableFiles.join(", ")}`,
      warnings: [],
      linesModified: 0,
    };
  }

  // 2. Parse file into lines
  const lines = fileContent.split("\n");
  const originalLineCount = lines.length;

  // 3. Sort hunks by startLine descending (apply from bottom to top)
  const sortedHunks = [...diff.hunks].sort((a, b) => b.startLine - a.startLine);

  // 4. Validate hunks
  for (const hunk of sortedHunks) {
    // Validate line numbers
    if (hunk.startLine < 1 || hunk.startLine > lines.length + 1) {
      return {
        success: false,
        error: `Invalid startLine ${hunk.startLine} for file with ${lines.length} lines`,
        warnings: [],
        linesModified: 0,
      };
    }

    if (hunk.operation !== "insert" && hunk.endLine > lines.length) {
      return {
        success: false,
        error: `Invalid endLine ${hunk.endLine} for file with ${lines.length} lines`,
        warnings: [],
        linesModified: 0,
      };
    }

    if (hunk.startLine > hunk.endLine && hunk.operation !== "insert") {
      return {
        success: false,
        error: `startLine (${hunk.startLine}) cannot be greater than endLine (${hunk.endLine})`,
        warnings: [],
        linesModified: 0,
      };
    }

    // Verify old content if configured
    if (config.verifyContent !== false && hunk.operation !== "insert") {
      const actualContent = lines.slice(hunk.startLine - 1, hunk.endLine).join("\n");
      const expectedContent = hunk.oldContent;

      if (!contentMatches(actualContent, expectedContent, config.fuzzyMatch)) {
        return {
          success: false,
          error: `Content verification failed at lines ${hunk.startLine}-${hunk.endLine}.\n` +
            `Expected:\n${expectedContent}\n\nActual:\n${actualContent}`,
          warnings: [],
          linesModified: 0,
        };
      }
    }
  }

  // 5. Calculate total lines being replaced
  let totalLinesReplaced = 0;
  for (const hunk of diff.hunks) {
    if (hunk.operation === "replace" || hunk.operation === "delete") {
      totalLinesReplaced += hunk.endLine - hunk.startLine + 1;
    }
  }

  // 6. Check replacement percentage
  const maxPercent = config.maxReplacementPercent ?? 50;
  const replacementPercent = (totalLinesReplaced / originalLineCount) * 100;
  if (replacementPercent > maxPercent) {
    warnings.push(
      `Warning: Replacing ${replacementPercent.toFixed(1)}% of file (${totalLinesReplaced}/${originalLineCount} lines). ` +
      `Consider using update_file for major rewrites.`
    );
  }

  // 7. Apply hunks (from bottom to top to preserve line numbers)
  let linesModified = 0;

  for (const hunk of sortedHunks) {
    switch (hunk.operation) {
      case "replace": {
        const newLines = hunk.newContent.split("\n");
        lines.splice(hunk.startLine - 1, hunk.endLine - hunk.startLine + 1, ...newLines);
        linesModified += Math.max(hunk.endLine - hunk.startLine + 1, newLines.length);
        break;
      }
      case "insert": {
        const newLines = hunk.newContent.split("\n");
        lines.splice(hunk.startLine - 1, 0, ...newLines);
        linesModified += newLines.length;
        break;
      }
      case "delete": {
        lines.splice(hunk.startLine - 1, hunk.endLine - hunk.startLine + 1);
        linesModified += hunk.endLine - hunk.startLine + 1;
        break;
      }
    }
  }

  return {
    success: true,
    newContent: lines.join("\n"),
    warnings,
    linesModified,
  };
}

/**
 * Check if two content strings match
 */
function contentMatches(
  actual: string,
  expected: string,
  fuzzy: boolean = false
): boolean {
  if (!fuzzy) {
    return actual === expected;
  }

  // Fuzzy matching: normalize whitespace and compare
  const normalizeWhitespace = (s: string) =>
    s.split("\n").map((line) => line.trim()).join("\n").trim();

  return normalizeWhitespace(actual) === normalizeWhitespace(expected);
}

/**
 * Create a search-replace style diff (simpler API)
 */
export function createSearchReplaceDiff(
  filePath: string,
  searchContent: string,
  replaceContent: string,
  fileContent: string
): FileDiff | null {
  const lines = fileContent.split("\n");
  const searchLines = searchContent.split("\n");

  // Find the search content in the file
  for (let i = 0; i <= lines.length - searchLines.length; i++) {
    const candidate = lines.slice(i, i + searchLines.length).join("\n");
    if (contentMatches(candidate, searchContent, true)) {
      return {
        filePath,
        hunks: [
          {
            startLine: i + 1,
            endLine: i + searchLines.length,
            operation: "replace",
            oldContent: searchContent,
            newContent: replaceContent,
          },
        ],
      };
    }
  }

  return null;
}

/**
 * Generate a unified diff string for display
 */
export function generateUnifiedDiff(
  filePath: string,
  originalContent: string,
  newContent: string
): string {
  const originalLines = originalContent.split("\n");
  const newLines = newContent.split("\n");

  const diffLines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  // Simple line-by-line diff (not optimal but readable)
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < newLines.length) {
    if (i >= originalLines.length) {
      // Only new lines left
      diffLines.push(`+${newLines[j]}`);
      j++;
    } else if (j >= newLines.length) {
      // Only old lines left
      diffLines.push(`-${originalLines[i]}`);
      i++;
    } else if (originalLines[i] === newLines[j]) {
      // Lines match
      diffLines.push(` ${originalLines[i]}`);
      i++;
      j++;
    } else {
      // Lines differ - simple approach: show removal then addition
      diffLines.push(`-${originalLines[i]}`);
      diffLines.push(`+${newLines[j]}`);
      i++;
      j++;
    }
  }

  return diffLines.join("\n");
}

/**
 * Validate a diff before applying
 */
export function validateDiff(
  diff: FileDiff,
  fileContent: string,
  config: ApplyDiffConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check edit scope
  if (!config.editableFiles.includes(diff.filePath)) {
    errors.push(`File "${diff.filePath}" is not in edit scope`);
  }

  const lines = fileContent.split("\n");

  for (let i = 0; i < diff.hunks.length; i++) {
    const hunk = diff.hunks[i];

    // Check line numbers
    if (hunk.startLine < 1) {
      errors.push(`Hunk ${i + 1}: startLine must be >= 1`);
    }
    if (hunk.operation !== "insert" && hunk.endLine > lines.length) {
      errors.push(`Hunk ${i + 1}: endLine (${hunk.endLine}) exceeds file length (${lines.length})`);
    }
    if (hunk.operation !== "insert" && hunk.startLine > hunk.endLine) {
      errors.push(`Hunk ${i + 1}: startLine cannot exceed endLine`);
    }

    // Check for overlapping hunks
    for (let j = i + 1; j < diff.hunks.length; j++) {
      const other = diff.hunks[j];
      if (hunksOverlap(hunk, other)) {
        errors.push(`Hunks ${i + 1} and ${j + 1} overlap`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if two hunks overlap
 */
function hunksOverlap(a: DiffHunk, b: DiffHunk): boolean {
  if (a.operation === "insert" || b.operation === "insert") {
    return a.startLine === b.startLine;
  }
  return !(a.endLine < b.startLine || b.endLine < a.startLine);
}

/**
 * Merge multiple diffs for the same file
 */
export function mergeDiffs(diffs: FileDiff[]): FileDiff[] {
  const byFile = new Map<string, DiffHunk[]>();

  for (const diff of diffs) {
    const existing = byFile.get(diff.filePath) || [];
    existing.push(...diff.hunks);
    byFile.set(diff.filePath, existing);
  }

  return Array.from(byFile.entries()).map(([filePath, hunks]) => ({
    filePath,
    hunks: hunks.sort((a, b) => a.startLine - b.startLine),
  }));
}
