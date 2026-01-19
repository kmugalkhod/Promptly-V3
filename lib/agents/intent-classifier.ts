/**
 * Intent Classifier
 *
 * @deprecated This module is deprecated. Use intent-extractor.ts instead.
 *
 * The new Intent Extractor provides:
 * - LLM-based intent extraction (vs regex pattern matching)
 * - Multi-intent detection for compound requests
 * - Better target identification
 * - More accurate complexity assessment
 *
 * This module is kept for backwards compatibility only.
 */

/**
 * Request complexity levels
 */
export enum RequestComplexity {
  SIMPLE = "simple",
  MODERATE = "moderate",
  COMPLEX = "complex",
  ARCHITECTURAL = "architectural",
}

/**
 * Request intent types
 */
export enum RequestIntent {
  STYLE_CHANGE = "style_change",
  CONTENT_UPDATE = "content_update",
  BUG_FIX = "bug_fix",
  ADD_FEATURE = "add_feature",
  REMOVE_FEATURE = "remove_feature",
  REFACTOR = "refactor",
  PERFORMANCE = "performance",
  ACCESSIBILITY = "accessibility",
  UNKNOWN = "unknown",
}

/**
 * Classification result
 */
export interface ClassificationResult {
  intent: RequestIntent;
  complexity: RequestComplexity;
  confidence: number;
  suggestedFiles: string[];
  requiresArchitecture: boolean;
  keywords: string[];
}

// Keywords that suggest architectural changes (recommend full rebuild)
const ARCHITECTURAL_KEYWORDS = [
  "authentication", "auth", "login", "signup", "register",
  "payments", "stripe", "checkout",
  "database", "backend", "api",
  "new page", "add page", "new route",
  "restructure", "rebuild", "rewrite",
];

// Simple keyword to intent mapping
const INTENT_PATTERNS: { pattern: RegExp; intent: RequestIntent }[] = [
  // Bug fixes (check first - highest priority)
  { pattern: /not (visible|showing|working|displaying)/i, intent: RequestIntent.BUG_FIX },
  { pattern: /(can't|cannot) see/i, intent: RequestIntent.BUG_FIX },
  { pattern: /(doesn't|does not) (work|show)/i, intent: RequestIntent.BUG_FIX },
  { pattern: /(fix|bug|broken|error|issue|problem)/i, intent: RequestIntent.BUG_FIX },

  // Style changes
  { pattern: /(color|font|style|css|theme|background|border|padding|margin)/i, intent: RequestIntent.STYLE_CHANGE },
  { pattern: /(size|width|height|spacing|animation|hover|opacity)/i, intent: RequestIntent.STYLE_CHANGE },
  { pattern: /make (it|the|this) (bigger|smaller|larger|darker|lighter)/i, intent: RequestIntent.STYLE_CHANGE },

  // Content updates
  { pattern: /(change|update|edit) (the )?(text|title|heading|label|content)/i, intent: RequestIntent.CONTENT_UPDATE },
  { pattern: /(rename|reword)/i, intent: RequestIntent.CONTENT_UPDATE },

  // Add features
  { pattern: /(add|create|implement|include|insert) (a |an |the )?/i, intent: RequestIntent.ADD_FEATURE },

  // Remove features
  { pattern: /(remove|delete|hide|disable)/i, intent: RequestIntent.REMOVE_FEATURE },

  // Performance
  { pattern: /(slow|fast|performance|optimize|speed)/i, intent: RequestIntent.PERFORMANCE },

  // Accessibility
  { pattern: /(accessibility|a11y|aria|screen reader)/i, intent: RequestIntent.ACCESSIBILITY },

  // Refactor
  { pattern: /(refactor|restructure|clean up|simplify)/i, intent: RequestIntent.REFACTOR },
];

// File hints - map keywords to likely file patterns
const FILE_HINTS: Record<string, string[]> = {
  header: ["components/Header", "components/Navbar"],
  footer: ["components/Footer"],
  button: ["components/Button", "components/ui/button"],
  form: ["components/Form", "components/ui/form"],
  modal: ["components/Modal", "components/Dialog"],
  card: ["components/Card", "components/ui/card"],
  sidebar: ["components/Sidebar"],
  hero: ["components/Hero"],
  home: ["app/page.tsx"],
  layout: ["app/layout.tsx"],
  style: ["globals.css"],
  theme: ["globals.css", "tailwind.config"],
};

/**
 * Classify a user modification request
 */
export function classifyRequest(
  message: string,
  existingFiles: string[] = []
): ClassificationResult {
  const messageLower = message.toLowerCase();

  // Extract keywords
  const keywords = extractKeywords(message);

  // Detect intent
  const intent = detectIntent(messageLower);

  // Check for architectural requirements
  const requiresArchitecture = ARCHITECTURAL_KEYWORDS.some((kw) =>
    messageLower.includes(kw)
  );

  // Determine complexity
  const complexity = determineComplexity(messageLower, existingFiles);

  // Suggest relevant files
  const suggestedFiles = suggestFiles(messageLower, keywords, existingFiles);

  return {
    intent,
    complexity,
    confidence: 0.8,
    suggestedFiles,
    requiresArchitecture,
    keywords,
  };
}

/**
 * Async version for compatibility (same as sync version)
 */
export async function classifyRequestWithLLM(
  message: string,
  existingFiles: string[] = []
): Promise<ClassificationResult> {
  // Just use simple keyword matching - no LLM needed
  return classifyRequest(message, existingFiles);
}

/**
 * Extract meaningful keywords from message
 */
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "to", "is", "it", "in", "on", "for", "of",
    "and", "or", "but", "with", "this", "that", "be", "are",
    "i", "you", "we", "please", "want", "need", "like", "can",
  ]);

  return message
    .toLowerCase()
    .split(/[\s\-_.,;:!?()+]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

/**
 * Detect intent using pattern matching
 */
function detectIntent(messageLower: string): RequestIntent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(messageLower)) {
      return intent;
    }
  }
  return RequestIntent.UNKNOWN;
}

