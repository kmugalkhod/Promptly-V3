/**
 * File Resolver
 *
 * Multi-signal file resolution that combines multiple signals to determine
 * which files are most relevant to a user request:
 *
 * 1. Name matching (25%) - Match target names to file names
 * 2. Import tracing (25%) - Parse imports to find dependencies
 * 3. Semantic embeddings (20%) - Vector similarity via Convex
 * 4. Keyword matching (15%) - Existing semantic groups
 * 5. Component graph (10%) - Trace usage relationships
 * 6. Recency (5%) - Recently modified files
 */

import type { IntentExtractionResult, ExtractedTarget } from "./intent-extractor";
import {
  parseImports,
  buildDependencyGraph,
  getImporters,
  getTransitiveDependencies,
  type ImportParseResult,
} from "./utils/import-parser";

/**
 * Resolved file with confidence score
 */
export interface ResolvedFile {
  /** File path relative to project root */
  path: string;
  /** Combined confidence score (0.0-1.0) */
  score: number;
  /** Individual signal scores for debugging */
  signals: {
    nameMatch: number;
    importTrace: number;
    embedding: number;
    keyword: number;
    componentGraph: number;
    recency: number;
  };
  /** Why this file was selected */
  reason: string;
  /** Whether this file should be editable */
  editable: boolean;
}

/**
 * Result of file resolution
 */
export interface FileResolutionResult {
  /** Files to include in context, sorted by score */
  files: ResolvedFile[];
  /** Dependency graph for the resolved files */
  dependencyGraph: Map<string, string[]>;
  /** Files that are read-only context (not editable) */
  readOnlyFiles: string[];
  /** Total number of files considered */
  totalFilesConsidered: number;
}

/**
 * Configuration for file resolution
 */
export interface FileResolverConfig {
  /** Maximum number of files to return */
  maxFiles?: number;
  /** Minimum score threshold to include a file */
  minScore?: number;
  /** Signal weights */
  weights?: {
    nameMatch?: number;
    importTrace?: number;
    embedding?: number;
    keyword?: number;
    componentGraph?: number;
    recency?: number;
  };
}

/**
 * Internal resolved configuration with all required fields
 */
interface ResolvedConfig {
  maxFiles: number;
  minScore: number;
  weights: {
    nameMatch: number;
    importTrace: number;
    embedding: number;
    keyword: number;
    componentGraph: number;
    recency: number;
  };
}

/**
 * Semantic groups for keyword matching
 */
const SEMANTIC_GROUPS: Record<string, string[]> = {
  navigation: ["nav", "navbar", "header", "menu", "sidebar", "navigation", "link", "links"],
  styling: ["style", "css", "color", "theme", "design", "appearance", "look", "visual", "tailwind"],
  button: ["button", "btn", "click", "action", "cta", "submit"],
  form: ["form", "input", "field", "submit", "validation", "text", "textarea", "select"],
  layout: ["layout", "grid", "flex", "container", "wrapper", "section", "spacing", "responsive"],
  card: ["card", "tile", "box", "panel", "widget", "item"],
  modal: ["modal", "dialog", "popup", "overlay", "drawer", "sheet"],
  list: ["list", "table", "grid", "items", "collection", "array", "data"],
  auth: ["auth", "login", "signup", "register", "password", "user", "account", "session"],
  data: ["data", "api", "fetch", "load", "state", "store", "context", "hook", "query"],
  error: ["error", "warning", "alert", "notification", "toast", "message", "status"],
  image: ["image", "img", "photo", "picture", "icon", "logo", "avatar", "media"],
  text: ["text", "heading", "title", "paragraph", "label", "copy", "content", "typography"],
  animation: ["animation", "transition", "motion", "hover", "animate", "effect", "framer"],
  footer: ["footer", "bottom", "copyright"],
  hero: ["hero", "banner", "showcase", "intro", "landing"],
  task: ["task", "todo", "item", "checklist", "list"],
  // React-specific patterns
  component: ["component", "client", "server", "hydration", "hydrate", "render", "props", "children"],
  hooks: ["hook", "usestate", "useeffect", "useref", "usememo", "usecallback", "usecontext"],
  page: ["page", "route", "app", "layout", "home", "index"],
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  maxFiles: 10,
  minScore: 0.0, // No minimum - always include files, sorted by relevance
  weights: {
    nameMatch: 0.25,
    importTrace: 0.25,
    embedding: 0.20,
    keyword: 0.15,
    componentGraph: 0.10,
    recency: 0.05,
  },
};

/**
 * File Resolver class
 */
export class FileResolver {
  private config: ResolvedConfig;
  private dependencyGraph: Map<string, ImportParseResult> = new Map();

