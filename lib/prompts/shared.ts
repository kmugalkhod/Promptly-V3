/**
 * Shared Prompt Blocks
 *
 * Common error-fix patterns and code rules shared across chat prompt variants
 * and the chat agent's system prompt. Single source of truth.
 */

/**
 * Validate globals.css content before writing.
 * Returns null if valid, or an error message if invalid.
 * Shared by both chat and coder agents.
 */
export function validateGlobalsCss(content: string): string | null {
  const lines = content.split("\n");
  // Find first non-empty, non-comment line
  const firstContentLine = lines.find(
    (line) => line.trim() && !line.trim().startsWith("/*") && !line.trim().startsWith("*") && !line.trim().startsWith("//")
  );

  if (!firstContentLine || !firstContentLine.includes('@import "tailwindcss"')) {
    return `ERROR: globals.css MUST start with '@import "tailwindcss"' as the first non-comment line. Your file starts with: "${firstContentLine?.trim() ?? "(empty)"}". Rewrite the file with '@import "tailwindcss"' as the first line.`;
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

/**
 * Common error fixes for chat agents — useSyncExternalStore and Tailwind v4 CSS errors.
 * Used by: CHAT_PROMPT_WITH_EDIT_SCOPE, SYSTEM_PROMPT in chat agent
 */
export const COMMON_ERROR_FIXES = `## ⚠️ Common Error Fixes

### "getServerSnapshot should be cached" Error
This error means the code uses \`useSyncExternalStore\` incorrectly. **The fix is to REPLACE the custom store with standard React patterns:**

\`\`\`tsx
// ❌ WRONG - causes SSR hydration error
import { useSyncExternalStore } from 'react'
const store = { state: [], listeners: new Set() }
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// ✅ CORRECT - Replace with useState or Context
'use client'
import { useState, createContext, useContext } from 'react'

// Option 1: Simple useState in component
const [items, setItems] = useState(INITIAL_DATA)

// Option 2: Context for shared state
const StoreContext = createContext(null)
export function StoreProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)
  return <StoreContext.Provider value={{ state, setState }}>{children}</StoreContext.Provider>
}
export function useStore() {
  return useContext(StoreContext)
}
\`\`\`

**When fixing this error:**
1. Remove any useSyncExternalStore imports
2. Remove custom subscribe/getSnapshot/getServerSnapshot functions
3. Replace with useState or Context + useState pattern
4. Update all components using the store to use the new pattern

### CSS Build Errors (Tailwind v4)

**"is not exported" or "@import rules must precede all rules"** errors mean:
1. Wrong Tailwind syntax, OR
2. @import url() used incorrectly

**Fix:**
\`\`\`css
/* ❌ WRONG - old v3 syntax */
@import "tailwindcss/base";
@import "tailwindcss/components";
@import "tailwindcss/utilities";

/* ❌ WRONG - font @import after tailwind */
@import "tailwindcss";
/* ...tailwind expands here... */
@import url('https://fonts.googleapis.com/...');

/* ✅ CORRECT - only this ONE import */
@import "tailwindcss";

:root {
  /* CSS variables here */
}
\`\`\`

**Font Loading:** Use \`next/font/google\` in layout.tsx, NOT @import url() in CSS.`;

/**
 * Tailwind v4 CSS rules for the chat agent system prompt.
 * Used by: SYSTEM_PROMPT in lib/agents/chat.ts
 */
export const TAILWIND_V4_RULES = `## Tailwind v4 CSS Rules (CRITICAL)

This project uses **Tailwind CSS v4**, which is very different from v3:

1. **globals.css MUST start with**: \`@import "tailwindcss";\` — this is the ONLY import needed
2. **NEVER use v3 syntax**: No \`@tailwind base\`, \`@tailwind components\`, \`@tailwind utilities\`
3. **NEVER use \`@import url(...)\`** for fonts in CSS — this breaks the build
4. **Load fonts via \`next/font/google\`** in layout.tsx, NOT via CSS imports
5. **Custom variants**: Use \`@custom-variant dark (&:where(.dark, .dark *));\` for dark mode

### Correct globals.css structure:
\`\`\`css
@import "tailwindcss";

:root {
  --font-display: 'Font Name', serif;
  --font-body: 'Font Name', sans-serif;
  --color-primary: #hexvalue;
  --color-background: #hexvalue;
  --color-text: #hexvalue;
  /* ... more CSS variables ... */
}

.dark {
  --color-primary: #hexvalue;
  --color-background: #hexvalue;
  --color-text: #hexvalue;
}

@custom-variant dark (&:where(.dark, .dark *));
\`\`\``;

/**
 * Font loading rules.
 * Used by: SYSTEM_PROMPT in lib/agents/chat.ts
 */
export const FONT_RULES = `## Font Rules

- **ALWAYS** load fonts via \`next/font/google\` in app/layout.tsx
- **NEVER** use \`@import url('https://fonts.googleapis.com/...')\` in CSS
- Font CSS variables (--font-display, --font-body) are set in globals.css :root
- Use \`font-display\` and \`font-body\` classes, or \`font-[family-name:var(--font-display)]\``;

/**
 * Design system CSS variable reference.
 * Used by: SYSTEM_PROMPT in lib/agents/chat.ts
 */
export const DESIGN_SYSTEM_VARS = `## Design System — CSS Variables

This app uses CSS custom properties for theming. The key variables are:

- \`--color-primary\` — brand/accent color for buttons, links, highlights
- \`--color-accent\` — secondary accent color
- \`--color-background\` — page background
- \`--color-surface\` — card/section backgrounds
- \`--color-text\` — main text color
- \`--color-muted\` — secondary/subtle text
- \`--font-display\` — heading font family
- \`--font-body\` — body text font family

### Using CSS variables in Tailwind classes:
\`\`\`
bg-[var(--color-background)]    — page background
bg-[var(--color-surface)]       — card background
text-[var(--color-text)]        — main text
text-[var(--color-muted)]       — subtle text
text-[var(--color-primary)]     — accent text
bg-[var(--color-primary)]       — accent background
border-[var(--color-primary)]   — accent border
\`\`\``;

/**
 * Common code patterns for the chat agent.
 * Used by: SYSTEM_PROMPT in lib/agents/chat.ts
 */
export const COMMON_CODE_RULES = `## Common Patterns

- Add \`'use client'\` at top of any component using hooks (useState, useEffect, etc.) or event handlers
- Import shadcn/ui: \`import { Button } from "@/components/ui/button"\`
- Import cn utility: \`import { cn } from "@/lib/utils"\`
- Hydration: never put interactive elements (<button>, <a>) inside each other`;
