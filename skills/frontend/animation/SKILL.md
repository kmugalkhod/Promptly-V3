---
name: animation
description: Add motion and transitions to components. Use when implementing hover effects, page transitions, or micro-interactions. Match motion_level from architecture.
category: frontend
agents: [coder, chat]
---

## When to Use
- Adding hover effects to cards/buttons
- Creating page or section transitions
- Building micro-interactions
- When architecture specifies motion_level

## Instructions

### Motion Levels Reference

Match the `motion_level` from architecture.md DESIGN_DIRECTION:

| Level | Transition | Hover Effect | Use Case |
|-------|------------|--------------|----------|
| none | `transition-none` | No effect | Print-like, static aesthetic |
| subtle | `transition-all duration-200` | `hover:translate-y-[-1px] hover:shadow-sm` | Professional, minimal |
| expressive | `transition-all duration-300` | `hover:translate-y-[-4px] hover:shadow-lg hover:scale-[1.02]` | Modern SaaS, playful |
| dramatic | `transition-all duration-500` | `hover:translate-y-[-8px] hover:shadow-2xl hover:scale-105 hover:rotate-1` | Bold, theatrical |

### Basic Transition Patterns

```tsx
// Subtle - barely perceptible
<button className="transition-all duration-200 hover:translate-y-[-1px] hover:shadow-sm">
  Click me
</button>

// Expressive - noticeable but not distracting
<div className="transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:scale-[1.02]">
  Card content
</div>

// Dramatic - bold, theatrical
<div className="transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:translate-y-[-8px] hover:shadow-2xl hover:scale-105 hover:rotate-1">
  Feature card
</div>
```

### Card Hover Effect

```tsx
// Standard card with hover
<div className="bg-card rounded-xl p-6 shadow-md
               transition-all duration-300
               hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1">
  <h3 className="font-display text-xl text-foreground">Title</h3>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Button Hover Effects

```tsx
// Primary button with lift effect
<button className="px-6 py-3 bg-primary text-white rounded-lg font-semibold
                   shadow-lg transition-all duration-200
                   hover:shadow-xl hover:scale-105">
  Get Started
</button>

// Ghost button with background fill
<button className="px-6 py-3 border border-primary text-primary rounded-lg
                   transition-all duration-200
                   hover:bg-primary hover:text-white">
  Learn More
</button>
```

### Framer Motion Patterns (if installed)

Only use if `framer-motion` is in architecture.md PACKAGES:

```tsx
'use client'

import { motion } from 'framer-motion'

// Fade in on mount
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>

// Staggered children
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>

// Hover animation
<motion.div
  whileHover={{ scale: 1.05, rotate: 1 }}
  transition={{ type: 'spring', stiffness: 300 }}
>
  Interactive element
</motion.div>
```

### Page Transition Pattern

```tsx
'use client'

import { motion } from 'framer-motion'

export default function Page() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      Page content
    </motion.div>
  )
}
```

### Loading States

```tsx
// Spinner animation
<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />

// Pulse skeleton
<div className="animate-pulse bg-muted/20 rounded-lg h-24" />

// Bounce indicator
<div className="flex gap-1">
  {[0, 1, 2].map(i => (
    <div
      key={i}
      className="w-2 h-2 bg-primary rounded-full animate-bounce"
      style={{ animationDelay: `${i * 0.1}s` }}
    />
  ))}
</div>
```

### Focus States (Accessibility)

```tsx
// Focus ring for keyboard navigation
<button className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                   transition-all duration-200">
  Accessible Button
</button>

// Focus within for form groups
<div className="focus-within:ring-2 focus-within:ring-primary rounded-lg p-2">
  <input className="outline-none" />
</div>
```

### Micro-Interactions

```tsx
// Icon rotation on hover
<button className="group">
  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
</button>

// Link underline animation
<a className="relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary
              after:transition-all after:duration-200 hover:after:w-full">
  Learn More
</a>

// Color transition
<div className="bg-card transition-colors duration-200 hover:bg-primary/10">
  Hoverable area
</div>
```

### RULES

1. Match motion_level from architecture.md DESIGN_DIRECTION
2. Always use `transition-all` with explicit duration
3. Use `ease-out` or custom cubic-bezier for natural feel
4. Don't over-animate - motion should enhance, not distract
5. Ensure focus states are visible for accessibility
6. Only use framer-motion if it's in PACKAGES
