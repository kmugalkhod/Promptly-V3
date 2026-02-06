---
name: add-feature
description: Add new functionality to existing code. Use when user requests new components, features, interactions, or capabilities.
category: chat
agents: [chat]
---

## When to Use
- User asks to "add", "create", "implement" something new
- Adding new components or sections
- Adding new interactions (modals, toggles, forms)
- Adding data fetching or state management

## Instructions

### Feature Addition Workflow

1. **Read existing code** — understand current structure before adding
2. **Plan where to add** — new file or extend existing file?
3. **Follow existing patterns** — match the codebase style
4. **Add imports** — only add what's needed
5. **Integrate with existing code** — connect to parent, add to layout

### Decision: New File vs Existing File

| Scenario | Action |
|----------|--------|
| New section/component | Create new file in `components/` |
| New page | Create new file in `app/page-name/page.tsx` |
| Add to existing section | Modify existing component file |
| New utility function | Add to existing `lib/` file or create new |
| New type | Add to existing `types/index.ts` |

### Integration Checklist

- [ ] New component imported in parent
- [ ] New component rendered in correct position
- [ ] Props passed from parent to child
- [ ] 'use client' added if using hooks/events
- [ ] TypeScript interfaces defined for new props
- [ ] CSS variables used for colors (no hardcoded hex)
- [ ] Responsive design considered (mobile-first)

### State Management for New Features

- **Simple state**: `useState` in the component
- **Shared state**: Lift state to common parent
- **Complex state**: `useReducer` for state machines
- **NEVER** use `useSyncExternalStore` — use useState or Context

### Protected Files

When adding features, NEVER modify:
- tailwind.config.ts / .js
- postcss.config.js / .mjs
- next.config.js / .mjs / .ts
- package.json — use install_packages tool instead
- tsconfig.json
- lib/utils.ts
