---
name: hydration-safety
description: Prevent SSR/client hydration mismatches. Use when creating components with hooks, state, or browser APIs. CRITICAL for any useState, useEffect, or window access.
category: frontend
agents: [coder, chat]
---

## When to Use
- Creating any component using hooks (useState, useEffect, useRef)
- Accessing browser APIs (window, localStorage, document)
- Using dynamic values in initial render (Date.now, Math.random)
- Building interactive components with event handlers

## Instructions

### HYDRATION SAFETY (ZERO TOLERANCE)

NEVER use these in initial render or useState initializers — they differ server vs client:

| API | Problem | Solution |
|-----|---------|----------|
| `Math.random()` | Different on server/client | Use pre-defined string IDs |
| `Date.now()` | Different timestamp | Use fixed value or useEffect |
| `window.*` | Doesn't exist on server | Wrap in useEffect |
| `localStorage.*` | Doesn't exist on server | Wrap in useEffect |
| `document.*` | Doesn't exist on server | Wrap in useEffect |

### Browser API Access Pattern

```tsx
// ❌ WRONG - hydration error
const width = window.innerWidth
const stored = localStorage.getItem('key')

// ✅ CORRECT - access in useEffect
const [width, setWidth] = useState(0)
const [stored, setStored] = useState<string | null>(null)

useEffect(() => {
  setWidth(window.innerWidth)
  setStored(localStorage.getItem('key'))
}, [])
```

### ID Generation Pattern

```tsx
// ❌ WRONG - hydration error (different IDs on server/client)
const items = data.map(item => ({
  ...item,
  id: Math.random().toString(36)
}))

// ✅ CORRECT - deterministic IDs
const items = data.map((item, index) => ({
  ...item,
  id: `item-${index}`
}))

// ✅ CORRECT - pre-defined IDs
const ITEMS = [
  { id: 'item-1', name: 'First' },
  { id: 'item-2', name: 'Second' },
]
```

### Date Handling Pattern

```tsx
// ❌ WRONG - hydration error
const [timestamp, setTimestamp] = useState(Date.now())

// ✅ CORRECT - initialize empty, set in useEffect
const [timestamp, setTimestamp] = useState<number | null>(null)
useEffect(() => {
  setTimestamp(Date.now())
}, [])

// ✅ CORRECT - use fixed initial value if needed
const [timestamp, setTimestamp] = useState(0)
useEffect(() => {
  setTimestamp(Date.now())
}, [])
```

### Game Cards Pattern (Deterministic)

```tsx
// ❌ WRONG - random shuffling causes hydration error
const cards = [...pairs].sort(() => Math.random() - 0.5)

// ✅ CORRECT - deterministic sort, shuffle in useEffect if needed
const generateCards = () => {
  const pairs = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎺']
  return pairs.flatMap((emoji, i) => [
    { id: `card-${emoji}-a`, emoji, flipped: false, matched: false },
    { id: `card-${emoji}-b`, emoji, flipped: false, matched: false },
  ]).sort((a, b) => a.id.localeCompare(b.id)) // Deterministic sort
}

// If you need shuffling, do it in useEffect:
const [cards, setCards] = useState(generateCards())
useEffect(() => {
  setCards(prev => [...prev].sort(() => Math.random() - 0.5))
}, [])
```

### ThemeToggle Pattern (Hydration-Safe)

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // Only access window after mount
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(prefersDark)
    if (prefersDark) document.documentElement.classList.add('dark')
  }, [])

  const toggle = () => {
    setDark(prev => !prev)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
```

### suppressHydrationWarning Usage

For edge cases where content MUST differ (e.g., timestamps), use suppressHydrationWarning:

```tsx
// Use sparingly - only when difference is intentional
<html lang="en" suppressHydrationWarning>
  <body suppressHydrationWarning>
    {children}
  </body>
</html>
```

### useSyncExternalStore Error

**"getServerSnapshot should be cached" error** means the code uses `useSyncExternalStore` incorrectly. **The fix is to REPLACE the custom store with standard React patterns:**

```tsx
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
```

**When fixing this error:**
1. Remove any useSyncExternalStore imports
2. Remove custom subscribe/getSnapshot/getServerSnapshot functions
3. Replace with useState or Context + useState pattern
4. Update all components using the store to use the new pattern

### Nested Interactive Elements

Never put interactive elements inside each other — this causes hydration mismatches:

```tsx
// ❌ WRONG - nested interactive elements
<a href="/page">
  <button onClick={handleClick}>Click me</button>
</a>

// ❌ WRONG - button wrapping a link
<button>
  <a href="/page">Go to page</a>
</button>

// ✅ CORRECT - use one or the other
<button onClick={() => router.push('/page')}>Go to page</button>

// ✅ CORRECT - style link as button
<a href="/page" className="bg-primary px-4 py-2 rounded">Go to page</a>
```

### RULES CHECKLIST

Before completing any component, verify:
- [ ] No Math.random() in render or useState initializer
- [ ] No Date.now() in render or useState initializer
- [ ] No window/localStorage/document access outside useEffect
- [ ] All array IDs are deterministic (not random)
- [ ] All shuffling/randomization happens in useEffect
- [ ] No useSyncExternalStore (use useState or Context instead)
- [ ] No nested interactive elements (<button> inside <a> or vice versa)
