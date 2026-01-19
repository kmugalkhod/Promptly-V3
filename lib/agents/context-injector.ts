/**
 * Context Injector
 *
 * Builds focused context for the Chat Agent with:
 * 1. Token budgeting - Stay within context limits
 * 2. Edit Scope - Explicitly mark editable vs read-only files
 * 3. Dependency context - Include relevant imports
 */

import type { IntentExtractionResult } from "./intent-extractor";
import type { FileResolutionResult, ResolvedFile } from "./file-resolver";
import { estimateTokens } from "./context-builder";

/**
 * Injected context for the LLM
 */
export interface InjectedContext {
  /** Formatted context string for the system prompt */
  contextString: string;
  /** Files marked as editable */
  editableFiles: string[];
  /** Files marked as read-only */
  readOnlyFiles: string[];
  /** Total estimated tokens used */
  tokenCount: number;
  /** Whether context was truncated due to budget */
  wasTruncated: boolean;
}

/**
 * Configuration for context injection
 */
export interface ContextInjectorConfig {
  /** Maximum tokens for context (default: 8000) */
  maxTokens?: number;
  /** Maximum tokens per file (default: 2000) */
  maxTokensPerFile?: number;
  /** Whether to include dependency context (default: true) */
  includeDependencies?: boolean;
  /** Whether to include edit scope section (default: true) */
  includeEditScope?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ContextInjectorConfig> = {
  maxTokens: 8000,
  maxTokensPerFile: 2000,
  includeDependencies: true,
  includeEditScope: true,
};

/**
 * Context Injector class
 */
export class ContextInjector {
  private config: Required<ContextInjectorConfig>;

  constructor(config: ContextInjectorConfig = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? DEFAULT_CONFIG.maxTokens,
      maxTokensPerFile: config.maxTokensPerFile ?? DEFAULT_CONFIG.maxTokensPerFile,
      includeDependencies: config.includeDependencies ?? DEFAULT_CONFIG.includeDependencies,
      includeEditScope: config.includeEditScope ?? DEFAULT_CONFIG.includeEditScope,
    };
  }

  /**
   * Inject context for the chat agent
   */
  injectContext(
    resolvedFiles: FileResolutionResult,
    files: Map<string, string>,
    intents: IntentExtractionResult
  ): InjectedContext {
    const parts: string[] = [];
    let tokenCount = 0;
    let wasTruncated = false;

    const editableFiles: string[] = [];
    const readOnlyFiles: string[] = [];

    // 1. Add Edit Scope section (CRITICAL for preventing unrelated edits)
    if (this.config.includeEditScope) {
      const editScopeSection = this.buildEditScopeSection(resolvedFiles);
      parts.push(editScopeSection);
      tokenCount += estimateTokens(editScopeSection);

      // Track editable vs read-only
      for (const file of resolvedFiles.files) {
        if (file.editable) {
          editableFiles.push(file.path);
        } else {
          readOnlyFiles.push(file.path);
        }
      }
    }

    // 2. Add Intent Summary section
    const intentSection = this.buildIntentSection(intents);
    parts.push(intentSection);
    tokenCount += estimateTokens(intentSection);

    // 3. Add editable files with full content
    const editableSection = this.buildEditableFilesSection(
      resolvedFiles.files.filter((f) => f.editable),
      files,
      this.config.maxTokens - tokenCount
    );
    parts.push(editableSection.content);
    tokenCount += editableSection.tokens;
    wasTruncated = wasTruncated || editableSection.truncated;

    // 4. Add read-only context files
    const readOnlySection = this.buildReadOnlySection(
      resolvedFiles.files.filter((f) => !f.editable),
      files,
      Math.max(0, this.config.maxTokens - tokenCount - 500) // Reserve 500 tokens for other files section
    );
    parts.push(readOnlySection.content);
    tokenCount += readOnlySection.tokens;
    wasTruncated = wasTruncated || readOnlySection.truncated;

    // 5. Add other files summary (not resolved but available)
    const otherFiles = Array.from(files.keys()).filter(
      (f) => !resolvedFiles.files.some((rf) => rf.path === f)
    );
    if (otherFiles.length > 0) {
      const otherSection = this.buildOtherFilesSection(otherFiles);
      parts.push(otherSection);
      tokenCount += estimateTokens(otherSection);
    }

    return {
      contextString: parts.join("\n\n"),
      editableFiles,
      readOnlyFiles,
      tokenCount,
      wasTruncated,
    };
  }