  constructor(config: FileResolverConfig = {}) {
    this.config = {
      maxFiles: config.maxFiles ?? DEFAULT_CONFIG.maxFiles,
      minScore: config.minScore ?? DEFAULT_CONFIG.minScore,
      weights: {
        nameMatch: config.weights?.nameMatch ?? DEFAULT_CONFIG.weights.nameMatch,
        importTrace: config.weights?.importTrace ?? DEFAULT_CONFIG.weights.importTrace,
        embedding: config.weights?.embedding ?? DEFAULT_CONFIG.weights.embedding,
        keyword: config.weights?.keyword ?? DEFAULT_CONFIG.weights.keyword,
        componentGraph: config.weights?.componentGraph ?? DEFAULT_CONFIG.weights.componentGraph,
        recency: config.weights?.recency ?? DEFAULT_CONFIG.weights.recency,
      },
    };
  }

  /**
   * Resolve files relevant to the user's request
   */
  async resolveFiles(
    intents: IntentExtractionResult,
    files: Map<string, string>,
    options: {
      recentFiles?: string[];
      embeddingScores?: Map<string, number>;
    } = {}
  ): Promise<FileResolutionResult> {
    const { recentFiles = [], embeddingScores = new Map() } = options;

    // Build dependency graph
    this.dependencyGraph = buildDependencyGraph(files);

    // Score all files
    const scoredFiles: ResolvedFile[] = [];

    for (const [filePath, content] of files.entries()) {
      // Skip non-code files
      if (!this.isCodeFile(filePath)) {
        continue;
      }

      const signals = {
        nameMatch: this.calculateNameMatchScore(filePath, intents),
        importTrace: this.calculateImportTraceScore(filePath, intents, files),
        embedding: embeddingScores.get(filePath) ?? 0,
        keyword: this.calculateKeywordScore(filePath, content, intents),
        componentGraph: this.calculateComponentGraphScore(filePath, intents),
        recency: this.calculateRecencyScore(filePath, recentFiles),
      };

      // Calculate weighted score
      const score =
        signals.nameMatch * this.config.weights.nameMatch +
        signals.importTrace * this.config.weights.importTrace +
        signals.embedding * this.config.weights.embedding +
        signals.keyword * this.config.weights.keyword +
        signals.componentGraph * this.config.weights.componentGraph +
        signals.recency * this.config.weights.recency;

      // Determine reason for selection
      const reason = this.determineReason(signals, filePath, intents);

      // Determine if file should be editable
      const editable = this.shouldBeEditable(filePath, intents, signals);

      scoredFiles.push({
        path: filePath,
        score: Math.min(1.0, Math.max(0, score)),
        signals,
        reason,
        editable,
      });
    }

    // Sort by score descending
    scoredFiles.sort((a, b) => b.score - a.score);

    // Take top files up to maxFiles limit
    // With minScore=0, we always get files if they exist
    let filteredFiles = scoredFiles
      .filter((f) => f.score >= this.config.minScore)
      .slice(0, this.config.maxFiles);

    // ALWAYS ensure we return files if any exist - this guarantees the agent can work
    if (filteredFiles.length === 0 && scoredFiles.length > 0) {
      console.log("[file-resolver] No files above threshold, including all available files");

      // Prioritize .tsx files (components and pages) - mark all as editable
      const tsxFiles = scoredFiles.filter((f) => f.path.endsWith(".tsx"));

      if (tsxFiles.length > 0) {
        filteredFiles = tsxFiles
          .map((f) => ({ ...f, editable: true, reason: f.reason || "Component file" }))
          .slice(0, this.config.maxFiles);
      } else {
        // No .tsx files, include any code files
        filteredFiles = scoredFiles
          .slice(0, this.config.maxFiles)
          .map((f) => ({ ...f, editable: true, reason: f.reason || "Code file" }));
      }
    }

    // Ensure at least some files are editable if we have any files
    const editableCount = filteredFiles.filter((f) => f.editable).length;
    if (editableCount === 0 && filteredFiles.length > 0) {
      // Mark all .tsx files as editable, or all files if no .tsx
      filteredFiles = filteredFiles.map((f) => ({
        ...f,
        editable: f.path.endsWith(".tsx") || !filteredFiles.some((x) => x.path.endsWith(".tsx")),
      }));
    }

    // Build dependency graph for resolved files
    const dependencyGraphMap = new Map<string, string[]>();
    for (const file of filteredFiles) {
      const parseResult = this.dependencyGraph.get(file.path);
      if (parseResult) {
        dependencyGraphMap.set(file.path, parseResult.localDependencies);
      }
    }

    // Identify read-only files (high score but not editable)
    const readOnlyFiles = filteredFiles
      .filter((f) => !f.editable)
      .map((f) => f.path);

    return {
      files: filteredFiles,
      dependencyGraph: dependencyGraphMap,
      readOnlyFiles,
      totalFilesConsidered: scoredFiles.length,
    };
  }

