---
name: state-management
description: Manage component and app state in React. Use when deciding between useState, useReducer, Context, or zustand. CRITICAL - never use useSyncExternalStore.
category: frontend
agents: [coder, chat]
---

## When to Use
- Managing local component state
- Sharing state across components
- Deciding which state solution to use
- Fixing "getServerSnapshot should be cached" errors

## Instructions

### State Management Decision Tree

```
Need state? → Is it local to one component?
              ├── YES → useState (90% of cases)
              └── NO → Is it shared across 2-3 components?
                       ├── YES → Prop drilling or Context + useState
                       └── NO → Is zustand in PACKAGES?
                                ├── YES → zustand
                                └── NO → Context + useState
```

### Priority Order (Use First Available)

1. **useState** — sufficient for 90% of apps (PREFERRED)
2. **useReducer** — complex state with many actions
3. **Context + useState** — shared state across components
4. **zustand** — ONLY if architecture.md PACKAGES lists it

### ⚠️ NEVER USE useSyncExternalStore

**NEVER create custom stores with useSyncExternalStore — causes SSR hydration errors.**

```tsx
// ❌ WRONG - causes "getServerSnapshot should be cached" error
import { useSyncExternalStore } from 'react'

const store = {
  state: [],
  listeners: new Set(),
  subscribe(listener) { ... },
  getSnapshot() { ... },
  getServerSnapshot() { ... }
}

export function useStore() {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot // This pattern causes SSR errors!
  )
}
```

### useState Pattern (Use This First)

```tsx
'use client'

import { useState } from 'react'

interface Todo {
  id: string
  text: string
  completed: boolean
}

const INITIAL_TODOS: Todo[] = [
  { id: '1', text: 'Learn React', completed: true },
  { id: '2', text: 'Build app', completed: false },
]

export function TodoList() {
  const [todos, setTodos] = useState(INITIAL_TODOS)

  const addTodo = (text: string) => {
    setTodos(prev => [...prev, {
      id: `todo-${prev.length + 1}`,
      text,
      completed: false
    }])
  }

  const toggleTodo = (id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))
  }

  return (
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
  )
}
```

### Context + useState Pattern (Shared State)

```tsx
// lib/store.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface AppState {
  user: string | null
  theme: 'light' | 'dark'
}

interface AppContextType {
  state: AppState
  setUser: (user: string | null) => void
  toggleTheme: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    theme: 'light',
  })

  const setUser = (user: string | null) => {
    setState(prev => ({ ...prev, user }))
  }

  const toggleTheme = () => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }))
  }

  return (
    <AppContext.Provider value={{ state, setUser, toggleTheme }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
```

**Usage in layout.tsx:**

```tsx
// app/layout.tsx
import { AppProvider } from '@/lib/store'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}
```

### useReducer Pattern (Complex State)

```tsx
'use client'

import { useReducer } from 'react'

interface State {
  count: number
  step: number
  history: number[]
}

type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; step: number }
  | { type: 'reset' }

const initialState: State = {
  count: 0,
  step: 1,
  history: [0],
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      const newCount = state.count + state.step
      return { ...state, count: newCount, history: [...state.history, newCount] }
    case 'decrement':
      const decremented = state.count - state.step
      return { ...state, count: decremented, history: [...state.history, decremented] }
    case 'setStep':
      return { ...state, step: action.step }
    case 'reset':
      return initialState
    default:
      return state
  }
}

export function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+{state.step}</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-{state.step}</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset</button>
    </div>
  )
}
```

### zustand Pattern (Only if in PACKAGES)

```tsx
// lib/store.ts
import { create } from 'zustand'

interface TodoStore {
  todos: Todo[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
}

export const useTodoStore = create<TodoStore>((set) => ({
  todos: [
    { id: '1', text: 'Learn zustand', completed: false },
  ],
  addTodo: (text) =>
    set((state) => ({
      todos: [...state.todos, { id: `${state.todos.length + 1}`, text, completed: false }]
    })),
  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    })),
  deleteTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id)
    })),
}))
```

### Fixing "getServerSnapshot should be cached" Error

If you see this error, the code uses useSyncExternalStore incorrectly. **Replace with useState or Context:**

1. Remove any `useSyncExternalStore` imports
2. Remove custom subscribe/getSnapshot/getServerSnapshot functions
3. Replace with useState or Context + useState pattern
4. Update all components using the store

### RULES

1. **useState first** — sufficient for 90% of apps
2. **NEVER useSyncExternalStore** — causes SSR hydration errors
3. **NEVER create lib/store.ts with custom subscribe/getSnapshot patterns**
4. **Context for shared state** — when 3+ components need same state
5. **zustand ONLY if in PACKAGES** — handles SSR correctly
6. **Always initialize state with data** — never empty arrays for lists
