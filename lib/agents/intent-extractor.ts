/**
 * Intent Extractor
 *
 * LLM-based intent extraction that supports multi-intent detection
 * from compound user requests. Replaces the regex-based intent-classifier.
 *
 * Uses Anthropic tool_use with structured schema for reliable extraction.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL_NAME = "claude-3-5-haiku-20241022";

/**
 * Intent types that can be extracted from user messages
 */
export enum IntentType {
  STYLE_CHANGE = "style_change",
  CONTENT_UPDATE = "content_update",
  BUG_FIX = "bug_fix",
  ADD_FEATURE = "add_feature",
  REMOVE_FEATURE = "remove_feature",
  REFACTOR = "refactor",
  PERFORMANCE = "performance",
  ACCESSIBILITY = "accessibility",
  LAYOUT_CHANGE = "layout_change",
  DATA_BINDING = "data_binding",
  NAVIGATION = "navigation",
  UNKNOWN = "unknown",
}

/**
 * Complexity levels for requests
 */
export type Complexity = "simple" | "moderate" | "complex" | "architectural";

/**
 * A single extracted intent with confidence
 */
export interface ExtractedIntent {
  type: IntentType;
  confidence: number;
  details: string;
}

/**
 * A target element/component mentioned in the request
 */
export interface ExtractedTarget {
  type: "component" | "element" | "file" | "style" | "function" | "hook";
  name: string;
  confidence: number;
}

/**
 * A specific change action to be performed
 */
export interface ExtractedChange {
  action: string;
  target: string;
  description: string;
}

/**
 * Complete result of intent extraction
 */
export interface IntentExtractionResult {
  /** Multiple intents extracted from the message */
  intents: ExtractedIntent[];
  /** Target elements/components mentioned */
  targets: ExtractedTarget[];
  /** Specific changes to be made */
  changes: ExtractedChange[];
  /** Overall complexity assessment */
  complexity: Complexity;
  /** Whether this requires architectural changes */
  requiresArchitecture: boolean;
  /** Raw keywords extracted for file matching */
  keywords: string[];
}

/**
 * Anthropic tool definition for intent extraction
 */
const EXTRACT_INTENTS_TOOL: Anthropic.Tool = {
  name: "extract_intents",
  description: "Extract structured intents from a user modification request",
  input_schema: {
    type: "object",
    properties: {
      intents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "style_change",
                "content_update",
                "bug_fix",
                "add_feature",
                "remove_feature",
                "refactor",
                "performance",
                "accessibility",
                "layout_change",
                "data_binding",
                "navigation",
                "unknown",
              ],
              description: "Type of intent detected",
            },
            confidence: {
              type: "number",
              description: "Confidence score 0.0-1.0",
            },
            details: {
              type: "string",
              description: "Specific details about what this intent involves",
            },
          },
          required: ["type", "confidence", "details"],
        },
        description: "List of intents detected in the message (can be multiple)",
      },
      targets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["component", "element", "file", "style", "function", "hook"],
              description: "Type of target",
            },
            name: {
              type: "string",
              description: "Name of the target (e.g., 'Button', 'header', 'TaskList')",
            },
            confidence: {
              type: "number",
              description: "Confidence score 0.0-1.0",
            },
          },
          required: ["type", "name", "confidence"],
        },
        description: "Target elements/components mentioned in the request",
      },
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action verb (add, remove, change, fix, etc.)",
            },
            target: {
              type: "string",
              description: "What to apply the action to",
            },
            description: {
              type: "string",
              description: "Full description of the change",
            },
          },
          required: ["action", "target", "description"],
        },
        description: "Specific changes to be made",
      },
      complexity: {
        type: "string",
        enum: ["simple", "moderate", "complex", "architectural"],
        description: "Overall complexity of the request",
      },
      requiresArchitecture: {
        type: "boolean",
        description: "Whether this requires major architectural changes",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "Key terms for file matching (component names, CSS properties, etc.)",
      },
    },
    required: [
      "intents",
      "targets",
      "changes",
      "complexity",
      "requiresArchitecture",
      "keywords",
    ],
  },
};