  /**
   * Build the Edit Scope section
   */
  private buildEditScopeSection(resolvedFiles: FileResolutionResult): string {
    const lines: string[] = [
      "## Edit Scope (CRITICAL)",
      "",
      "**You may ONLY modify files marked [EDITABLE]. Do NOT modify files marked [READ-ONLY].**",
      "",
    ];

    const editableFiles = resolvedFiles.files.filter((f) => f.editable);
    const readOnlyFiles = resolvedFiles.files.filter((f) => !f.editable);

    if (editableFiles.length > 0) {
      lines.push("### Editable Files:");
      for (const file of editableFiles) {
        lines.push(`- ${file.path} [EDITABLE] - ${file.reason}`);
      }
      lines.push("");
    }

    if (readOnlyFiles.length > 0) {
      lines.push("### Read-Only Context (do NOT modify):");
      for (const file of readOnlyFiles) {
        lines.push(`- ${file.path} [READ-ONLY] - ${file.reason}`);
      }
      lines.push("");
    }

    lines.push("**WARNING:** Any attempt to modify files not marked [EDITABLE] will be rejected.");

    return lines.join("\n");
  }

  /**
   * Build the Intent Summary section
   */
  private buildIntentSection(intents: IntentExtractionResult): string {
    const lines: string[] = [
      "## Request Analysis",
      "",
    ];

    // Intents
    if (intents.intents.length > 0) {
      lines.push("### Detected Intents:");
      for (const intent of intents.intents) {
        const confidence = Math.round(intent.confidence * 100);
        lines.push(`- **${intent.type}** (${confidence}% confidence): ${intent.details}`);
      }
      lines.push("");
    }

    // Targets
    if (intents.targets.length > 0) {
      lines.push("### Target Elements:");
      for (const target of intents.targets) {
        lines.push(`- ${target.type}: "${target.name}"`);
      }
      lines.push("");
    }

    // Changes
    if (intents.changes.length > 0) {
      lines.push("### Requested Changes:");
      for (const change of intents.changes) {
        lines.push(`- ${change.action} ${change.target}: ${change.description}`);
      }
      lines.push("");
    }

    // Complexity
    lines.push(`**Complexity:** ${intents.complexity}`);
    if (intents.requiresArchitecture) {
      lines.push("**Note:** This request may require architectural changes. Consider recommending the Architecture Agent.");
    }

    return lines.join("\n");
  }

  /**
   * Build the Editable Files section with full content
   */
  private buildEditableFilesSection(
    editableFiles: ResolvedFile[],
    files: Map<string, string>,
    maxTokens: number
  ): { content: string; tokens: number; truncated: boolean } {
    const lines: string[] = [
      "## Editable Files (full content)",
      "",
      "Use these files directly - no need to read them again.",
      "",
    ];

    let tokensUsed = estimateTokens(lines.join("\n"));
    let truncated = false;

    for (const file of editableFiles) {
      const content = files.get(file.path);
      if (!content) continue;

      const fileTokens = estimateTokens(content);
      const fileHeader = `### ${file.path}\n\`\`\`\n`;
      const fileFooter = `\n\`\`\`\n`;
      const headerTokens = estimateTokens(fileHeader + fileFooter);

      // Check if we can fit this file
      if (tokensUsed + fileTokens + headerTokens > maxTokens) {
        // Try to fit truncated version
        const availableTokens = maxTokens - tokensUsed - headerTokens - 50;
        if (availableTokens > 200) {
          const truncatedContent = this.truncateContent(content, availableTokens);
          lines.push(fileHeader);
          lines.push(truncatedContent);
          lines.push(`\n// ... truncated (${fileTokens} tokens total)`);
          lines.push(fileFooter);
          tokensUsed += estimateTokens(truncatedContent) + headerTokens + 50;
          truncated = true;
        }
        continue;
      }

      lines.push(fileHeader);
      lines.push(content);
      lines.push(fileFooter);
      tokensUsed += fileTokens + headerTokens;
    }

    return {
      content: lines.join(""),
      tokens: tokensUsed,
      truncated,
    };
  }

