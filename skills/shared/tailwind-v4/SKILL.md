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

### Tailwind v4 Opacity Syntax (CRITICAL)

Tailwind v4 removed separate opacity utilities. Use **slash syntax**:

| v3 (WRONG — will error) | v4 (CORRECT) |
|--------------------------|--------------|
| `bg-black bg-opacity-50` | `bg-black/50` |
| `text-white text-opacity-75` | `text-white/75` |
| `border-gray-300 border-opacity-50` | `border-gray-300/50` |
| `bg-primary bg-opacity-20` | `bg-primary/20` |

**NEVER use `bg-opacity-*`, `text-opacity-*`, or `border-opacity-*`** — these do not exist in v4.

### globals.css Template (shadcn + Tailwind v4)

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --font-display: 'Font Name', serif;
  --font-body: 'Font Name', sans-serif;
  --radius: 0.5rem;
  --background: #ffffff;
  --foreground: #0f172a;
  --card: #f8fafc;
  --card-foreground: #0f172a;
  --popover: #f8fafc;
  --popover-foreground: #0f172a;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f59e0b;
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #6366f1;
}

.dark {
  --background: #0f172a;
  --foreground: #f8fafc;
  /* ... dark mode overrides for all variables ... */
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
}
```

### Design System CSS Variables

This app uses shadcn's native CSS variable system. The key variables are:

- `--primary` — brand/accent color for buttons, links, highlights
- `--accent` — secondary accent color
- `--background` — page background
- `--card` — card/section backgrounds (previously `--color-surface`)
- `--foreground` — main text color (previously `--color-text`)
- `--muted-foreground` — secondary/subtle text (previously `--color-muted`)
- `--font-display` / `--font-body` — fonts stay the same

### Tailwind Theme Class Usage in Components

```tsx
<div className="min-h-screen bg-background">
  <h1 className="font-display text-4xl text-foreground">Title</h1>
  <button className="bg-primary text-primary-foreground">Action</button>
  <p className="text-muted-foreground">Subtext</p>
  <div className="bg-card rounded-xl p-4">Card</div>
</div>
```

Tailwind theme classes reference:
```
bg-background          — page background
bg-card                — card background
text-foreground        — main text
text-muted-foreground  — subtle text
text-primary           — accent text
bg-primary             — accent background
border-border          — default border
border-primary         — accent border
```

**NEVER use bg-white, text-black, bg-gray-*. Always use Tailwind theme classes.**

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
- [ ] No v3 opacity utilities (`bg-opacity-*`, `text-opacity-*`) — use slash syntax (`bg-black/50`)
