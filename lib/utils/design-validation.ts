/**
 * Post-Generation Design Validation
 *
 * After the coder agent finishes, validates that design tokens
 * were actually applied. If not, writes correct files deterministically.
 */

import type { DesignTokens } from "./design-tokens";
import { buildShadcnGlobalsCss } from "./design-tokens";

/** Result of design validation */
export interface ValidationResult {
  globalsCssValid: boolean;
  layoutTsxValid: boolean;
  filesFixed: string[];
}

/**
 * Validate that globals.css contains real hex color values (not placeholders).
 */
function validateGlobalsCss(content: string | null): boolean {
  if (!content) return false;

  // Must contain --primary with a real hex value (bare name, shadcn format)
  const hasPrimaryColor = /--primary:\s*#[0-9a-fA-F]{3,8}/.test(content);
  // Must not have placeholder patterns
  const hasPlaceholders = /--primary:\s*#_{2,}/.test(content);
  // Must have the tailwind import
  const hasTailwindImport = content.includes('@import "tailwindcss"') || content.includes("@import 'tailwindcss'");
  // Must have @theme inline block (shadcn + Tailwind v4)
  const hasThemeInline = content.includes("@theme inline");

  return hasPrimaryColor && !hasPlaceholders && hasTailwindImport && hasThemeInline;
}

/**
 * Validate that layout.tsx uses custom fonts (not Geist defaults).
 */
function validateLayoutTsx(content: string | null): boolean {
  if (!content) return false;

  // Must import from next/font/google
  const hasGoogleFont = content.includes("next/font/google");
  // Must NOT be using Geist (the default template font)
  const usesGeist = /import.*Geist/.test(content) || content.includes("geistSans");
  // Must import globals.css
  const importsGlobals = content.includes("./globals.css");

  return hasGoogleFont && !usesGeist && importsGlobals;
}

/**
 * Generate correct globals.css from design tokens.
 */
function generateGlobalsCss(tokens: DesignTokens): string {
  return buildShadcnGlobalsCss(tokens);
}

/**
 * Surgically patch an existing layout.tsx to use custom fonts
 * while preserving custom code (providers, wrappers, metadata, etc.).
 * Falls back to full generation if the layout is empty or missing.
 */
function patchLayoutTsx(existing: string, tokens: DesignTokens): string {
  let result = existing;
  const { typography } = tokens;

  const isSameFont = typography.displayImport === typography.bodyImport;
  const fontImport = isSameFont
    ? `import { ${typography.displayImport} } from 'next/font/google'`
    : `import { ${typography.displayImport}, ${typography.bodyImport} } from 'next/font/google'`;

  const displayWeights = JSON.stringify(typography.displayWeights);
  const bodyWeights = JSON.stringify(typography.bodyWeights);

  const fontSetup = isSameFont
    ? `\nconst displayFont = ${typography.displayImport}({\n  subsets: ['latin'],\n  variable: '--font-display',\n  weight: ${displayWeights},\n})\nconst bodyFont = displayFont\n`
    : `\nconst displayFont = ${typography.displayImport}({\n  subsets: ['latin'],\n  variable: '--font-display',\n  weight: ${displayWeights},\n})\nconst bodyFont = ${typography.bodyImport}({\n  subsets: ['latin'],\n  variable: '--font-body',\n  weight: ${bodyWeights},\n})\n`;

  // 1. Replace Geist font imports with custom fonts
  if (/import.*Geist/.test(result) || result.includes("geistSans")) {
    // Remove all Geist-related import lines
    result = result.replace(/import\s*\{[^}]*Geist[^}]*\}\s*from\s*['"]next\/font\/(google|local)['"][;\s]*/g, '');
    // Remove Geist font variable declarations (geistSans, geistMono, etc.)
    result = result.replace(/const\s+geist\w+\s*=\s*\w+\([^)]*\{[\s\S]*?\}\s*\)[;\s]*/g, '');

    // Add the correct font import after the first import or at the top
    const firstImportMatch = result.match(/^(import\s+.+\n)/m);
    if (firstImportMatch) {
      const insertPos = result.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
      result = result.slice(0, insertPos) + fontImport + '\n' + fontSetup + result.slice(insertPos);
    } else {
      result = fontImport + '\n' + fontSetup + result;
    }

    // Replace Geist variable references in className
    result = result.replace(/\$\{geistSans\.variable\}/g, '${displayFont.variable}');
    result = result.replace(/\$\{geistMono\.variable\}/g, '${bodyFont.variable}');
    // Handle other geist variable patterns
    result = result.replace(/geistSans\.variable/g, 'displayFont.variable');
    result = result.replace(/geistMono\.variable/g, 'bodyFont.variable');
  } else if (!result.includes('next/font/google')) {
    // No Google font import at all — add font import and setup at the top
    const firstImportMatch = result.match(/^(import\s+.+\n)/m);
    if (firstImportMatch) {
      const insertPos = result.indexOf(firstImportMatch[0]);
      result = result.slice(0, insertPos) + fontImport + '\n' + fontSetup + result.slice(insertPos);
    } else {
      result = fontImport + '\n' + fontSetup + result;
    }
  }

  // 2. Add globals.css import if missing
  if (!result.includes('./globals.css') && !result.includes("globals.css")) {
    const lastImportIndex = result.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const lineEnd = result.indexOf('\n', lastImportIndex);
      result = result.slice(0, lineEnd + 1) + "import './globals.css'\n" + result.slice(lineEnd + 1);
    }
  }

  return result;
}

