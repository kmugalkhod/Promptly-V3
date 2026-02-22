---
name: database-queries
description: Implement Supabase database CRUD operations. Use when architecture.md has DATABASE section. Includes client setup and data fetching patterns.
category: supabase
agents: [coder, chat]
---

## When to Use
- Architecture.md has a DATABASE section
- Creating, reading, updating, or deleting data
- Setting up Supabase client
- Fetching data in components

## Instructions

### Prerequisites

Only use Supabase when architecture.md has a DATABASE section.

### CRITICAL — schema.sql Generation

⚠️ **MANDATORY**: When architecture.md has a DATABASE section, you MUST create `schema.sql` in the project root BEFORE any component files.

- **schema.sql is the PRIMARY deliverable** — without it, the auto-execution pipeline has nothing to execute and the database will be empty. All CRUD operations will fail silently.
- **Create schema.sql BEFORE `lib/supabase/client.ts`** — the schema defines what the client will query.
- **Every table in the DATABASE section** MUST have a corresponding `CREATE TABLE IF NOT EXISTS` statement in schema.sql.

### File Setup

⚠️ **CRITICAL: NEVER hardcode Supabase URL or anon key.** The URL and key MUST come from environment variables. NEVER use string literals like `'https://xxx.supabase.co'` or paste actual keys.

**1. lib/supabase/client.ts — for Client Components ('use client'):**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**2. lib/supabase/server.ts — for Server Components, Route Handlers, Server Actions:**

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

**Usage in components:**
```typescript
// In 'use client' components:
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// In server components, route handlers, server actions:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

**3. .env.local.example - Template (documentation only):**

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**⚠️ DO NOT create or overwrite `.env.local`** — it's auto-provisioned with real credentials.

### CRUD Patterns

**SELECT (Read):**

```typescript
// Get all rows
const { data, error } = await supabase
  .from('todos')
  .select('*')
  .order('created_at', { ascending: false })

// Get single row
const { data, error } = await supabase
  .from('todos')
  .select('*')
  .eq('id', todoId)
  .single()

// Select specific columns
const { data, error } = await supabase
  .from('todos')
  .select('id, title, completed')

// Filter with conditions
const { data, error } = await supabase
  .from('todos')
  .select('*')
  .eq('completed', false)
  .order('created_at', { ascending: false })
  .limit(10)
```

**INSERT (Create):**

```typescript
// Insert single row
const { data, error } = await supabase
  .from('todos')
  .insert({ text: 'New todo', completed: false })
  .select()

// Insert multiple rows
const { data, error } = await supabase
  .from('todos')
  .insert([
    { text: 'Todo 1', completed: false },
    { text: 'Todo 2', completed: false },
  ])
  .select()
```

**UPDATE:**

```typescript
// Update single row
const { data, error } = await supabase
  .from('todos')
  .update({ completed: true })
  .eq('id', todoId)
  .select()

// Update multiple rows
const { data, error } = await supabase
  .from('todos')
  .update({ completed: true })
  .in('id', ['id1', 'id2', 'id3'])
  .select()
```

**DELETE:**

```typescript
// Delete single row
const { error } = await supabase
  .from('todos')
  .delete()
  .eq('id', todoId)

// Delete multiple rows
const { error } = await supabase
  .from('todos')
  .delete()
  .in('id', ['id1', 'id2', 'id3'])
```

> DELETE operations require a matching DELETE RLS policy on the table. If delete fails silently, check that a DELETE policy exists in schema.sql.

### Relationship Queries (Foreign Key JOINs)

When schema.sql has foreign keys, use PostgREST embedded select syntax to fetch related data in a single query:

```typescript
// ❌ NEVER JOIN auth.users — the auth schema is NOT accessible via PostgREST REST API
// assignee:assignee_id (id, email)  ← THIS WILL ALWAYS RETURN NULL
// reporter:reporter_id (id, email, raw_user_meta_data)  ← THIS WILL ALSO RETURN NULL

// ✅ Instead, create a `profiles` table in public schema (see auth-setup skill)
// Then join profiles:

// Fetch projects WITH their workspace data
// FK: projects.workspace_id -> workspaces.id
const { data, error } = await supabase
  .from('projects')
  .select(`
    *,
    workspace:workspace_id (id, name, slug)
  `)

// Fetch issues WITH assignee (from profiles table) and project info
// FK: issues.assignee_id -> profiles.id, issues.project_id -> projects.id
const { data, error } = await supabase
  .from('issues')
  .select(`
    *,
    assignee:assignee_id (id, display_name, avatar_url),
    project:project_id (id, name)
  `)
  .eq('project_id', projectId)
  .order('created_at', { ascending: false })

// Fetch single item with all relationships
const { data, error } = await supabase
  .from('issues')
  .select(`
    *,
    assignee:assignee_id (id, display_name, avatar_url),
    reporter:reporter_id (id, display_name, avatar_url),
    project:project_id (id, name)
  `)
  .eq('id', issueId)
  .single()
