/**
 * Smart Context Builder
 *
 * Builds optimized context for the Chat Agent by scoring files by relevance
 * to the user's query. This reduces tool calls by ~75% by pre-loading
 * the most relevant files.
 *
 * Ported from: reference-code/backend-v2/services/context_builder.py
 */

import type {
  SmartContext,
  SmartContextConfig,
  FileContent,
  FileSummary,
} from "./types";

/**
 * Request complexity levels (local definition to avoid circular dependency)
 * @deprecated Legacy complexity enum — kept for backward compatibility
 */
export enum RequestComplexity {
  SIMPLE = "simple",
  MODERATE = "moderate",
  COMPLEX = "complex",
  ARCHITECTURAL = "architectural",
}

/**
 * Dynamic context configuration based on request complexity
 */
export interface DynamicContextConfig extends SmartContextConfig {
  /** Maximum number of files to include */
  maxFiles: number;
  /** Recursion limit for agent */
  recursionLimit: number;
}

/**
 * Get context configuration based on request complexity
 */
export function getContextConfigForComplexity(
  complexity: RequestComplexity
): DynamicContextConfig {
  switch (complexity) {
    case RequestComplexity.SIMPLE:
      return {
        maxTokens: 3000,
        maxFullFiles: 3,
        minScoreThreshold: 0.15,
        maxFiles: 3,
        recursionLimit: 30,
      };
    case RequestComplexity.MODERATE:
      return {
        maxTokens: 5000,
        maxFullFiles: 6,
        minScoreThreshold: 0.1,
        maxFiles: 6,
        recursionLimit: 50,
      };
    case RequestComplexity.COMPLEX:
      return {
        maxTokens: 8000,
        maxFullFiles: 10,
        minScoreThreshold: 0.08,
        maxFiles: 10,
        recursionLimit: 150,
      };
    case RequestComplexity.ARCHITECTURAL:
      return {
        maxTokens: 10000,
        maxFullFiles: 15,
        minScoreThreshold: 0.05,
        maxFiles: 15,
        recursionLimit: 200,
      };
    default:
      return {
        maxTokens: 4000,
        maxFullFiles: 5,
        minScoreThreshold: 0.1,
        maxFiles: 5,
        recursionLimit: 50,
      };
  }
}

// Configuration constants
const DEFAULT_MAX_CONTEXT_TOKENS = 4000;
const DEFAULT_MAX_FULL_FILES = 5;
const DEFAULT_MIN_SCORE_THRESHOLD = 0.1;

// File type priorities (higher = more likely to be relevant)
const FILE_TYPE_PRIORITIES: Record<string, number> = {
  ".tsx": 1.0, // React components - most user-facing
  ".ts": 0.8, // TypeScript utilities, hooks, types
  ".css": 0.6, // Stylesheets
  ".scss": 0.6, // SCSS stylesheets
};
const DEFAULT_FILE_PRIORITY = 0.4;

// Stop words to filter from queries (excluding action verbs)
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "is",
  "it",
  "in",
  "on",
  "for",
  "of",
  "and",
  "or",
  "but",
  "with",
  "this",
  "that",
  "be",
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "i",
  "you",
  "we",
  "they",
  "please",
  "want",
  "need",
  "like",
]);

// Critical action verbs that should NEVER be filtered
const ACTION_VERBS = new Set([
  "add",
  "fix",
  "change",
  "make",
  "update",
  "remove",
  "delete",
  "create",
  "modify",
  "edit",
  "replace",
  "move",
  "rename",
  "copy",
  "insert",
  "append",
  "prepend",
  "hide",
  "show",
  "enable",
  "disable",
  "implement",
  "refactor",
  "optimize",
  "improve",
]);

// Route-related keywords for page file bonus
const ROUTE_KEYWORDS = new Set([
  "page",
  "route",
  "navigate",
  "navigation",
  "home",
  "homepage",
  "/",
]);

