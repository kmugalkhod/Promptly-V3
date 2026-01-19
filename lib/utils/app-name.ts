/**
 * App Name Utilities
 *
 * Functions for deriving and extracting app names from user descriptions
 * and architecture documents.
 *
 * Ported from: reference-code/backend-v2/utils.py
 */

/**
 * Stop words to filter out when deriving app name
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "like",
  "similar",
  "to",
  "for",
  "with",
  "build",
  "create",
  "make",
  "application",
  "app",
  "website",
  "web",
  "platform",
  "system",
  "tool",
  "based",
  "advanced",
  "simple",
  "basic",
  "complex",
  "modern",
  "new",
  "my",
  "our",
  "using",
  "use",
  "that",
  "this",
  "will",
  "can",
  "should",
  "need",
  "want",
  "please",
  "help",
  "me",
  "i",
  "we",
  "you",
]);

/**
 * Derive a kebab-case app name from a project description.
 *
 * @param description - User's project description
 * @returns Kebab-case app name
 *
 * @example
 * deriveAppName("Jira-like project management") // -> "project-manager"
 * deriveAppName("E-commerce platform for shoes") // -> "shoe-store"
 * deriveAppName("Build a task tracker") // -> "task-tracker"
 */
export function deriveAppName(description: string): string {
  // Extract alphabetic words only
  const words = description.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];

  // Filter out stop words
  const keyWords = words.filter((w) => !STOP_WORDS.has(w));

  // Take the first 2-3 meaningful words
  const selected = keyWords.slice(0, 2);

  if (selected.length === 0) {
    return "nextjs-app";
  }

  return selected.join("-");
}

/**
 * Extract app name from architecture document.
 *
 * Looks for patterns like:
 * - APP_NAME: my-app
 * - **App Name**: my-app
 * - # Architecture Design: my-app
 *
 * @param content - Architecture document content
 * @returns Extracted app name or default
 */
export function extractAppNameFromArchitecture(content: string): string {
  const patterns = [
    /APP_NAME:\s*`?([a-z0-9-]+)`?/i,
    /\*\*App Name\*\*:\s*`?([a-z0-9-]+)`?/i,
    /App Name:\s*`?([a-z0-9-]+)`?/i,
    /# Architecture Design:\s*([a-zA-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      let name = match[1].toLowerCase().trim();
      // Ensure valid kebab-case
      name = name.replace(/[^a-z0-9-]/g, "-");
      name = name.replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (name) {
        return name;
      }
    }
  }

  return "nextjs-app";
}

/**
 * Validate that a string is a valid kebab-case app name.
 *
 * @param name - Name to validate
 * @returns True if valid kebab-case
 */
export function isValidAppName(name: string): boolean {
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(name) || /^[a-z]$/.test(name);
}

/**
 * Sanitize a string to be a valid kebab-case app name.
 *
 * @param input - Input string
 * @returns Valid kebab-case name
 */
export function sanitizeAppName(input: string): string {
  let name = input.toLowerCase().trim();
  // Replace non-alphanumeric with hyphens
  name = name.replace(/[^a-z0-9]/g, "-");
  // Collapse multiple hyphens
  name = name.replace(/-+/g, "-");
  // Remove leading/trailing hyphens
  name = name.replace(/^-|-$/g, "");

  if (!name) {
    return "nextjs-app";
  }

  return name;
}
