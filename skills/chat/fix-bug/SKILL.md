---
name: fix-bug
description: Debug and fix code issues using root cause analysis. Use when user reports errors, crashes, broken functionality, or unexpected behavior.
category: chat
agents: [chat]
---

## When to Use
- User reports something "not working", "broken", "error"
- Application crashes or shows error messages
- Unexpected behavior (wrong data, missing updates)
- Console errors or build failures

## Instructions

### Root Cause Analysis Methodology

1. **Think through the ROOT CAUSE** — don't just patch symptoms
2. **Read ALL related files** (the component, its parent, shared state, types)
3. **Trace the data flow**: where does the state come from? How does it update?
4. **Fix the actual cause**, not just the visible symptom
5. **Test mentally**: does your fix handle all edge cases?

### Investigation Steps

1. **Reproduce mentally** — what exactly does the user see?
2. **Read the component** — find the code related to the broken behavior
3. **Read related files** — parent component, data source, types, utilities
4. **Trace data flow**:
   - Where is the data defined?
   - How does it get to this component? (props, state, context)
   - What triggers updates?
   - Are there async operations that might race?
5. **Identify the root cause** — what's actually wrong?
6. **Fix precisely** — change only what's needed

### Common Bug Patterns

| Bug Type | Symptoms | Common Cause | Fix |
|----------|----------|-------------|-----|
| Hydration mismatch | Console error, flicker | Math.random/Date.now in render | Move to useEffect |
| Stale state | Old data displayed | Missing dependency in useEffect | Add dependencies |
| Missing 'use client' | "useState is not a function" | Server component using hooks | Add 'use client' |
| Async in client | Component crashes | `async function` with 'use client' | Remove async, use useEffect |
| Infinite loop | Page freezes | setState in useEffect without deps | Add dependency array |
| Props not updating | UI doesn't change | Object reference comparison | Spread into new object |
| Event not firing | Click doesn't work | Nested interactive elements | Fix nesting hierarchy |

### RULES
- NEVER just patch symptoms — find the real cause
- ALWAYS read ALL related files before making changes
- FIX the root cause, even if it's in a different file than expected
- PRESERVE all existing code — only change what's needed for the fix
