---
name: understand-request
description: ROUTER SKILL — Always load first. Analyzes user's modification intent and recommends which skills to load next. Use before any code changes.
category: chat
agents: [chat]
---

## When to Use
- ALWAYS load this skill first when receiving a chat modification request
- Before making any code changes

## Instructions

### Request Analysis Framework

When you receive a user's modification request, classify it:

| Intent Type | Indicators | Recommended Skills |
|-------------|------------|-------------------|
| Visual/Styling change | "change color", "make bigger", "move", "hide", "style" | `edit-component`, `react-component` |
| Visual bug / not visible | "can't see", "invisible", "wrong color", "text not showing" | `debug-visual-issues`, `edit-component` |
| Functional bug | "not working", "error", "broken", "crash" | `fix-bug` |
| Add new feature | "add", "create", "implement", "new" | `add-feature`, `react-component` |
| Layout change | "layout", "grid", "responsive", "mobile" | `edit-component`, `layout-grid`, `responsive-design` |
| Form handling | "form", "input", "validation", "submit" | `add-feature`, `form-builder` |
| Animation | "animate", "transition", "hover effect" | `edit-component`, `animation` |
| Explain | "explain", "how does", "what does", "why" | `explain-code` |
| State/Data | "state", "data", "fetch", "store" | `add-feature`, `state-management` |
| Database | "save", "persist", "database", "supabase" | `add-feature`, `database-queries` |
| Schema change | "add column", "add field", "add table", "new table", "modify schema", "fix RLS", "add policy", "drop column", "remove field" | `modify-schema`, `rls-policies`, `database-queries` |

### Workflow
1. Read user message
2. Classify intent (may be multiple types)
3. Load recommended skills from table above
4. Then proceed with the actual task using loaded skill guidance
