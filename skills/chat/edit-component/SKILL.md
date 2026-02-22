---
name: edit-component
description: Safely modify existing components while preserving all existing code. Use when changing styles, editing JSX, or making targeted modifications.
category: chat
agents: [chat]
---

## When to Use
- Modifying existing components
- Changing styles or visual appearance
- Editing JSX structure
- Any targeted modification to existing code

## Instructions

### CRITICAL: Code Preservation Rules

When you write a file, you MUST include ALL existing code that wasn't meant to be changed:

1. **Keep ALL imports** — Don't remove imports unless they become unused
2. **Keep ALL functions** — Don't remove functions unless user asked to remove them
3. **Keep ALL styles/CSS** — Don't remove CSS classes or styles
4. **Keep ALL state/hooks** — Don't remove useState, useEffect, etc.
5. **Keep ALL components** — Don't remove child components or JSX

**BEFORE writing a file, mentally verify:**
- [ ] All original imports are still there
- [ ] All original functions/components are still there
- [ ] All original CSS/styles are still there
- [ ] Only the requested change was made

### What NOT To Do

- Do NOT remove existing CSS or styles (even if adding new styles)
- Do NOT remove existing functions or components
- Do NOT simplify or "clean up" code that wasn't asked to change
- Do NOT write partial files with "// ... rest of code"
- Do NOT create extra files user didn't ask for

### Safe Editing Workflow

1. **read_file** the target file first — ALWAYS get current version
2. **read_file** related files (parent component, shared types)
3. Identify the MINIMAL change needed
4. **write_file** with COMPLETE file content (all original code + your change)
5. Verify nothing was accidentally removed

### Tailwind Theme Class Usage

When changing colors or visual properties, use Tailwind theme classes:
```
bg-background         — page background
bg-card               — card/section background
text-foreground       — main text
text-muted-foreground — subtle text
text-primary          — accent text
bg-primary            — accent background
border-primary        — accent border
```

**NEVER use explicit CSS variable syntax** (e.g., `bg-[var(--varname)]`). Use the Tailwind theme classes above.