/**
 * Determine complexity based on message and file count
 */
function determineComplexity(
  messageLower: string,
  existingFiles: string[]
): RequestComplexity {
  // Architectural keywords = architectural complexity
  if (ARCHITECTURAL_KEYWORDS.some((kw) => messageLower.includes(kw))) {
    return RequestComplexity.ARCHITECTURAL;
  }

  // Multiple files mentioned = complex
  if (
    messageLower.includes("all") ||
    messageLower.includes("every") ||
    messageLower.includes("each")
  ) {
    return RequestComplexity.MODERATE;
  }

  // Single element = simple
  if (
    messageLower.includes("just") ||
    messageLower.includes("only") ||
    messageLower.includes("single")
  ) {
    return RequestComplexity.SIMPLE;
  }

  return RequestComplexity.MODERATE;
}

/**
 * Suggest relevant files based on message content
 */
function suggestFiles(
  messageLower: string,
  keywords: string[],
  existingFiles: string[]
): string[] {
  const suggestions = new Set<string>();

  // Check file hints
  for (const [hint, patterns] of Object.entries(FILE_HINTS)) {
    if (messageLower.includes(hint)) {
      for (const pattern of patterns) {
        for (const file of existingFiles) {
          if (file.toLowerCase().includes(pattern.toLowerCase())) {
            suggestions.add(file);
          }
        }
      }
    }
  }

  // Match keywords to filenames
  for (const keyword of keywords) {
    for (const file of existingFiles) {
      const filename = file.split("/").pop()?.toLowerCase() || "";
      if (filename.includes(keyword)) {
        suggestions.add(file);
      }
    }
  }

  // If "component" or "each" mentioned, include all component files
  if (messageLower.includes("component") || messageLower.includes("each")) {
    for (const file of existingFiles) {
      if (file.includes("components/") && file.endsWith(".tsx")) {
        suggestions.add(file);
      }
    }
  }

  return Array.from(suggestions).slice(0, 10);
}

/**
 * Get context limits based on complexity
 */
export function getContextLimitsForComplexity(
  complexity: RequestComplexity
): { maxFiles: number; maxTokens: number; recursionLimit: number } {
  switch (complexity) {
    case RequestComplexity.SIMPLE:
      return { maxFiles: 3, maxTokens: 3000, recursionLimit: 30 };
    case RequestComplexity.MODERATE:
      return { maxFiles: 6, maxTokens: 5000, recursionLimit: 50 };
    case RequestComplexity.COMPLEX:
      return { maxFiles: 10, maxTokens: 8000, recursionLimit: 75 };
    case RequestComplexity.ARCHITECTURAL:
      return { maxFiles: 15, maxTokens: 10000, recursionLimit: 100 };
    default:
      return { maxFiles: 5, maxTokens: 4000, recursionLimit: 50 };
  }
}
