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

### File Setup

**1. lib/supabase.ts - Client Setup:**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**2. .env.local.example - Template (documentation only):**

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

### Data Fetching in Components

Use 'use client' + useState + useEffect for fetching:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
async function safeFetch() {
  try {
    const { data, error } = await supabase
      .from('todos')
      .select('*')

    if (error) {
      console.error('Supabase error:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
```

### Real-time Subscriptions (if needed)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function RealtimeTodos() {
  const [todos, setTodos] = useState<Todo[]>([])

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

### RULES

1. **Only use when DATABASE section exists** in architecture.md
2. **Never create .env.local** — it's auto-provisioned
3. **Always create .env.local.example** — for documentation
4. **Use 'use client' for data fetching** — with useState + useEffect
5. **Handle errors gracefully** — check for error in response
6. **Use optimistic updates** — update local state before confirming