// Semantic groups for concept-based matching
const SEMANTIC_GROUPS: Record<string, string[]> = {
  navigation: ["nav", "navbar", "header", "menu", "sidebar", "navigation", "link", "links"],
  styling: ["style", "css", "color", "theme", "design", "appearance", "look", "visual"],
  button: ["button", "btn", "click", "action", "cta", "submit"],
  form: ["form", "input", "field", "submit", "validation", "text", "textarea"],
  layout: ["layout", "grid", "flex", "container", "wrapper", "section", "spacing"],
  card: ["card", "tile", "box", "panel", "widget"],
  modal: ["modal", "dialog", "popup", "overlay", "drawer"],
  list: ["list", "table", "grid", "items", "collection", "array"],
  auth: ["auth", "login", "signup", "register", "password", "user", "account"],
  data: ["data", "api", "fetch", "load", "state", "store", "context"],
  error: ["error", "warning", "alert", "notification", "toast", "message"],
  image: ["image", "img", "photo", "picture", "icon", "logo", "avatar"],
  text: ["text", "heading", "title", "paragraph", "label", "copy", "content"],
  animation: ["animation", "transition", "motion", "hover", "animate", "effect"],
};

/**
 * Relevance Scorer
 *
 * Scores files by relevance to a user query using multiple signals.
 */
export class RelevanceScorer {
  private recentFiles: string[];

  constructor(recentFiles: string[] = []) {
    this.recentFiles = recentFiles;
  }

  /**
   * Score a file's relevance to a query.
   *
   * @param filePath - Path to the file
   * @param fileContent - Content of the file
   * @param query - User's query string
   * @returns Float score between 0.0 and 1.0
   */
  scoreFile(filePath: string, fileContent: string, query: string): number {
    const keywords = this.extractKeywords(query);

    // Calculate individual scores
    const keywordScore = this.calculateKeywordScore(fileContent, keywords);
    const fileTypeScore = this.getFileTypePriority(filePath);
    const componentScore = this.calculateComponentMatch(filePath, query);
    const routeScore = this.calculateRouteBonus(filePath, query);
    const recencyScore = this.calculateRecencyBonus(filePath);
    const semanticScore = this.calculateSemanticBonus(filePath, fileContent, keywords);

    // Weighted combination (adjusted to include semantic matching)
    const finalScore =
      keywordScore * 0.35 + // 35% weight on keyword matches (reduced from 40%)
      fileTypeScore * 0.2 + // 20% weight on file type (reduced from 25%)
      componentScore * 0.2 + // 20% weight on component name match
      routeScore * 0.1 + // 10% weight on page file bonus
      recencyScore * 0.05 + // 5% weight on recency
      semanticScore * 0.1; // 10% weight on semantic matching (NEW)

    // Clamp to 0.0-1.0 range
    return Math.max(0.0, Math.min(1.0, finalScore));
  }

  /**
   * Extract meaningful keywords from a query.
   * Preserves action verbs even if they appear in stop words.
   */
  private extractKeywords(query: string): string[] {
    // Lowercase and split on whitespace/punctuation
    const words = query.toLowerCase().split(/[\s\-_.,;:!?()+]+/);

    // Filter: remove stop words and short words, but ALWAYS keep action verbs
    return words.filter(
      (word) =>
        word.length >= 3 && (ACTION_VERBS.has(word) || !STOP_WORDS.has(word))
    );
  }

  /**
   * Calculate score based on keyword matches in content.
   */
  private calculateKeywordScore(
    content: string,
    keywords: string[]
  ): number {
    if (keywords.length === 0) {
      return 0.0;
    }

    const contentLower = content.toLowerCase();
    const matches = keywords.filter((kw) => contentLower.includes(kw)).length;

    // Return ratio of matched keywords (capped at 1.0)
    return Math.min(1.0, matches / keywords.length);
  }

  /**
   * Get priority score based on file extension.
   */
  private getFileTypePriority(filePath: string): number {
    const extMatch = filePath.match(/\.[a-zA-Z]+$/);
    if (!extMatch) {
      return DEFAULT_FILE_PRIORITY;
    }

    const ext = extMatch[0].toLowerCase();
    return FILE_TYPE_PRIORITIES[ext] ?? DEFAULT_FILE_PRIORITY;
  }

