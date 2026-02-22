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

Auth apps use the SAME two-file client setup as the `database-queries` skill:

**lib/supabase/client.ts** — for Client Components ('use client'):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**lib/supabase/server.ts** — for Server Components, Route Handlers, Server Actions:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Components can't write cookies — middleware handles it */ }
        },
      },
    }
  )
}
```

### Auth Hook Pattern

```tsx
// hooks/useAuth.ts
'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial user — use getUser() NOT getSession()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
```

### Sign In/Sign Up Patterns

**Email + Password:**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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

import { createClient } from '@/lib/supabase/client'

export function OAuthButtons() {
  const supabase = createClient()

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

**app/auth/callback/route.ts** — MUST use server client (cookies required for session):

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### Middleware (REQUIRED for Auth Apps)

Create `middleware.ts` in the project root. This refreshes expired auth tokens on every request — without it, users get randomly logged out.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Do NOT run any code between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth') && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### User Profiles Table (REQUIRED)

The `auth.users` table is NOT accessible via PostgREST. Create a `profiles` table in schema.sql for any user data you need in queries:

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  display_name text,
  avatar_url text,
  email text
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles') THEN
  CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
END IF; END $$;

-- Users can update their own profile
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users update own profile') THEN
  CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id);
END IF; END $$;

-- Users can insert their own profile
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users insert own profile') THEN
  CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
END IF; END $$;
```

Use this table for all joins where you need user info (display name, avatar, etc.) instead of trying to join `auth.users`.

### Sign Out

```tsx
import { createClient } from '@/lib/supabase/client'

async function signOut() {
  const supabase = createClient()
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
import { createClient } from '@/lib/supabase/client'

export function UserProfile() {
  const { user, loading } = useAuth()
  const supabase = createClient()

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
7. **ALWAYS use getUser(), NEVER getSession()** — getSession() doesn't revalidate the auth token on the server
8. **Create middleware.ts** for every auth app — refreshes tokens, protects routes
9. **Create profiles table** in schema.sql — auth.users is NOT queryable via PostgREST
10. **NEVER put code between createServerClient and getUser()** in middleware — causes random logouts
11. **Cookie methods: ONLY use getAll/setAll** — never use individual get/set/remove