```

**Syntax: `alias:fk_column (columns)`**
- `alias` — the field name in the returned object (e.g., `workspace`)
- `fk_column` — the foreign key column on the current table (e.g., `workspace_id`)
- `(columns)` — which columns to select from the related table

**TypeScript interfaces for relationship data:**

```typescript
// In types/index.ts — add optional fields for embedded relations
interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  email: string | null
}

interface Project {
  id: string
  created_at: string
  workspace_id: string         // FK column (always present)
  name: string
  // ... other direct columns
  workspace?: Workspace        // Embedded data (present when selected with select())
}

interface Issue {
  id: string
  created_at: string
  project_id: string
  assignee_id: string | null
  // ... other direct columns
  project?: Project            // Embedded relation
  assignee?: Profile           // From profiles table (NOT auth.users)
}
```

> **Rule**: Use embedded selects instead of separate queries. One `.select('*, relation:fk(cols)')` is faster and simpler than two sequential fetches.

### Data Fetching in Components

Use 'use client' + useState + useEffect for fetching:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Todo {
  id: string
  text: string
  completed: boolean
  created_at: string
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTodos()
  }, [])

  async function fetchTodos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setTodos(data || [])
    }
    setLoading(false)
  }

  async function addTodo(text: string) {
    const { data, error } = await supabase
      .from('todos')
      .insert({ text, completed: false })
      .select()

    if (!error && data) {
      setTodos([data[0], ...todos])
    }
  }

  async function toggleTodo(id: string, completed: boolean) {
    const { error } = await supabase
      .from('todos')
      .update({ completed: !completed })
      .eq('id', id)

    if (!error) {
      setTodos(todos.map(t => t.id === id ? { ...t, completed: !completed } : t))
    }
  }

  async function deleteTodo(id: string) {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)

    if (!error) {
      setTodos(todos.filter(t => t.id !== id))
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id, todo.completed)}
          />
          <span className={todo.completed ? 'line-through' : ''}>
            {todo.text}
          </span>
          <button onClick={() => deleteTodo(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  )
}
```

### Error Handling Pattern

```typescript
async function safeFetch(tableName: string) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')

    if (error) {
      console.error(`Error fetching from ${tableName}:`, error.message)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    console.error(`Unexpected error fetching from ${tableName}:`, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

// User-facing error state pattern:
// const [error, setError] = useState<string | null>(null)
// if (error) return <div className="text-red-500">Error: {error}</div>
```

### Database Readiness Pattern

