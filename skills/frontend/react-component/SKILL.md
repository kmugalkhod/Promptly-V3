---
name: react-component
description: Create React/Next.js components with TypeScript. Use when building UI components, defining interfaces, or organizing component files.
category: frontend
agents: [coder, chat]
---

## When to Use
- Creating new UI components
- Defining TypeScript interfaces for props
- Organizing component file structure
- Deciding on component patterns

## Instructions

### Component Structure

```tsx
// components/FeatureCard.tsx
'use client' // Required if using hooks or event handlers

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface FeatureCardProps {
  title: string
  description: string
  icon?: React.ReactNode
  onAction?: () => void
}

export function FeatureCard({ title, description, icon, onAction }: FeatureCardProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        {icon && <div className="mb-2">{icon}</div>}
        <CardTitle className="font-display text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
        {onAction && (
          <button onClick={onAction} className="mt-4 text-primary">
            Learn More
          </button>
        )}
      </CardContent>
    </Card>
  )
}
```

### 'use client' Rules

| Component Has | Needs 'use client' |
|---------------|-------------------|
| useState, useEffect, useRef | YES |
| onClick, onChange, onSubmit | YES |
| useContext with client state | YES |
| Only props + JSX (no hooks) | NO |
| async data fetching (server) | NO |

```tsx
// ❌ Client Component CANNOT be async
'use client'
export default async function Page() { ... } // CRASHES!

// ✅ Server Component CAN be async (no 'use client')
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}

// ✅ Client Component with data fetching
'use client'
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => { fetchData().then(setData) }, [])
  return <div>{data}</div>
}
```

### TypeScript Interface Patterns

```tsx
// Always define explicit interfaces
interface Item {
  id: string
  name: string
  status: "todo" | "in-progress" | "done"
  createdAt: Date
}

// Props with optional fields and defaults
interface ListProps {
  items?: Item[]
  onSelect?: (item: Item) => void
  className?: string
}

// Safe defaults for props
function List({ items = [], onSelect, className }: ListProps) {
  return (
    <ul className={className}>
      {items.map(item => (
        <li key={item.id} onClick={() => onSelect?.(item)}>
          {item.name}
        </li>
      ))}
    </ul>
  )
}
```

### File Creation Order (MANDATORY)

1. **schema.sql** — Database schema (if architecture.md has DATABASE section)
2. **app/globals.css** — CSS variables from DESIGN_DIRECTION
3. **app/layout.tsx** — fonts from typography.pairing
4. **types/index.ts** — shared TypeScript interfaces
5. **lib/** — helper functions (supabase client, etc.)
6. **components/** — reusable app-specific custom components
7. **app/page.tsx and ALL routes** — every route from architecture.md ROUTES

> **PRE-INSTALLED (DO NOT CREATE):** lib/utils.ts and components/ui/*.tsx are pre-installed by shadcn. Just import them.

### Named Exports Pattern

```tsx
// ✅ PREFERRED - named exports
export function Button() { ... }
export function Card() { ... }

// Usage:
import { Button, Card } from '@/components/ui'

// Default export for pages only
export default function HomePage() { ... }
```

### Section Component Pattern (Blueprint-Driven)

```tsx
// components/HeroSection.tsx
'use client'

interface HeroSectionProps {
  headline: string
  subheadline: string
  ctaText: string
  ctaHref: string
}

export function HeroSection({ headline, subheadline, ctaText, ctaHref }: HeroSectionProps) {
  return (
    <section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-background">
      <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground mb-6">
        {headline}
      </h1>
      <p className="text-xl text-muted-foreground max-w-2xl mb-8">
        {subheadline}
      </p>
      <a
        href={ctaHref}
        className="px-8 py-4 bg-primary text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
      >
        {ctaText}
      </a>
    </section>
  )
}
```

### Page Composition Pattern

```tsx
// app/page.tsx
import { HeroSection } from '@/components/HeroSection'
import { FeaturesGrid } from '@/components/FeaturesGrid'

// Deterministic mock data - NEVER empty arrays!
const HERO_DATA = {
  headline: 'Ship Faster',
  subheadline: 'The tool that gets out of your way.',
  ctaText: 'Start Free',
  ctaHref: '#pricing'
}

const FEATURES_DATA = {
  title: 'Features',
  features: [
    { id: '1', title: 'Fast', description: 'Blazing fast performance' },
    { id: '2', title: 'Simple', description: 'Easy to use interface' },
    { id: '3', title: 'Secure', description: 'Enterprise-grade security' },
  ]
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection {...HERO_DATA} />
      <FeaturesGrid {...FEATURES_DATA} />
    </div>
  )
}
```

### RULES CHECKLIST

- [ ] 'use client' added if using hooks/events
- [ ] TypeScript interfaces defined for all props
- [ ] Safe defaults for optional array props (`items = []`)
- [ ] All arrays have unique `key` props when mapping
- [ ] Tailwind theme classes used for colors (bg-primary, text-foreground, etc. — no hardcoded hex)
- [ ] font-display for headings, font-body for text
- [ ] Mock data initialized (NEVER empty arrays in useState)
- [ ] Every route in architecture.md ROUTES section has a corresponding app/**/page.tsx
- [ ] components/ui/ files are pre-installed — do NOT create them, just import