/**
 * System prompt for intent extraction
 */
const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing user requests for web application modifications.

Your job is to extract structured information from user messages to help a code modification agent understand:
1. What type(s) of changes are being requested (can be MULTIPLE intents)
2. What SPECIFIC files need to be modified (CRITICAL - must match actual project files)
3. What specific changes need to be made
4. How complex the overall request is

## Intent Types:
- style_change: CSS, colors, fonts, spacing, sizing, visual appearance
- content_update: Text changes, labels, headings, copy
- bug_fix: Something broken, not working, error, issue
- add_feature: New functionality, new component, new behavior
- remove_feature: Delete, hide, remove existing functionality
- refactor: Code cleanup, reorganization without behavior change
- performance: Speed, optimization, reducing re-renders
- accessibility: ARIA, keyboard nav, screen reader support
- layout_change: Grid, flex, positioning, responsive
- data_binding: State, props, data flow, API integration
- navigation: Routes, links, page transitions

## Complexity Levels:
- simple: Single file, minor change (e.g., "make button blue")
- moderate: 2-3 files, related changes (e.g., "add loading state to form")
- complex: Multiple files, coordinated changes (e.g., "add dark mode toggle")
- architectural: New features requiring new files/structure (e.g., "add authentication")

## CRITICAL Guidelines for Target Extraction:
1. ALWAYS look at the "Existing files in project" list provided
2. For targets, use ACTUAL FILE NAMES from the project, not generic terms like "All Components"
3. If user says "button", find files like "Button.tsx", "button.tsx", "SubmitButton.tsx" from the project
4. If user says "header", find files like "Header.tsx", "Navbar.tsx" from the project
5. If user says "all components" or is vague, list the SPECIFIC component files that should be modified
6. The target "name" field MUST match actual file names (without path/extension) from the project

Examples:
- "make the button blue" + project has "components/Button.tsx" → target: { type: "component", name: "Button", confidence: 0.9 }
- "fix the header" + project has "components/Header.tsx" → target: { type: "component", name: "Header", confidence: 0.9 }
- "update all components" + project has 3 component files → list each as a separate target

## Other Guidelines:
- Extract ALL intents from compound requests (e.g., "fix the button and make it blue" = bug_fix + style_change)
- Keywords should include: component names, CSS properties, function names, specific terms
- requiresArchitecture = true for: new pages, auth, payments, database changes, new routes

