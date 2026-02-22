/**
 * Shared Prompt Utilities
 *
 * Runtime validation functions shared across agents.
 * Prompt constants have been migrated to the skills system.
 */

/**
 * Validate globals.css content before writing.
 * Returns null if valid, or an error message if invalid.
 * Shared by both chat and coder agents.
 */
export function validateGlobalsCss(content: string): string | null {
  const lines = content.split("\n");
  // Find first non-empty, non-comment line (properly tracking block comments)
  let firstContentLine: string | undefined;
  let inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // skip empty lines
    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith("//")) continue; // single-line comment
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      continue; // skip entire comment line (including single-line block comments like /* foo */)
    }
    firstContentLine = line;
    break;
  }

  if (!firstContentLine || (!firstContentLine.includes('@import "tailwindcss"') && !firstContentLine.includes("@import 'tailwindcss'"))) {
    return `ERROR: globals.css MUST start with '@import "tailwindcss"' (single or double quotes) as the first non-comment line. Your file starts with: "${firstContentLine?.trim() ?? "(empty)"}". Rewrite the file with '@import "tailwindcss"' as the first line.`;
  }

  // Check for Tailwind v3 syntax
  if (
    content.includes("@tailwind base") ||
    content.includes("@tailwind components") ||
    content.includes("@tailwind utilities")
  ) {
    return `ERROR: globals.css contains Tailwind v3 syntax (@tailwind base/components/utilities). This project uses Tailwind v4 which only needs '@import "tailwindcss"'. Remove all @tailwind directives and use '@import "tailwindcss"' instead.`;
  }

  // Check for @import url() font imports
  if (content.includes("@import url(")) {
    return `ERROR: globals.css contains '@import url(...)' for font loading. This breaks Tailwind v4 builds. Use 'next/font/google' in layout.tsx instead of CSS @import url() for fonts. Remove the @import url() line and load fonts via next/font/google.`;
  }

  return null;
}
