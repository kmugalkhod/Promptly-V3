/**
 * Design Token Extractor
 *
 * Parses DESIGN_DIRECTION from architecture text and produces
 * ready-to-paste CSS and TSX code blocks for the coder agent.
 */

import { FONT_PAIRINGS } from "../prompts/design-skill";

/** A single section in a page blueprint */
export interface BlueprintSection {
  type: string;
  component: string;
  data: string; // Raw data contract string from architecture
}

/** Blueprint for a single route/page */
export interface PageBlueprint {
  route: string;
  sections: BlueprintSection[];
  flow: string;
}

/** Extracted design tokens from architecture */
export interface DesignTokens {
  aesthetic: string;
  colors: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  typography: {
    pairing: string;
    displayFont: string;
    bodyFont: string;
    displayImport: string;
    bodyImport: string;
    displayWeights: string[];
    bodyWeights: string[];
  };
  motionLevel: string;
  spacingScale: string;
  shadowSystem: string;
  radiusSystem: string;
  blueprints?: PageBlueprint[];
}

const COLOR_KEYS = ["primary", "accent", "background", "surface", "text", "muted"] as const;

/**
 * Extract a YAML-like value after a key from architecture text.
 */
function extractValue(text: string, key: string): string | null {
  // Match "key: value" or "key: "value""
  const regex = new RegExp(`${key}:\\s*["']?([^"'\\n]+)["']?`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract hex color values from a section of architecture text.
 */
function extractColors(text: string, section: "light" | "dark"): Record<string, string> {
  const colors: Record<string, string> = {};

  // Find the section (light: or dark:) within color_scheme
  const sectionRegex = new RegExp(
    `${section}:\\s*\\n((?:\\s+\\w+:\\s*["']?#[0-9a-fA-F]{3,8}["']?.*\\n?)+)`,
    "i"
  );
  const sectionMatch = text.match(sectionRegex);

  if (sectionMatch) {
    const sectionText = sectionMatch[1];
    for (const key of COLOR_KEYS) {
      const colorRegex = new RegExp(`${key}:\\s*["']?(#[0-9a-fA-F]{3,8})["']?`, "i");
      const colorMatch = sectionText.match(colorRegex);
      if (colorMatch) {
        colors[key] = colorMatch[1];
      }
    }
  }

  // Fallback: try to find colors anywhere in the text near the section keyword
  if (Object.keys(colors).length === 0) {
    for (const key of COLOR_KEYS) {
      const colorRegex = new RegExp(`${key}:\\s*["']?(#[0-9a-fA-F]{3,8})["']?`, "gi");
      const allMatches = [...text.matchAll(colorRegex)];
      if (allMatches.length > 0) {
        // For light, take first match; for dark, take last if multiple
        const idx = section === "dark" && allMatches.length > 1 ? allMatches.length - 1 : 0;
        colors[key] = allMatches[idx][1];
      }
    }
  }

  return colors;
}

/**
 * Convert a font name to a valid Next.js import name.
 * "Playfair Display" -> "Playfair_Display"
 * "Source Serif 4" -> "Source_Serif_4"
 */
function fontToImportName(fontName: string): string {
  return fontName.replace(/\s+/g, "_");
}

/**
 * Extract PAGE_BLUEPRINT sections from architecture text.
 * Returns empty array if no blueprint found.
 */
export function extractPageBlueprints(architecture: string): PageBlueprint[] {
  if (!architecture.includes("PAGE_BLUEPRINT")) {
    return [];
  }

  const blueprints: PageBlueprint[] = [];

  // Find the PAGE_BLUEPRINT section
  const blueprintMatch = architecture.match(
    /PAGE_BLUEPRINT:.*?\n([\s\S]*?)(?=\n(?:ROUTES|COMPONENTS|PACKAGES|DATABASE):|$)/i
  );
  if (!blueprintMatch) return [];

  const blueprintText = blueprintMatch[1];

  // Extract each route blueprint (lines starting with /path:)
  const routeRegex = /^\s{2}(\/\S*):\s*\n([\s\S]*?)(?=\n\s{2}\/\S*:|$)/gm;
  let routeMatch;

  while ((routeMatch = routeRegex.exec(blueprintText)) !== null) {
    const route = routeMatch[1];
    const routeBody = routeMatch[2];

    // Extract sections
    const sections: BlueprintSection[] = [];
    const sectionRegex = /- type:\s*(\S+).*?\n\s+component:\s*(\S+).*?\n\s+data:\s*(.+)/g;
    let sectionMatch;

    while ((sectionMatch = sectionRegex.exec(routeBody)) !== null) {
      sections.push({
        type: sectionMatch[1],
        component: sectionMatch[2],
        data: sectionMatch[3].trim(),
      });
    }

    // Extract flow
    const flowMatch = routeBody.match(/flow:\s*["']?([^"'\n]+)["']?/i);
    const flow = flowMatch ? flowMatch[1].trim() : "";

    if (sections.length > 0) {
      blueprints.push({ route, sections, flow });
    }
  }

  return blueprints;
}

/**
 * Format extracted blueprints as instructions for the coder agent.
 */
export function formatBlueprintForCoder(blueprints: PageBlueprint[]): string {
  if (blueprints.length === 0) return "";

  let output = `## PAGE BLUEPRINT (implement sections in this order)\n\n`;

  for (const bp of blueprints) {
    output += `### Route: ${bp.route}\n`;
    output += `**Flow**: ${bp.flow}\n\n`;
    output += `| # | Section Type | Component | Data Contract |\n`;
    output += `|---|-------------|-----------|---------------|\n`;

    bp.sections.forEach((s, i) => {
      output += `| ${i + 1} | ${s.type} | ${s.component} | ${s.data} |\n`;
    });

    output += `\n**Implementation order**: Create each component file in section order, then compose in page.tsx.\n\n`;
  }

  return output;
}

/**
 * Parse design tokens from architecture text.
 * Returns null if DESIGN_DIRECTION is not found or unparseable.
 */
export function extractDesignTokens(architecture: string): DesignTokens | null {
  // Check if DESIGN_DIRECTION exists
  if (!architecture.includes("DESIGN_DIRECTION")) {
    return null;
  }

  // Extract aesthetic
  const aesthetic = extractValue(architecture, "aesthetic") || "minimal";

  // Extract typography pairing
  const pairing = extractValue(architecture, "pairing") || "minimal";
  const pairingKey = pairing.toLowerCase().trim() as keyof typeof FONT_PAIRINGS;
  const fontPairing = FONT_PAIRINGS[pairingKey] || FONT_PAIRINGS.minimal;

  // Extract colors
  const lightColors = extractColors(architecture, "light");
  const darkColors = extractColors(architecture, "dark");

  // Need at least primary color to consider extraction successful
  if (!lightColors.primary) {
    return null;
  }

  // Extract motion, spacing, shadow, radius
  const motionLevel = extractValue(architecture, "motion_level") || "subtle";
  const spacingScale = extractValue(architecture, "spacing_scale") || "normal";
  const shadowSystem = extractValue(architecture, "shadow_system") || "subtle";
  const radiusSystem = extractValue(architecture, "radius_system") || "rounded";

  // Parse font weights
  const displayWeights = fontPairing.weights.display.split(";");
  const bodyWeights = fontPairing.weights.body.split(";");

  // Extract page blueprints (optional, for complex pages)
  const blueprints = extractPageBlueprints(architecture);

  return {
    aesthetic,
    colors: {
      light: lightColors,
      dark: darkColors,
    },
    typography: {
      pairing: pairingKey,
      displayFont: fontPairing.display,
      bodyFont: fontPairing.body,
      displayImport: fontToImportName(fontPairing.display),
      bodyImport: fontToImportName(fontPairing.body),
      displayWeights,
      bodyWeights,
    },
    motionLevel,
    spacingScale,
    shadowSystem,
    radiusSystem,
    ...(blueprints.length > 0 ? { blueprints } : {}),
  };
}

// ============================================================================
// Color utility functions for shadcn theme variable derivation
// ============================================================================

/** Convert 3 or 6 digit hex to normalized 6-digit hex */
export function normalizeHex(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return "#" + h.toLowerCase();
}

/** Convert hex to relative luminance (WCAG 2.0) */
function hexToLuminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Choose white or dark foreground for best contrast against bgHex */
export function contrastForeground(bgHex: string): string {
  return hexToLuminance(bgHex) > 0.4 ? "#0f172a" : "#ffffff";
}

/** Blend two hex colors. ratio=0 → colorA, ratio=1 → colorB */
export function blendHex(colorA: string, colorB: string, ratio: number): string {
  const a = normalizeHex(colorA);
  const b = normalizeHex(colorB);
  const r = Math.min(255, Math.max(0, Math.round(parseInt(a.slice(1, 3), 16) * (1 - ratio) + parseInt(b.slice(1, 3), 16) * ratio)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(a.slice(3, 5), 16) * (1 - ratio) + parseInt(b.slice(3, 5), 16) * ratio)));
  const bl = Math.min(255, Math.max(0, Math.round(parseInt(a.slice(5, 7), 16) * (1 - ratio) + parseInt(b.slice(5, 7), 16) * ratio)));
  return "#" + [r, g, bl].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** Map radiusSystem name to CSS value */
export function radiusSystemToValue(radiusSystem: string): string {
  const map: Record<string, string> = {
    sharp: "0rem",
    subtle: "0.375rem",
    rounded: "0.5rem",
    pill: "9999px",
  };
  return map[radiusSystem] || "0.5rem";
}

/**
 * Build the full shadcn-compatible globals.css content from design tokens.
 * Uses bare variable names in :root/.dark + @theme inline mapping for Tailwind v4.
 */
export function buildShadcnGlobalsCss(tokens: DesignTokens): string {
  const { colors, typography } = tokens;
  const light = colors.light;
  const dark = colors.dark;

  // Resolve 6 architecture colors with fallbacks
  const lPrimary = light.primary || "#6366f1";
  const lAccent = light.accent || "#f59e0b";
  const lBackground = light.background || "#ffffff";
  const lSurface = light.surface || "#f8fafc";
  const lText = light.text || "#0f172a";
  const lMuted = light.muted || "#64748b";

  const dPrimary = dark.primary || lPrimary;
  const dAccent = dark.accent || lAccent;
  const dBackground = dark.background || "#0f172a";
  const dSurface = dark.surface || "#1e293b";
  const dText = dark.text || "#f8fafc";
  const dMuted = dark.muted || "#94a3b8";

  // Derive ~20 shadcn variables from 6 architecture colors
  const lSecondary = blendHex(lSurface, lBackground, 0.5);
  const lMutedBg = blendHex(lBackground, lSurface, 0.3);
  const lBorder = blendHex(lSurface, lMuted, 0.3);

  const dSecondary = blendHex(dSurface, dBackground, 0.5);
  const dMutedBg = blendHex(dBackground, dSurface, 0.3);
  const dBorder = blendHex(dSurface, dMuted, 0.3);

  const radius = radiusSystemToValue(tokens.radiusSystem);

  return `@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --font-display: '${typography.displayFont}', serif;
  --font-body: '${typography.bodyFont}', sans-serif;
  --radius: ${radius};
  --background: ${lBackground};
  --foreground: ${lText};
  --card: ${lSurface};
  --card-foreground: ${lText};
  --popover: ${lSurface};
  --popover-foreground: ${lText};
  --primary: ${lPrimary};
  --primary-foreground: ${contrastForeground(lPrimary)};
  --secondary: ${lSecondary};
  --secondary-foreground: ${lText};
  --muted: ${lMutedBg};
  --muted-foreground: ${lMuted};
  --accent: ${lAccent};
  --accent-foreground: ${contrastForeground(lAccent)};
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: ${lBorder};
  --input: ${lBorder};
  --ring: ${lPrimary};
}

.dark {
  --background: ${dBackground};
  --foreground: ${dText};
  --card: ${dSurface};
  --card-foreground: ${dText};
  --popover: ${dSurface};
  --popover-foreground: ${dText};
  --primary: ${dPrimary};
  --primary-foreground: ${contrastForeground(dPrimary)};
  --secondary: ${dSecondary};
  --secondary-foreground: ${dText};
  --muted: ${dMutedBg};
  --muted-foreground: ${dMuted};
  --accent: ${dAccent};
  --accent-foreground: ${contrastForeground(dAccent)};
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: ${dBorder};
  --input: ${dBorder};
  --ring: ${dPrimary};
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }

@layer base {
  body {
    @apply bg-background text-foreground;
  }
}`;
}

/**
 * Format extracted design tokens as ready-to-paste code blocks
 * that the coder agent can copy directly.
 */
export function formatDesignTokensForCoder(tokens: DesignTokens): string {
  const { typography } = tokens;
  const light = tokens.colors.light;

  const globalsCss = buildShadcnGlobalsCss(tokens);

  // Build layout.tsx font imports
  const isSameFont = typography.displayImport === typography.bodyImport;
  const fontImports = isSameFont
    ? `import { ${typography.displayImport} } from 'next/font/google'`
    : `import { ${typography.displayImport}, ${typography.bodyImport} } from 'next/font/google'`;

  const displayWeightsStr = JSON.stringify(typography.displayWeights);
  const bodyWeightsStr = JSON.stringify(typography.bodyWeights);

  const fontSetup = isSameFont
    ? `const displayFont = ${typography.displayImport}({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ${displayWeightsStr},
})
const bodyFont = displayFont`
    : `const displayFont = ${typography.displayImport}({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ${displayWeightsStr},
})
const bodyFont = ${typography.bodyImport}({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ${bodyWeightsStr},
})`;

  const base = `## READY-TO-USE DESIGN CODE (COPY EXACTLY)

### 1. app/globals.css (CREATE THIS FILE):
\`\`\`css
${globalsCss}
\`\`\`

### 2. Font setup for app/layout.tsx (USE THESE IMPORTS):
\`\`\`tsx
${fontImports}

${fontSetup}

// In the <html> tag:
// className={\`\${displayFont.variable} \${bodyFont.variable}\`}
// In the <body> tag:
// className="min-h-screen bg-background font-body antialiased"
\`\`\`

### 3. Design tokens summary:
- Aesthetic: ${tokens.aesthetic}
- Display font: ${typography.displayFont}
- Body font: ${typography.bodyFont}
- Motion: ${tokens.motionLevel}
- Shadows: ${tokens.shadowSystem}
- Radius: ${tokens.radiusSystem}
- Primary color: ${light.primary}
- Accent color: ${light.accent || "N/A"}
- Use Tailwind theme classes: bg-primary, text-foreground, bg-card, text-muted-foreground, etc.`;

  const blueprintBlock = tokens.blueprints ? formatBlueprintForCoder(tokens.blueprints) : "";
  return blueprintBlock ? `${base}\n\n${blueprintBlock}` : base;
}