  /**
   * Calculate bonus for component name matching query.
   */
  private calculateComponentMatch(filePath: string, query: string): number {
    // Extract component name from file path
    const filename = filePath.split("/").pop() || "";
    const componentName = filename.replace(/\.[a-zA-Z]+$/, "").toLowerCase();

    // Check if component name appears in query
    if (
      componentName &&
      componentName.length >= 3 &&
      query.toLowerCase().includes(componentName)
    ) {
      return 0.3;
    }

    return 0.0;
  }

  /**
   * Calculate bonus for page files when query is route-related.
   */
  private calculateRouteBonus(filePath: string, query: string): number {
    const queryLower = query.toLowerCase();
    const isRouteQuery = Array.from(ROUTE_KEYWORDS).some((kw) =>
      queryLower.includes(kw)
    );

    if (!isRouteQuery) {
      return 0.0;
    }

    // Check if file is a page file
    const filename = (filePath.split("/").pop() || "").toLowerCase();
    const isPageFile = ["page.tsx", "layout.tsx", "page.ts", "layout.ts"].includes(
      filename
    );

    return isPageFile ? 0.2 : 0.0;
  }

  /**
   * Calculate bonus based on how recently the file was modified.
   */
  private calculateRecencyBonus(filePath: string): number {
    if (
      this.recentFiles.length === 0 ||
      !this.recentFiles.includes(filePath)
    ) {
      return 0.0;
    }

    const position = this.recentFiles.indexOf(filePath);
    const maxBonus = 0.15;
    const decayFactor = 0.7;

    return maxBonus * Math.pow(decayFactor, position);
  }

