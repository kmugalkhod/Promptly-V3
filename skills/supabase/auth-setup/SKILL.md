---
name: auth-setup
description: Configure Supabase authentication with environment variables. Use when adding user authentication to an app.
category: supabase
agents: [coder, chat]
---

## When to Use
- Adding user authentication to an app
- Setting up OAuth providers
- Creating auth-protected routes
- Architecture.md mentions authentication

## Instructions

### Environment Setup

**Create .env.local.example (documentation only):**

```env
# Supabase Configuration
# Get these values from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OAuth Providers (optional - configure in Supabase Dashboard)
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
# NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
```

**⚠️ NEVER create or overwrite `.env.local`** — it's auto-provisioned with real credentials.

### Supabase Client with Auth

**lib/supabase.ts:**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Auth Hook Pattern

```tsx
// hooks/useAuth.ts
'use client'

import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, session, loading }
}
```

### Sign In/Sign Up Patterns

**Email + Password:**

```tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignUp() {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setError('Check your email for the confirmation link!')
    }
    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSignIn} disabled={loading}>
          Sign In
        </button>
        <button onClick={handleSignUp} disabled={loading}>
          Sign Up
        </button>
      </div>
    </div>
  )
}
```

**OAuth (Google, GitHub):**

```tsx
'use client'

import { supabase } from '@/lib/supabase'

export function OAuthButtons() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="space-y-2">
      <button onClick={signInWithGoogle} className="w-full p-2 border rounded">
        Continue with Google
      </button>
      <button onClick={signInWithGitHub} className="w-full p-2 border rounded">
        Continue with GitHub
      </button>
    </div>
  )
}
```

### OAuth Callback Route

**app/auth/callback/route.ts:**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to home page after successful auth
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
```

### Sign Out

```tsx
async function signOut() {
  await supabase.auth.signOut()
  // User state will update via onAuthStateChange listener
}
```

### Protected Route Pattern

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
```

### User Profile Component

```tsx
'use client'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

export function UserProfile() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) {
    return <a href="/login">Sign In</a>
  }

  return (
    <div className="flex items-center gap-4">
      <span>{user.email}</span>
      <button onClick={() => supabase.auth.signOut()}>
        Sign Out
      </button>
    </div>
  )
}
```

### RULES

1. **NEVER create .env.local** — it's auto-provisioned
2. **Always create .env.local.example** — for documentation
3. **Use onAuthStateChange listener** — for reactive auth state
4. **Handle loading state** — don't flash content during auth check
5. **Redirect after OAuth** — use redirectTo option
6. **Store user data in separate table** — don't rely only on auth.users