  /**
   * Calculate name matching score with improved fuzzy matching
   */
  private calculateNameMatchScore(
    filePath: string,
    intents: IntentExtractionResult
  ): number {
    const fileName = filePath.split("/").pop()?.toLowerCase() || "";
    const fileNameNoExt = fileName.replace(/\.[^.]+$/, "");
    const filePathLower = filePath.toLowerCase();
    let maxScore = 0;

    // Check against targets
    for (const target of intents.targets) {
      const targetName = target.name.toLowerCase();
      const targetWords = targetName.split(/(?=[A-Z])|[-_\s]+/).filter(w => w.length > 0);

      // Exact match (case insensitive)
      if (fileNameNoExt === targetName) {
        maxScore = Math.max(maxScore, 1.0 * target.confidence);
        continue;
      }

      // Case-insensitive contains match
      if (fileNameNoExt.includes(targetName) || targetName.includes(fileNameNoExt)) {
        maxScore = Math.max(maxScore, 0.8 * target.confidence);
        continue;
      }

      // Path contains match (e.g., "components/Button" matches "Button")
      if (filePathLower.includes(targetName)) {
        maxScore = Math.max(maxScore, 0.75 * target.confidence);
        continue;
      }

      // Partial word match (e.g., "Button" matches "SubmitButton", "button" matches "AddButton")
      const fileWords = fileNameNoExt.split(/(?=[A-Z])|[-_]/).filter(w => w.length > 0);
      const wordMatchCount = targetWords.filter(tw =>
        fileWords.some(fw => fw.toLowerCase() === tw || fw.toLowerCase().includes(tw) || tw.includes(fw.toLowerCase()))
      ).length;

      if (wordMatchCount > 0) {
        const matchRatio = wordMatchCount / Math.max(targetWords.length, 1);
        maxScore = Math.max(maxScore, 0.6 * matchRatio * target.confidence);
      }

      // Similarity based on common substrings (for typos or variations)
      const similarity = this.calculateStringSimilarity(fileNameNoExt, targetName);
      if (similarity > 0.5) {
        maxScore = Math.max(maxScore, similarity * 0.5 * target.confidence);
      }
    }

    // Check against keywords with improved matching
    for (const keyword of intents.keywords) {
      const keywordLower = keyword.toLowerCase();

      // File name contains keyword
      if (fileNameNoExt.includes(keywordLower)) {
        maxScore = Math.max(maxScore, 0.5);
      }

      // Path contains keyword
      if (filePathLower.includes(keywordLower)) {
        maxScore = Math.max(maxScore, 0.35);
      }
    }

    return maxScore;
  }