  /**
   * Build the Read-Only section
   */
  private buildReadOnlySection(
    readOnlyFiles: ResolvedFile[],
    files: Map<string, string>,
    maxTokens: number
  ): { content: string; tokens: number; truncated: boolean } {
    if (readOnlyFiles.length === 0) {
      return { content: "", tokens: 0, truncated: false };
    }

    const lines: string[] = [
      "## Read-Only Context",
      "",
      "Reference these files for context but do NOT modify them.",
      "",
    ];

    let tokensUsed = estimateTokens(lines.join("\n"));
    let truncated = false;

    // Sort by score and include as many as we can
    const sortedFiles = [...readOnlyFiles].sort((a, b) => b.score - a.score);

    for (const file of sortedFiles) {
      const content = files.get(file.path);
      if (!content) continue;

      const fileTokens = estimateTokens(content);
      const fileHeader = `### ${file.path} [READ-ONLY]\n\`\`\`\n`;
      const fileFooter = `\n\`\`\`\n`;
      const headerTokens = estimateTokens(fileHeader + fileFooter);

      // Check token budget
      if (tokensUsed + fileTokens + headerTokens > maxTokens) {
        // Try summary instead
        const summary = this.createFileSummary(file.path, content);
        const summaryTokens = estimateTokens(summary);

        if (tokensUsed + summaryTokens < maxTokens) {
          lines.push(summary);
          tokensUsed += summaryTokens;
        }
        truncated = true;
        continue;
      }

      lines.push(fileHeader);
      lines.push(content);
      lines.push(fileFooter);
      tokensUsed += fileTokens + headerTokens;
    }

    return {
      content: lines.join(""),
      tokens: tokensUsed,
      truncated,
    };
  }

  /**
   * Build the Other Files section (summary only)
   */
  private buildOtherFilesSection(otherFiles: string[]): string {
    const lines: string[] = [
      "## Other Available Files",
      "",
      "Use `read_file` to access these if needed:",
      "",
    ];

    // Group by directory
    const byDir: Map<string, string[]> = new Map();
    for (const file of otherFiles) {
      const dir = file.split("/").slice(0, -1).join("/") || ".";
      if (!byDir.has(dir)) {
        byDir.set(dir, []);
      }
      byDir.get(dir)!.push(file.split("/").pop()!);
    }

    for (const [dir, fileNames] of byDir.entries()) {
      if (fileNames.length <= 3) {
        for (const name of fileNames) {
          lines.push(`- ${dir}/${name}`);
        }
      } else {
        lines.push(`- ${dir}/ (${fileNames.length} files: ${fileNames.slice(0, 3).join(", ")}...)`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Truncate content to fit within token budget
   */
  private truncateContent(content: string, maxTokens: number): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let tokens = 0;

    for (const line of lines) {
      const lineTokens = estimateTokens(line);
      if (tokens + lineTokens > maxTokens) {
        break;
      }
      result.push(line);
      tokens += lineTokens;
    }

    return result.join("\n");
  }

  /**
   * Create a summary for a file
   */
  private createFileSummary(filePath: string, content: string): string {
    const lines = content.split("\n");
    const lineCount = lines.length;

    // Extract exports
    const exports: string[] = [];
    for (const line of lines) {
      const exportMatch = line.match(/^export\s+(?:default\s+)?(?:const|function|class|interface|type)\s+(\w+)/);
      if (exportMatch) {
        exports.push(exportMatch[1]);
      }
    }

    const exportStr = exports.length > 0 ? ` - exports: ${exports.slice(0, 5).join(", ")}` : "";
    return `- **${filePath}** (${lineCount} lines)${exportStr}`;
  }
}

/**
 * Convenience function to inject context
 */
export function injectContext(
  resolvedFiles: FileResolutionResult,
  files: Map<string, string>,
  intents: IntentExtractionResult,
  config?: ContextInjectorConfig
): InjectedContext {
  const injector = new ContextInjector(config);
  return injector.injectContext(resolvedFiles, files, intents);
}