/**
 * Generate correct layout.tsx from design tokens and app name.
 */
function generateLayoutTsx(tokens: DesignTokens, appName: string): string {
  const { typography } = tokens;
  const isSameFont = typography.displayImport === typography.bodyImport;

  const fontImport = isSameFont
    ? `import { ${typography.displayImport} } from 'next/font/google'`
    : `import { ${typography.displayImport}, ${typography.bodyImport} } from 'next/font/google'`;

  const displayWeights = JSON.stringify(typography.displayWeights);
  const bodyWeights = JSON.stringify(typography.bodyWeights);

  const fontSetup = isSameFont
    ? `
const displayFont = ${typography.displayImport}({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ${displayWeights},
})
const bodyFont = displayFont`
    : `
const displayFont = ${typography.displayImport}({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ${displayWeights},
})
const bodyFont = ${typography.bodyImport}({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ${bodyWeights},
})`;

  const titleName = appName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return `import type { Metadata } from 'next'
${fontImport}
import './globals.css'
${fontSetup}

export const metadata: Metadata = {
  title: '${titleName}',
  description: '${titleName} - Built with Promptly',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={\`\${displayFont.variable} \${bodyFont.variable}\`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
`;
}

/**
 * Validate and fix design files after coder agent finishes.
 *
 * @param tokens - Pre-extracted design tokens (null if extraction failed)
 * @param appName - App name for layout metadata
 * @param readFile - Function to read a file from sandbox
 * @param writeFile - Function to write a file to sandbox
 * @returns Validation result with list of fixed files
 */
export async function validateAndFixDesign(
  tokens: DesignTokens | null,
  appName: string,
  readFile: (path: string) => Promise<string | null>,
  writeFile: (path: string, content: string) => Promise<void>
): Promise<ValidationResult> {
  const result: ValidationResult = {
    globalsCssValid: false,
    layoutTsxValid: false,
    filesFixed: [],
  };

  // If no tokens were extracted, we can't validate or fix
  if (!tokens) {
    return result;
  }

  // Read current files
  const globalsCss = await readFile("app/globals.css");
  const layoutTsx = await readFile("app/layout.tsx");

  result.globalsCssValid = validateGlobalsCss(globalsCss);
  result.layoutTsxValid = validateLayoutTsx(layoutTsx);

  // Fix globals.css if invalid
  if (!result.globalsCssValid) {
    const correctCss = generateGlobalsCss(tokens);
    await writeFile("app/globals.css", correctCss);
    result.filesFixed.push("app/globals.css");
    console.log("[design-validation] Fixed globals.css with correct design tokens");
  }

  // Fix layout.tsx if invalid
  if (!result.layoutTsxValid) {
    // Use surgical patching if layout exists, full generation as fallback
    const correctLayout = layoutTsx
      ? patchLayoutTsx(layoutTsx, tokens)
      : generateLayoutTsx(tokens, appName);
    await writeFile("app/layout.tsx", correctLayout);
    result.filesFixed.push("app/layout.tsx");
    console.log(
      layoutTsx
        ? "[design-validation] Patched layout.tsx with correct fonts (preserved custom code)"
        : "[design-validation] Generated layout.tsx with correct fonts"
    );
  }

  return result;
}