  /**
   * Calculate string similarity using Levenshtein-like approach
   */
  private calculateStringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    // Check if shorter is a substring
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    // Simple common substring ratio
    let commonLength = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter.substring(0, i + 1))) {
        commonLength = i + 1;
      }
    }

    return commonLength / longer.length;
  }

  /**
   * Calculate import tracing score
   */
  private calculateImportTraceScore(
    filePath: string,
    intents: IntentExtractionResult,
    files: Map<string, string>
  ): number {
    const parseResult = this.dependencyGraph.get(filePath);
    if (!parseResult) {
      return 0;
    }

    let score = 0;

    // Check if this file imports any target components
    for (const target of intents.targets) {
      // Check if any import matches the target name
      for (const imp of parseResult.imports) {
        if (imp.namedImports.some((n) =>
          n.toLowerCase().includes(target.name.toLowerCase())
        )) {
          score = Math.max(score, 0.6 * target.confidence);
        }
        if (imp.defaultImport?.toLowerCase().includes(target.name.toLowerCase())) {
          score = Math.max(score, 0.7 * target.confidence);
        }
      }

      // Check if this file exports the target
      for (const exp of parseResult.exports) {
        if (exp.name.toLowerCase().includes(target.name.toLowerCase())) {
          score = Math.max(score, 0.9 * target.confidence);
        }
      }
    }

    // Check reverse dependencies (files that import this file)
    const importers = getImporters(filePath, this.dependencyGraph);
    if (importers.length > 0) {
      // Files with many importers are more central
      score = Math.max(score, Math.min(0.4, importers.length * 0.1));
    }

    return score;
  }

  /**
   * Calculate keyword matching score using semantic groups
   */
  private calculateKeywordScore(
    filePath: string,
    content: string,
    intents: IntentExtractionResult
  ): number {
    const filePathLower = filePath.toLowerCase();
    const contentLower = content.toLowerCase();
    let totalScore = 0;
    let matchCount = 0;

    // Check each semantic group
    for (const [, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
      // Check if any keyword matches this semantic group
      const keywordMatches = intents.keywords.some((kw) =>
        synonyms.some((syn) =>
          kw.toLowerCase().includes(syn) || syn.includes(kw.toLowerCase())
        )
      );

      if (!keywordMatches) {
        continue;
      }

      // Check if file path or content contains related concepts
      const pathMatch = synonyms.some((syn) => filePathLower.includes(syn));
      const contentMatch = synonyms.some((syn) => contentLower.includes(syn));

      if (pathMatch) {
        totalScore += 0.4;
        matchCount++;
      }
      if (contentMatch) {
        totalScore += 0.2;
        matchCount++;
      }
    }

    // Direct keyword match in content
    for (const keyword of intents.keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        totalScore += 0.1;
        matchCount++;
      }
    }

    // Normalize score
    return matchCount > 0 ? Math.min(1.0, totalScore / Math.sqrt(matchCount)) : 0;
  }

  /**
   * Calculate component graph score
   */
  private calculateComponentGraphScore(
    filePath: string,
    intents: IntentExtractionResult
  ): number {
    // Get transitive dependencies
    const deps = getTransitiveDependencies(filePath, this.dependencyGraph);
    const importers = getImporters(filePath, this.dependencyGraph);

    let score = 0;

    // Check if any dependency matches targets
    for (const target of intents.targets) {
      const targetLower = target.name.toLowerCase();

      for (const dep of deps) {
        if (dep.toLowerCase().includes(targetLower)) {
          score = Math.max(score, 0.5 * target.confidence);
        }
      }

      for (const importer of importers) {
        if (importer.toLowerCase().includes(targetLower)) {
          score = Math.max(score, 0.4 * target.confidence);
        }
      }
    }

    // Central files (many connections) get a bonus
    const connectionCount = deps.length + importers.length;
    if (connectionCount > 3) {
      score = Math.max(score, Math.min(0.3, connectionCount * 0.05));
    }

    return score;
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(filePath: string, recentFiles: string[]): number {
    if (!recentFiles.includes(filePath)) {
      return 0;
    }

    const position = recentFiles.indexOf(filePath);
    const maxBonus = 1.0;
    const decayFactor = 0.7;

    return maxBonus * Math.pow(decayFactor, position);
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filePath: string): boolean {
    return /\.(tsx?|jsx?|css|scss|json)$/.test(filePath);
  }

  /**
   * Determine reason for file selection
   */
  private determineReason(
    signals: ResolvedFile["signals"],
    filePath: string,
    intents: IntentExtractionResult
  ): string {
    const reasons: string[] = [];

    if (signals.nameMatch > 0.5) {
      const matchingTarget = intents.targets.find((t) =>
        filePath.toLowerCase().includes(t.name.toLowerCase())
      );
      reasons.push(`Name matches "${matchingTarget?.name || "target"}"`);
    }

    if (signals.importTrace > 0.5) {
      reasons.push("Import/export relationship");
    }

    if (signals.embedding > 0.5) {
      reasons.push("Semantic similarity");
    }

    if (signals.keyword > 0.5) {
      reasons.push("Keyword match");
    }

    if (signals.componentGraph > 0.3) {
      reasons.push("Component graph relationship");
    }

    if (signals.recency > 0.5) {
      reasons.push("Recently modified");
    }

    return reasons.length > 0 ? reasons.join(", ") : "General relevance";
  }

  /**
   * Determine if file should be editable
   */
  private shouldBeEditable(
    filePath: string,
    intents: IntentExtractionResult,
    signals: ResolvedFile["signals"]
  ): boolean {
    // Config files are usually read-only context
    if (/\.(json|config\.[jt]s)$/.test(filePath) && !filePath.includes("package")) {
      return false;
    }

    // Type definition files are usually read-only
    if (filePath.includes("/types/") || filePath.endsWith(".d.ts")) {
      return false;
    }

    // High name match or import trace = likely editable
    if (signals.nameMatch > 0.6 || signals.importTrace > 0.7) {
      return true;
    }

    // If it's a direct target, it's editable
    for (const target of intents.targets) {
      if (filePath.toLowerCase().includes(target.name.toLowerCase())) {
        return true;
      }
    }

    // Default: editable if score is high enough
    const totalScore =
      signals.nameMatch * this.config.weights.nameMatch +
      signals.importTrace * this.config.weights.importTrace +
      signals.embedding * this.config.weights.embedding +
      signals.keyword * this.config.weights.keyword +
      signals.componentGraph * this.config.weights.componentGraph +
      signals.recency * this.config.weights.recency;

    return totalScore > 0.3;
  }
}

/**
 * Convenience function to resolve files
 */
export async function resolveFiles(
  intents: IntentExtractionResult,
  files: Map<string, string>,
  options?: {
    recentFiles?: string[];
    embeddingScores?: Map<string, number>;
    config?: FileResolverConfig;
  }
): Promise<FileResolutionResult> {
  const resolver = new FileResolver(options?.config);
  return resolver.resolveFiles(intents, files, options);
}
