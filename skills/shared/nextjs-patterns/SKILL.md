---
name: nextjs-patterns
description: Next.js 15+ patterns for fonts, layout.tsx, file creation order, and common imports. Use when creating layout files, loading fonts, or structuring app directory.
category: shared
agents: [all]
---

## When to Use
- Creating or modifying layout.tsx
- Loading fonts with next/font/google
- Setting up app directory structure
- Determining file creation order for a new project
- Using shadcn/ui components or cn utility

## Instructions

### Font Loading (CRITICAL)

- **ALWAYS** load fonts via `next/font/google` in app/layout.tsx
- **NEVER** use `@import url('https://fonts.googleapis.com/...')` in CSS
- Font CSS variables (--font-display, --font-body) are set in globals.css :root
- Use `font-display` and `font-body` classes, or `font-[family-name:var(--font-display)]`

### Font Pairing Reference

| Pairing | Display | Body |
|---------|---------|------|
| editorial | Playfair_Display | Source_Serif_4 |
| brutalist | Space_Mono | Work_Sans |
| playful | Fredoka | Nunito |
| luxury | Cormorant_Garamond | Montserrat |
| retro | Righteous | Poppins |
| geometric | Outfit | Space_Grotesk |
| humanist | Fraunces | Source_Sans_3 |
| minimal | DM_Sans | DM_Sans |
| bold | Bebas_Neue | Open_Sans |
| elegant | Libre_Baskerville | Karla |

### layout.tsx Template

```tsx
import type { Metadata } from 'next'
import { Display_Font, Body_Font } from 'next/font/google'
import './globals.css'

const displayFont = Display_Font({ subsets: ['latin'], variable: '--font-display', weight: ['400', '700'] })
const bodyFont = Body_Font({ subsets: ['latin'], variable: '--font-body', weight: ['400', '600'] })

export const metadata: Metadata = { title: 'APP_NAME', description: 'APP_DESCRIPTION' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
```

### File Creation Order (MANDATORY)

When creating a new project, follow this exact order:

1. **schema.sql** — Database schema (if architecture.md has DATABASE section). MUST be first.
2. **app/globals.css** — CSS variables from DESIGN_DIRECTION
3. **app/layout.tsx** — fonts from typography.pairing
4. **lib/utils.ts** — cn() utility function (required by all UI components)
5. **components/ui/*.tsx** — UI primitives (button, card, input, label, etc.). Only create files for components actually imported by your pages/components.
6. **types/index.ts** — TypeScript types and interfaces (mirror schema.sql columns)
7. **lib/supabase.ts** — Supabase client (if DATABASE section exists)
8. **hooks/** — Custom hooks (e.g., useAuth.ts)
9. **components/** — App-specific React components
10. **app/page.tsx and ALL route pages** — Every route from architecture.md ROUTES section MUST have a corresponding `app/**/page.tsx` file

This order prevents import errors — each file only depends on files created before it.

### Common Imports & Patterns

**'use client' directive:**
- Add `'use client'` at top of any component using hooks (useState, useEffect, etc.) or event handlers
- Server components (no directive) can be async and fetch data directly
- **NEVER combine 'use client' with async** — this crashes the app

**shadcn/ui imports:**
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
```

**cn utility:**
```tsx
import { cn } from "@/lib/utils"

// Usage: conditional classes
<div className={cn("base-classes", condition && "conditional-class")} />
```

**Hydration safety:**
- Never put interactive elements (`<button>`, `<a>`) inside each other
- This causes hydration mismatches

### RULES CHECKLIST

Before completing any layout or app structure, verify:
- [ ] Fonts loaded via `next/font/google`, not CSS @import url()
- [ ] layout.tsx sets font CSS variables on `<html>` element
- [ ] Files created in correct dependency order
- [ ] All interactive components have `'use client'` directive
- [ ] No `'use client'` + async combination
- [ ] shadcn/ui imports use `@/components/ui/` path
- [ ] No nested interactive elements (`<button>` inside `<a>` or vice versa)
- [ ] lib/utils.ts created with cn() before any components/ui/ files
- [ ] Every UI component imported in code has a corresponding components/ui/{name}.tsx file
- [ ] Every route listed in architecture.md ROUTES has a corresponding app/**/page.tsx file