  /**
   * Calculate semantic similarity bonus based on concept groups.
   * Boosts files that match semantic concepts in the query.
   */
  private calculateSemanticBonus(
    filePath: string,
    fileContent: string,
    keywords: string[]
  ): number {
    const pathLower = filePath.toLowerCase();
    const contentLower = fileContent.toLowerCase();
    let totalBonus = 0;

    // Check each semantic group
    for (const [, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
      // Check if any keyword matches this semantic group
      const keywordMatches = keywords.some((kw) =>
        synonyms.some((syn) => kw.includes(syn) || syn.includes(kw))
      );

      if (!keywordMatches) {
        continue;
      }

      // Check if file path or content contains related concepts
      const fileMatches = synonyms.some(
        (syn) => pathLower.includes(syn) || contentLower.includes(syn)
      );

      if (fileMatches) {
        totalBonus += 0.15;
      }
    }

    // Cap the bonus at 0.3 (matching ~2 semantic groups)
    return Math.min(0.3, totalBonus);
  }
}

/**
 * Estimate the number of tokens in a text string.
 * Uses a simple approximation of ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a file including formatting overhead.
 */
function estimateFileTokens(filePath: string, content: string): number {
  const formatted = `### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
  return estimateTokens(formatted);
}

/**
 * Detect the purpose of a file based on its path.
 */
export function detectFilePurpose(filePath: string): string {
  const pathLower = filePath.toLowerCase();
  const filename = (filePath.split("/").pop() || "").toLowerCase();

  // Page/Layout files
  if (["page.tsx", "page.ts"].includes(filename)) {
    return "Page component";
  }
  if (["layout.tsx", "layout.ts"].includes(filename)) {
    return "Layout component";
  }

  // By directory
  if (pathLower.includes("/components/") || pathLower.startsWith("components/")) {
    return "React component";
  }
  if (pathLower.includes("/hooks/") || pathLower.startsWith("hooks/")) {
    return "React hook";
  }
  if (pathLower.includes("/lib/") || pathLower.startsWith("lib/")) {
    return "Utility library";
  }
  if (pathLower.includes("/utils/") || pathLower.startsWith("utils/")) {
    return "Utility functions";
  }
  if (pathLower.includes("/types/") || pathLower.startsWith("types/")) {
    return "Type definitions";
  }
  if (pathLower.includes("/styles/") || pathLower.startsWith("styles/")) {
    return "Stylesheet";
  }
  if (pathLower.includes("/api/") || pathLower.startsWith("api/")) {
    return "API route";
  }

  // By extension
  if (filename.endsWith(".css") || filename.endsWith(".scss")) {
    return "Stylesheet";
  }
  if (filename.endsWith(".tsx")) {
    return "React component";
  }
  if (filename.endsWith(".ts")) {
    return "TypeScript module";
  }
  if (filename.endsWith(".json")) {
    return "Configuration";
  }
  if (filename.endsWith(".md")) {
    return "Documentation";
  }

  return "Source file";
}

/**
 * Context Builder
 *
 * Builds optimized context from scored files for the Chat Agent.
 */
export class ContextBuilder {
  private scorer: RelevanceScorer;
  private maxTokens: number;
  private maxFullFiles: number;
  private minScoreThreshold: number;

  constructor(config: SmartContextConfig = {}) {
    this.scorer = new RelevanceScorer();
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;
    this.maxFullFiles = config.maxFullFiles ?? DEFAULT_MAX_FULL_FILES;
    this.minScoreThreshold =
      config.minScoreThreshold ?? DEFAULT_MIN_SCORE_THRESHOLD;
  }

  /**
   * Set recent files for recency scoring.
   */
  setRecentFiles(recentFiles: string[]): void {
    this.scorer = new RelevanceScorer(recentFiles);
  }

  /**
   * Build optimized context from project files.
   *
   * @param generatedFiles - Dict mapping file paths to content
   * @param query - User's query string
   * @returns SmartContext with full files and summaries
   */
  buildContext(
    generatedFiles: Map<string, string>,
    query: string
  ): SmartContext {
    if (generatedFiles.size === 0) {
      return {
        fullFiles: [],
        summaries: [],
        tokenCount: 0,
      };
    }

    // 1. Score all files
    const scoredFiles: Array<[string, string, number]> = [];
    for (const [path, content] of generatedFiles.entries()) {
      const score = this.scorer.scoreFile(path, content, query);
      scoredFiles.push([path, content, score]);
    }

    // 2. Sort by score descending
    scoredFiles.sort((a, b) => b[2] - a[2]);

    // 3. Build context within budget
    const fullFiles: FileContent[] = [];
    const summaries: FileSummary[] = [];
    let tokenCount = 0;

    for (const [path, content, score] of scoredFiles) {
      // Skip files below threshold
      if (score < this.minScoreThreshold) {
        continue;
      }

      const fileTokens = estimateFileTokens(path, content);

      // Check if we can include full content
      if (
        tokenCount + fileTokens <= this.maxTokens &&
        fullFiles.length < this.maxFullFiles
      ) {
        fullFiles.push({
          path,
          content,
          score,
        });
        tokenCount += fileTokens;
      } else {
        // Add as summary
        summaries.push({
          path,
          lineCount: content.split("\n").length,
          purpose: detectFilePurpose(path),
          score,
        });
      }
    }

    return {
      fullFiles,
      summaries,
      tokenCount,
    };
  }

  /**
   * Format smart context as a string for the Chat Agent prompt.
   */
  formatContext(context: SmartContext): string {
    const parts: string[] = [];

    // Full files section
    if (context.fullFiles.length > 0) {
      parts.push("## Pre-loaded Files (use directly, no need to read_file)\n");
      for (const file of context.fullFiles) {
        parts.push(`### ${file.path}`);
        parts.push("```");
        parts.push(file.content);
        parts.push("```\n");
      }
    }

    // Summaries section
    if (context.summaries.length > 0) {
      parts.push("## Other Files (use read_file if needed)\n");
      for (const summary of context.summaries) {
        parts.push(
          `- **${summary.path}** (${summary.lineCount} lines) - ${summary.purpose}`
        );
      }
      parts.push("");
    }

    return parts.join("\n");
  }
}
