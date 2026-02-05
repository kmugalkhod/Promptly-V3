---
name: client-server
description: Decide between 'use client' and server components. CRITICAL - async + 'use client' = CRASH. Use when choosing component type or using dynamic imports.
category: frontend
agents: [coder, chat]
---

## When to Use
- Deciding if a component needs 'use client'
- Creating async data-fetching components
- Using dynamic imports with { ssr: false }
- Fixing "async client component" crashes

## Instructions

### ⚠️ CRITICAL RULE: async + 'use client' = CRASH

```tsx
// ❌ CRASHES! Client Components CANNOT be async
'use client'
export default async function Page() {
  const data = await fetchData() // This crashes the app!
  return <div>{data}</div>
}
```

### Component Type Decision Table

| Component Has | Needs 'use client' | Can Be async |
|---------------|-------------------|--------------|
| useState, useEffect, useRef | YES | NO |
| onClick, onChange, onSubmit | YES | NO |
| Browser APIs (window, localStorage) | YES | NO |
| Only props + JSX (no hooks) | NO | YES |
| await/fetch calls | NO | YES |
| useContext with client state | YES | NO |

### Server Component (Default - No Directive)

Server components are the default. They can be async and fetch data directly:

```tsx
// app/products/page.tsx
// No 'use client' = Server Component (default)

async function getProducts() {
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div className="grid grid-cols-3 gap-6">
      {products.map((product) => (
        <div key={product.id} className="p-4 bg-[var(--color-surface)] rounded-lg">
          <h2>{product.name}</h2>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  )
}
```

### Client Component (With Interactivity)

Add 'use client' for any interactive functionality:

```tsx
// components/Counter.tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

### Client Component with Data Fetching

Client components fetch data with useEffect:

```tsx
// components/UserProfile.tsx
'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
}

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      const res = await fetch(`/api/users/${userId}`)
      const data = await res.json()
      setUser(data)
      setLoading(false)
    }
    fetchUser()
  }, [userId])

  if (loading) return <div>Loading...</div>
  if (!user) return <div>User not found</div>

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### Dynamic Import with { ssr: false }

For client-only packages that access browser APIs:

```tsx
// app/game/page.tsx
'use client'

import dynamic from 'next/dynamic'

// These packages access browser APIs and cannot run on server:
// phaser, pixi.js, three, @react-three/fiber, gsap, react-leaflet

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <div>Loading game...</div>
})

export default function GamePage() {
  return (
    <div className="min-h-screen">
      <h1>Game</h1>
      <Game />
    </div>
  )
}
```

### Dynamic Routes (await params)

Next.js 15+ requires awaiting params in async components:

```tsx
// app/posts/[id]/page.tsx
// Server Component - can be async

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: Props) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### Mixing Server and Client Components

Server components can import and render client components:

```tsx
// app/dashboard/page.tsx (Server Component)
import { DashboardStats } from '@/components/DashboardStats' // Client Component

async function getStats() {
  const res = await fetch('/api/stats')
  return res.json()
}

export default async function DashboardPage() {
  const initialStats = await getStats()

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Pass server-fetched data to client component */}
      <DashboardStats initialStats={initialStats} />
    </div>
  )
}
```

```tsx
// components/DashboardStats.tsx (Client Component)
'use client'

import { useState, useEffect } from 'react'

interface Stats {
  users: number
  revenue: number
}

export function DashboardStats({ initialStats }: { initialStats: Stats }) {
  const [stats, setStats] = useState(initialStats)

  useEffect(() => {
    // Optional: Poll for updates
    const interval = setInterval(async () => {
      const res = await fetch('/api/stats')
      const newStats = await res.json()
      setStats(newStats)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 bg-[var(--color-surface)] rounded-lg">
        <p className="text-[var(--color-muted)]">Users</p>
        <p className="text-2xl font-bold">{stats.users}</p>
      </div>
      <div className="p-4 bg-[var(--color-surface)] rounded-lg">
        <p className="text-[var(--color-muted)]">Revenue</p>
        <p className="text-2xl font-bold">${stats.revenue}</p>
      </div>
    </div>
  )
}
```

### SSR-Safe vs Client-Only Packages

**SSR-Safe (import normally):**
- recharts, @tremor/react, framer-motion
- react-hook-form, zod, zustand
- @tanstack/react-query, date-fns
- react-markdown, @supabase/supabase-js

**Client-Only (need dynamic import with ssr: false):**
- phaser, pixi.js, three, @react-three/fiber
- gsap, react-leaflet

### RULES

1. **'use client' + async = CRASH** — never combine them
2. **Server Components are default** — no directive needed
3. **Add 'use client' for interactivity** — hooks, event handlers
4. **Use dynamic import for browser-only packages** — with ssr: false
5. **Server fetches data, client renders interactivity** — pass data as props
6. **await params in dynamic routes** — Next.js 15+ requirement