Always use the extract_intents tool to return your analysis.`;

/**
 * Build organized file context for the LLM
 * Groups files by type and includes summaries of what each file contains
 */
function buildFileContext(existingFiles: string[], fileContents?: Map<string, string>): string {
  if (existingFiles.length === 0) {
    return "";
  }

  // Categorize files with summaries
  const components: string[] = [];
  const pages: string[] = [];
  const styles: string[] = [];
  const hooks: string[] = [];
  const utils: string[] = [];
  const other: string[] = [];

  for (const filePath of existingFiles) {
    const fileName = filePath.split("/").pop() || filePath;
    const fileNameNoExt = fileName.replace(/\.[^.]+$/, "");
    const content = fileContents?.get(filePath);
    const summary = content ? extractFileSummary(content, filePath) : "";
    const summaryStr = summary ? ` - ${summary}` : "";

    if (filePath.includes("components/") || /^[A-Z]/.test(fileNameNoExt)) {
      components.push(`- ${filePath} (component: "${fileNameNoExt}")${summaryStr}`);
    } else if (filePath.includes("app/") && filePath.endsWith("page.tsx")) {
      pages.push(`- ${filePath} (page)${summaryStr}`);
    } else if (filePath.endsWith(".css") || filePath.includes("styles")) {
      styles.push(`- ${filePath}${summaryStr}`);
    } else if (fileNameNoExt.startsWith("use") || filePath.includes("hooks/")) {
      hooks.push(`- ${filePath} (hook: "${fileNameNoExt}")${summaryStr}`);
    } else if (filePath.includes("utils/") || filePath.includes("lib/")) {
      utils.push(`- ${filePath}${summaryStr}`);
    } else {
      other.push(`- ${filePath}${summaryStr}`);
    }
  }

  const sections: string[] = ["\n\n## Existing Files in Project (USE THESE NAMES FOR TARGETS):"];

  if (components.length > 0) {
    sections.push("\n### Components (use the component name for targets):");
    sections.push(components.join("\n"));
  }

  if (pages.length > 0) {
    sections.push("\n### Pages:");
    sections.push(pages.join("\n"));
  }

  if (styles.length > 0) {
    sections.push("\n### Styles:");
    sections.push(styles.join("\n"));
  }

  if (hooks.length > 0) {
    sections.push("\n### Hooks:");
    sections.push(hooks.join("\n"));
  }

  if (utils.length > 0) {
    sections.push("\n### Utilities:");
    sections.push(utils.join("\n"));
  }

  if (other.length > 0) {
    sections.push("\n### Other:");
    sections.push(other.join("\n"));
  }

  return sections.join("\n");
}

/**
 * Extract a brief summary of what a file contains
 */
function extractFileSummary(content: string, filePath: string): string {
  const summaryParts: string[] = [];

  // For React components, extract key UI elements
  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
    // Find component props
    const propsMatch = content.match(/interface\s+\w*Props\s*\{([^}]+)\}/);
    if (propsMatch) {
      const props = propsMatch[1].match(/(\w+):/g)?.slice(0, 3).map(p => p.replace(":", ""));
      if (props && props.length > 0) {
        summaryParts.push(`props: ${props.join(", ")}`);
      }
    }

    // Find key HTML elements/components rendered
    const elements: string[] = [];
    const buttonMatch = content.match(/<button|<Button/gi);
    if (buttonMatch) elements.push("button");
    const inputMatch = content.match(/<input|<Input/gi);
    if (inputMatch) elements.push("input");
    const formMatch = content.match(/<form|<Form/gi);
    if (formMatch) elements.push("form");
    const headerMatch = content.match(/<header|<Header|<h[1-6]/gi);
    if (headerMatch) elements.push("header/heading");
    const listMatch = content.match(/<ul|<ol|<li/gi);
    if (listMatch) elements.push("list");

    if (elements.length > 0) {
      summaryParts.push(`contains: ${elements.slice(0, 4).join(", ")}`);
    }

    // Find state hooks used
    const stateMatch = content.match(/useState<?\w*>?\(/g);
    if (stateMatch) {
      summaryParts.push(`state: ${stateMatch.length} hooks`);
    }
  }

  // For CSS files, extract key selectors/classes
  if (filePath.endsWith(".css")) {
    const classMatches = content.match(/\.[\w-]+/g);
    if (classMatches) {
      const uniqueClasses = [...new Set(classMatches)].slice(0, 5);
      summaryParts.push(`classes: ${uniqueClasses.join(", ")}`);
    }
  }

  return summaryParts.join("; ");
}

/**
 * Extract intents from a user message using LLM
 *
 * @param message - User's modification request
 * @param existingFiles - List of existing file paths for context
 * @param fileContents - Optional map of file paths to contents for better analysis
 * @returns Structured intent extraction result
 */
export async function extractIntents(
  message: string,
  existingFiles: string[] = [],
  fileContents?: Map<string, string>
): Promise<IntentExtractionResult> {
  const client = new Anthropic();

  // Build context about existing files - organized by type with summaries
  const fileContext = buildFileContext(existingFiles, fileContents);

  try {
    const response = await client.messages.create({
      model: MODEL_NAME,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [EXTRACT_INTENTS_TOOL],
      tool_choice: { type: "tool", name: "extract_intents" },
      messages: [
        {
          role: "user",
          content: `Analyze this user request and extract all intents:\n\n"${message}"${fileContext}`,
        },
      ],
    });

    // Extract the tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUseBlock) {
      console.error("[intent-extractor] No tool use in response");
      return createFallbackResult(message);
    }

    const result = toolUseBlock.input as IntentExtractionResult;

    // Validate and normalize the result
    return normalizeResult(result);
  } catch (error) {
    console.error("[intent-extractor] LLM extraction failed:", error);
    return createFallbackResult(message);
  }
}

/**
 * Normalize and validate the extraction result
 */
function normalizeResult(result: IntentExtractionResult): IntentExtractionResult {
  return {
    intents: (result.intents || []).map((intent) => ({
      type: (intent.type as IntentType) || IntentType.UNKNOWN,
      confidence: Math.max(0, Math.min(1, intent.confidence || 0.5)),
      details: intent.details || "",
    })),
    targets: (result.targets || []).map((target) => ({
      type: target.type || "element",
      name: target.name || "",
      confidence: Math.max(0, Math.min(1, target.confidence || 0.5)),
    })),
    changes: (result.changes || []).map((change) => ({
      action: change.action || "",
      target: change.target || "",
      description: change.description || "",
    })),
    complexity: result.complexity || "moderate",
    requiresArchitecture: result.requiresArchitecture || false,
    keywords: result.keywords || [],
  };
}

/**
 * Create a fallback result using simple keyword matching
 * Used when LLM extraction fails
 */
function createFallbackResult(message: string): IntentExtractionResult {
  const messageLower = message.toLowerCase();
  const intents: ExtractedIntent[] = [];
  const keywords: string[] = [];

  // Extract keywords
  const words = messageLower.split(/[\s\-_.,;:!?()+]+/).filter((w) => w.length >= 3);
  keywords.push(...words);

  // Simple pattern matching for fallback
  if (/fix|bug|broken|error|issue|problem|doesn't|does not|not working/i.test(message)) {
    intents.push({ type: IntentType.BUG_FIX, confidence: 0.7, details: "Bug fix detected" });
  }
  if (/color|font|style|css|theme|background|border|padding|margin|size/i.test(message)) {
    intents.push({ type: IntentType.STYLE_CHANGE, confidence: 0.7, details: "Style change detected" });
  }
  if (/add|create|implement|include|insert|new/i.test(message)) {
    intents.push({ type: IntentType.ADD_FEATURE, confidence: 0.6, details: "Add feature detected" });
  }
  if (/remove|delete|hide|disable/i.test(message)) {
    intents.push({ type: IntentType.REMOVE_FEATURE, confidence: 0.7, details: "Remove feature detected" });
  }
  if (/change|update|edit|modify|rename/i.test(message)) {
    intents.push({ type: IntentType.CONTENT_UPDATE, confidence: 0.6, details: "Content update detected" });
  }

  // If no intents detected, default to unknown
  if (intents.length === 0) {
    intents.push({ type: IntentType.UNKNOWN, confidence: 0.5, details: "Unable to classify" });
  }

  // Determine complexity
  let complexity: Complexity = "moderate";
  if (/auth|login|payment|stripe|database|api|new page|add page/i.test(message)) {
    complexity = "architectural";
  } else if (/all|every|each|multiple|across/i.test(message)) {
    complexity = "complex";
  } else if (/just|only|single|simple/i.test(message)) {
    complexity = "simple";
  }

  return {
    intents,
    targets: [],
    changes: [],
    complexity,
    requiresArchitecture: complexity === "architectural",
    keywords,
  };
}

/**
 * Check if the extraction result contains a specific intent type
 */
export function hasIntent(result: IntentExtractionResult, type: IntentType): boolean {
  return result.intents.some((intent) => intent.type === type);
}

/**
 * Get the primary (highest confidence) intent
 */
export function getPrimaryIntent(result: IntentExtractionResult): ExtractedIntent | null {
  if (result.intents.length === 0) return null;
  return result.intents.reduce((max, intent) =>
    intent.confidence > max.confidence ? intent : max
  );
}

/**
 * Get all targets of a specific type
 */
export function getTargetsByType(
  result: IntentExtractionResult,
  type: ExtractedTarget["type"]
): ExtractedTarget[] {
  return result.targets.filter((target) => target.type === type);
}
