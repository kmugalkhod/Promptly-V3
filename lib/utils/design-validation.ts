/**
 * Post-Generation Design Validation
 *
 * After the coder agent finishes, validates that design tokens
 * were actually applied. If not, writes correct files deterministically.
 */

import type { DesignTokens } from "./design-tokens";

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

  // Must contain at least --color-primary with a real hex value
  const hasPrimaryColor = /--color-primary:\s*#[0-9a-fA-F]{3,8}/.test(content);
  // Must not have placeholder patterns
  const hasPlaceholders = /--color-primary:\s*#_{2,}/.test(content);
  // Must have the tailwind import
  const hasTailwindImport = content.includes('@import "tailwindcss"');

  return hasPrimaryColor && !hasPlaceholders && hasTailwindImport;
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
  const { colors, typography } = tokens;
  const light = colors.light;
  const dark = colors.dark;

  return `@import "tailwindcss";

:root {
  --font-display: '${typography.displayFont}', serif;
  --font-body: '${typography.bodyFont}', sans-serif;
  --color-primary: ${light.primary || "#6366f1"};
  --color-accent: ${light.accent || "#f59e0b"};
  --color-background: ${light.background || "#ffffff"};
  --color-surface: ${light.surface || "#f8fafc"};
  --color-text: ${light.text || "#0f172a"};
  --color-muted: ${light.muted || "#64748b"};
}

.dark {
  --color-primary: ${dark.primary || light.primary || "#818cf8"};
  --color-accent: ${dark.accent || light.accent || "#fbbf24"};
  --color-background: ${dark.background || "#0f172a"};
  --color-surface: ${dark.surface || "#1e293b"};
  --color-text: ${dark.text || "#f8fafc"};
  --color-muted: ${dark.muted || "#94a3b8"};
}

@custom-variant dark (&:where(.dark, .dark *));

.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }
`;
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
      <body className="min-h-screen bg-[var(--color-background)] font-body antialiased" suppressHydrationWarning>
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
    const correctLayout = generateLayoutTsx(tokens, appName);
    await writeFile("app/layout.tsx", correctLayout);
    result.filesFixed.push("app/layout.tsx");
    console.log("[design-validation] Fixed layout.tsx with correct fonts");
  }

  return result;
}
