---
name: localstorage-persistence
description: Persist data to localStorage for apps without a database. Use when app needs to save data client-side without Supabase.
category: frontend
agents: [coder, chat]
---

## When to Use
- App needs to save user data BUT does NOT have a DATABASE section in architecture.md
- User explicitly says "no database" or "no Supabase"
- Simple persistence: preferences, settings, small data sets
- Single-user apps that don't need server-side storage

## When NOT to Use
- Architecture.md has a DATABASE section (use database-queries skill instead)
- App needs multi-user data sharing
- Data exceeds ~5MB
- App requires server-side persistence or real-time sync

## Instructions

### useLocalStorage Hook (Hydration-Safe)

Create this hook in `lib/use-local-storage.ts`:

```typescript
'use client'

import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize with initialValue to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
    }
  }, [key])

  // Setter that also saves to localStorage
  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue]
}
```

### Usage Patterns

**Simple value persistence (theme, preferences):**

```tsx
'use client'

import { useLocalStorage } from '@/lib/use-local-storage'

export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('myapp-theme', 'light')

  return (
    <button onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}>
      Current: {theme}
    </button>
  )
}
```

**Array/object persistence (todo list, notes):**

```tsx
'use client'

import { useState } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

interface Todo {
  id: string
  text: string
  completed: boolean
}

export function TodoList() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('myapp-todos', [
    { id: '1', text: 'Welcome todo', completed: false },
  ])
  const [input, setInput] = useState('')

  const addTodo = () => {
    if (!input.trim()) return
    setTodos(prev => [...prev, {
      id: `todo-${Date.now()}`,
      text: input,
      completed: false,
    }])
    setInput('')
  }

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ))
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
              onClick={() => toggleTodo(todo.id)}
            >
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Clearing data:**

```tsx
const clearAll = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('myapp-todos')
  }
  setTodos([])
}
```

### Integration with Context (Shared localStorage State)

When multiple components need the same localStorage state, combine with Context:

```tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

interface Settings {
  theme: 'light' | 'dark'
  fontSize: number
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (settings: Settings) => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>('myapp-settings', {
    theme: 'light',
    fontSize: 16,
  })

  return (
    <SettingsContext.Provider value={{ settings, updateSettings: setSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
```

### RULES

1. **NEVER use when DATABASE section exists** — use database-queries skill instead
2. **Always wrap localStorage access in `typeof window !== 'undefined'` check** — prevents SSR errors
3. **Always handle JSON.parse errors gracefully** — localStorage may contain corrupted data
4. **Use descriptive key names prefixed with app name** (e.g., `myapp-todos`, `myapp-settings`)
5. **Initialize state from localStorage in useEffect, not during render** — hydration safety
