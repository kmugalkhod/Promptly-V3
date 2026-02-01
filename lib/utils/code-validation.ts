/**
 * Post-Generation Code Validation
 *
 * Scans generated files for common issues that cause bugs at runtime.
 * Diagnostic only — logs warnings/errors but does not auto-fix or block.
 */

export interface CodeValidationResult {
  warnings: string[];
  errors: string[];
}

/**
 * Validate generated code files for common issues.
 *
 * @param readFile - Function to read a file by path (returns null if not found)
 * @param filesCreated - List of file paths that were created by the coder
 * @returns Validation result with warnings and errors
 */
export async function validateGeneratedCode(
  readFile: (path: string) => Promise<string | null>,
  filesCreated: string[]
): Promise<CodeValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Only check .ts/.tsx files
  const codeFiles = filesCreated.filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  );

  // Track created component names for page import check
  const componentFiles = codeFiles.filter(
    (f) => f.startsWith("components/") && f.endsWith(".tsx")
  );

  for (const filePath of codeFiles) {
    const content = await readFile(filePath);
    if (!content) continue;

    // Check: useState([]) or useState(null) without nearby INITIAL_* or fallback
    if (
      /useState\(\s*\[\s*\]\s*\)/.test(content) &&
      !content.includes("INITIAL_") &&
      !content.includes("// empty by design") &&
      !content.includes("useEffect")
    ) {
      warnings.push(
        `${filePath}: useState([]) without INITIAL_* data or useEffect fallback — may render empty`
      );
    }

    if (
      /useState\(\s*null\s*\)/.test(content) &&
      !content.includes("INITIAL_") &&
      !content.includes("useEffect")
    ) {
      warnings.push(
        `${filePath}: useState(null) without useEffect data fetch — may render nothing`
      );
    }

    // Check: Math.random() or Date.now() in component body (outside useEffect)
    // Simple heuristic: if the file has Math.random()/Date.now() but NOT inside a useEffect callback
    if (/Math\.random\(\)/.test(content) || /Date\.now\(\)/.test(content)) {
      // Check if it's inside a useEffect or event handler — rough heuristic
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          (line.includes("Math.random()") || line.includes("Date.now()")) &&
          !isInsideCallback(lines, i)
        ) {
          warnings.push(
            `${filePath}:${i + 1}: Math.random()/Date.now() in component body — causes hydration mismatch`
          );
          break;
        }
      }
    }

    // Check: React hooks without 'use client' directive
    if (
      /\b(useState|useEffect|useRef|useCallback|useMemo)\b/.test(content) &&
      !content.trimStart().startsWith("'use client'") &&
      !content.trimStart().startsWith('"use client"')
    ) {
      errors.push(
        `${filePath}: Uses React hooks but missing 'use client' directive`
      );
    }

    // Check: Hardcoded Tailwind colors (any instance is an error)
    const hardcodedColorMatches = content.match(
      /\b(bg-white|bg-black|text-white|text-black|bg-gray-\d+|text-gray-\d+|bg-slate-\d+|text-slate-\d+)\b/g
    );
    if (hardcodedColorMatches && hardcodedColorMatches.length > 0) {
      errors.push(
        `${filePath}: ${hardcodedColorMatches.length} hardcoded Tailwind colors found (${hardcodedColorMatches.slice(0, 3).join(", ")}${hardcodedColorMatches.length > 3 ? "..." : ""}) — use CSS variables instead`
      );
    }
  }

  // Check: app/page.tsx missing imports for created components
  if (componentFiles.length > 0) {
    const pageContent = await readFile("app/page.tsx");
    if (pageContent) {
      for (const compFile of componentFiles) {
        // Extract component name from file path: components/TaskCard.tsx -> TaskCard
        const compName = compFile
          .replace("components/", "")
          .replace(".tsx", "");
        if (!pageContent.includes(compName)) {
          warnings.push(
            `app/page.tsx: Does not import/use component '${compName}' from ${compFile}`
          );
        }
      }
    }
  }

  return { warnings, errors };
}

/**
 * Rough heuristic: check if a line is likely inside a useEffect/callback/event handler.
 * Looks backward from the line for useEffect, onClick, onChange, etc.
 */
function isInsideCallback(lines: string[], lineIndex: number): boolean {
  // Look back up to 10 lines for a callback context
  const lookback = Math.max(0, lineIndex - 10);
  for (let i = lineIndex; i >= lookback; i--) {
    const line = lines[i];
    if (
      line.includes("useEffect") ||
      line.includes("onClick") ||
      line.includes("onChange") ||
      line.includes("onSubmit") ||
      line.includes("setTimeout") ||
      line.includes("setInterval") ||
      line.includes("addEventListener")
    ) {
      return true;
    }
  }
  return false;
}