schema.sql is auto-executed after code generation. During the brief window before execution completes, queries will fail with either:
- **`42P01`** — PostgreSQL: "relation does not exist" (table hasn't been created yet)
- **PostgREST schema cache miss** — "Could not find the table in the schema cache" (table exists but PostgREST hasn't refreshed)

Use this pattern to handle BOTH error types gracefully:

```tsx
const [data, setData] = useState<Item[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [dbReady, setDbReady] = useState(true)

async function fetchData() {
  setLoading(true)
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Two possible "table not ready" errors:
    // 1. 42P01 = PostgreSQL hasn't created the table yet
    // 2. "schema cache" = PostgREST hasn't picked up new tables yet
    if (error.code === '42P01' || error.message?.includes('schema cache')) {
      setDbReady(false)
      setTimeout(() => {
        setDbReady(true)
        fetchData()
      }, 3000)
      return
    }
    setError(error.message)
  } else {
    setData(data || [])
    setDbReady(true)
  }
  setLoading(false)
}

useEffect(() => { fetchData() }, [])

if (!dbReady) return <div className="text-center p-8 text-muted-foreground">Setting up database...</div>
if (loading) return <div>Loading...</div>
if (error) return <div className="text-red-500">Error: {error}</div>
```

Use this pattern in the PRIMARY data-fetching component (the one that loads on page mount). Secondary components that only write data (forms, buttons) don't need it — they'll work once the primary component confirms DB readiness.

> **Tip**: schema.sql should end with `NOTIFY pgrst, 'reload schema';` to force PostgREST to detect new tables immediately. Without this, the API may return "table not found" for up to 2 minutes.

### Common Supabase Errors

**Table not found — two different errors:**

Both mean the table isn't queryable yet. Use the Database Readiness Pattern above to retry automatically.

```typescript
// Error 1: PostgreSQL — table hasn't been created yet
// {message: 'relation "public.posts" does not exist', code: '42P01'}

// Error 2: PostgREST — table exists but schema cache hasn't refreshed
// {message: 'Could not find the table \'public.posts\' in the schema cache', code: ''}

// BOTH are caught by:
if (error.code === '42P01' || error.message?.includes('schema cache')) {
  // Retry after 3 seconds
}
// If the error persists after 30 seconds, run schema.sql manually in the Supabase SQL Editor.
```

**RLS blocks access (new row violates policy):**
This means your INSERT/UPDATE doesn't satisfy the WITH CHECK clause. Common cause: the user_id column doesn't match the authenticated user.

```typescript
// Error: {message: 'new row violates row-level security policy', code: '42501'}
// FIX: Ensure user_id is set to auth.uid() value, or check RLS policies
```

**No rows returned (RLS filters everything):**
Not an error — just empty results. This happens when SELECT policy filters out all rows (e.g., no published posts yet, or user has no data).

```typescript
// data will be [] — this is normal when no rows match the RLS policy
// Show an empty state UI, not an error
```

### Real-time Subscriptions (if needed)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function RealtimeTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    fetchTodos()

    // Subscribe to changes
    const channel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTodos(prev => [payload.new as Todo, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setTodos(prev => prev.filter(t => t.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE') {
            setTodos(prev =>
              prev.map(t => t.id === payload.new.id ? payload.new as Todo : t)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ... rest of component
}
```

### Index Recommendations

Always create indexes on:
- **Foreign key columns**: Every `_id` column that references another table (e.g., `workspace_id`, `project_id`, `user_id`)
- **Columns used in `.eq()` filters**: If you frequently filter by a column (e.g., `status`, `published`), index it
- **Columns used in `.order()` sorts**: Especially `created_at` for chronological listing
- **Columns referenced in RLS policies**: See the `rls-policies` skill for details

```sql
-- Add to schema.sql after all policies
create index if not exists idx_todos_user_id on todos(user_id);
create index if not exists idx_todos_created_at on todos(created_at desc);
create index if not exists idx_projects_workspace_id on projects(workspace_id);
create index if not exists idx_issues_project_id on issues(project_id);
create index if not exists idx_issues_assignee_id on issues(assignee_id);
```

> **Performance tip**: Wrap `auth.uid()` calls in `(select auth.uid())` in RLS policies for ~95% faster evaluation. See the `rls-policies` skill for the full pattern.

### Column Consistency Rules

Column names MUST be consistent across all layers:

- Column names in CRUD operations (e.g., `supabase.from('todos').insert({ text: '...' })`) MUST exactly match columns in schema.sql (e.g., `text text NOT NULL`).
- TypeScript interface fields MUST map 1:1 to schema.sql columns.
- If architecture.md DATABASE section says `task` but your interface uses `text`, pick ONE name and use it everywhere: schema.sql, TypeScript interface, and all CRUD operations.

```
schema.sql:           text text NOT NULL
TypeScript interface: text: string
Insert operation:     .insert({ text: '...' })
                      ^^^^  ^^^^  ^^^^  — ALL must match
```

### Initial State for DB-Backed Components

When a component fetches data from Supabase, initialize state with empty array `[]` and show loading state. NEVER hardcode demo objects with fake IDs in useState — any CRUD operation on fake IDs will fail because they don't exist in the database.

```tsx
// ✅ CORRECT — empty initial state + loading + useEffect fetch
const [todos, setTodos] = useState<Todo[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetchTodos()
}, [])

// ❌ WRONG — fake IDs will crash on update/delete
const [todos, setTodos] = useState([
  { id: '1', text: 'Fake todo', completed: false }
])
```

### RULES

1. **Only use when DATABASE section exists** in architecture.md
2. **Never create .env.local** — it's auto-provisioned
3. **Always create .env.local.example** — for documentation
4. **Use 'use client' for data fetching** — with useState + useEffect
5. **Handle errors gracefully** — check for error in response. Show user-facing error state for errors, empty state UI for empty results (empty results from RLS filtering are normal, not errors)
6. **Use optimistic updates** — update local state before confirming
7. **ALWAYS create schema.sql FIRST** when DATABASE section exists — before any component files
8. **NEVER hardcode Supabase URL or anon key** — always use process.env
9. **Column names in code MUST match column names in schema.sql** exactly
10. **Initialize DB-backed state with empty array `[]`** — data loads via useEffect, never fake demo objects
11. **Handle "table not found" gracefully** — catch BOTH `42P01` (PostgreSQL) AND `error.message?.includes('schema cache')` (PostgREST cache miss). Use the Database Readiness Pattern to show "Setting up database..." and auto-retry, not a raw error message
12. **Column names in code MUST match schema.sql exactly** — if schema.sql says `created_at`, code must use `created_at` (not `createdAt`). If schema.sql says `user_id`, code must use `user_id` (not `userId`). TypeScript interfaces map 1:1 to SQL column names
13. **For foreign key relationships, use PostgREST embedded select** — `.select('*, alias:fk_column(columns)')` instead of separate queries. Add optional relationship fields to TypeScript interfaces in `types/index.ts`
14. **NEVER join auth.users via PostgREST** — the `auth` schema is not exposed via the REST API. Create a `profiles` table in the `public` schema and join that instead. See the `auth-setup` skill for the profiles table pattern
15. **Always create indexes for FK columns in schema.sql** — every `_id` column referencing another table should have a corresponding `CREATE INDEX IF NOT EXISTS` statement. Without indexes, queries with RLS policies cause full table scans
