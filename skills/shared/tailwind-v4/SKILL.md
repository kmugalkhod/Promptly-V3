---
name: tailwind-v4
description: Tailwind CSS v4 patterns — @import syntax, CSS variables, custom variants. CRITICAL — wrong syntax breaks build. Use when writing globals.css, adding styles, or fixing CSS errors.
category: shared
agents: [all]
---

## When to Use
- Writing or modifying globals.css
- Adding CSS variables or design tokens
- Fixing CSS build errors ("@import rules must precede", "is not exported")
- Working with Tailwind utility classes and CSS variables
- Setting up dark mode with custom variants

## Instructions

### Tailwind v4 vs v3 (CRITICAL DIFFERENCES)

This project uses **Tailwind CSS v4**, which is very different from v3:

1. **globals.css MUST start with**: `@import "tailwindcss";` — this is the ONLY import needed
2. **NEVER use v3 syntax**: No `@tailwind base`, `@tailwind components`, `@tailwind utilities`
3. **NEVER use `@import url(...)`** for fonts in CSS — this breaks the build
4. **Load fonts via `next/font/google`** in layout.tsx, NOT via CSS imports
5. **Custom variants**: Use `@custom-variant dark (&:where(.dark, .dark *));` for dark mode

### globals.css Template

```css
@import "tailwindcss";

:root {
  --font-display: 'Font Name', serif;
  --font-body: 'Font Name', sans-serif;
  --color-primary: #hexvalue;
  --color-accent: #hexvalue;
  --color-background: #hexvalue;
  --color-surface: #hexvalue;
  --color-text: #hexvalue;
  --color-muted: #hexvalue;
}

.dark {
  --color-primary: #hexvalue;
  --color-background: #hexvalue;
  --color-text: #hexvalue;
  /* ... dark mode overrides ... */
}

@custom-variant dark (&:where(.dark, .dark *));

.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }
```

### Design System CSS Variables

This app uses CSS custom properties for theming. The key variables are:

- `--color-primary` — brand/accent color for buttons, links, highlights
- `--color-accent` — secondary accent color
- `--color-background` — page background
- `--color-surface` — card/section backgrounds
- `--color-text` — main text color
- `--color-muted` — secondary/subtle text
- `--font-display` — heading font family
- `--font-body` — body text font family

### CSS Variable Usage in Components

```tsx
<div className="min-h-screen bg-[var(--color-background)]">
  <h1 className="font-display text-4xl text-[var(--color-text)]">Title</h1>
  <button className="bg-[var(--color-primary)] text-white">Action</button>
  <p className="text-[var(--color-muted)]">Subtext</p>
  <div className="bg-[var(--color-surface)] rounded-xl p-4">Card</div>
</div>
```

Using CSS variables in Tailwind classes:
```
bg-[var(--color-background)]    — page background
bg-[var(--color-surface)]       — card background
text-[var(--color-text)]        — main text
text-[var(--color-muted)]       — subtle text
text-[var(--color-primary)]     — accent text
bg-[var(--color-primary)]       — accent background
border-[var(--color-primary)]   — accent border
```

**NEVER use bg-white, text-black, bg-gray-*. Always use CSS variables.**

### CSS Build Errors

**"is not exported" or "@import rules must precede all rules"** errors mean:
1. Wrong Tailwind syntax, OR
2. @import url() used incorrectly

**Fix:**
```css
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
```

**Font Loading:** Use `next/font/google` in layout.tsx, NOT @import url() in CSS.

### RULES CHECKLIST

Before completing any CSS file, verify:
- [ ] globals.css starts with `@import "tailwindcss"` as first non-comment line
- [ ] No `@tailwind base/components/utilities` directives (v3 syntax)
- [ ] No `@import url(...)` for font loading in CSS
- [ ] Fonts loaded via `next/font/google` in layout.tsx
- [ ] All colors use CSS variables, not hardcoded values
- [ ] Dark mode uses `@custom-variant dark (&:where(.dark, .dark *));`
- [ ] CSS variables defined in both `:root` and `.dark` blocks
