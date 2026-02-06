---
name: debug-visual-issues
description: Fix text visibility, color clashes, and CSS variable issues. Use when user reports "can't see", "invisible", "wrong color", or visual display problems.
category: chat
agents: [chat]
---

## When to Use
- User says text is "not visible", "can't see", "invisible"
- Colors are wrong or clashing
- Elements not displaying properly
- Dark mode / light mode issues

## Instructions

### Debugging Steps

1. **FIRST read globals.css** — check what CSS variables are defined
2. **Check the component** — is it using hardcoded colors that clash with the background?
3. **Fix using CSS variables** — replace hardcoded colors with CSS variable references
4. **Common cause**: Component uses `text-white` on a white background, or `text-black` on a dark background

### Common Visibility Problems

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Text invisible | Hardcoded color matches background | Use `text-[var(--color-text)]` |
| Button text gone | `text-white` on light bg | Use `text-[var(--color-primary)]` or ensure bg is dark |
| Card invisible | No background set | Add `bg-[var(--color-surface)]` |
| Dark mode broken | Only light mode colors | Add `.dark` CSS variables in globals.css |
| Icon not showing | Wrong color on background | Use `text-[var(--color-text)]` |

### CSS Variable Reference

Always read globals.css to see actual values, then use these patterns:
```
text-[var(--color-text)]        — main text (adapts to theme)
text-[var(--color-muted)]       — secondary text
text-[var(--color-primary)]     — accent/link text
bg-[var(--color-background)]    — page background
bg-[var(--color-surface)]       — card/section background
bg-[var(--color-primary)]       — accent background
border-[var(--color-primary)]   — accent borders
```

### Dark Mode Debugging

1. Check if globals.css has a `.dark` section with CSS variables
2. Check if `@custom-variant dark (&:where(.dark, .dark *));` exists
3. Ensure component uses CSS variables (not hardcoded colors) so dark mode works
4. If no dark mode defined, add `.dark { ... }` to globals.css with appropriate values
