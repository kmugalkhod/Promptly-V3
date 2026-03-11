---
name: accessibility-check
description: Validate accessibility of generated websites using agent-browser snapshots. Checks for ARIA labels, keyboard navigation, form labels, and semantic HTML.
category: qa
agents: [qa]
---

## When to Use
- Validating accessibility of a generated website
- Checking WCAG 2.1 AA compliance via accessibility snapshots
- Identifying missing labels, landmarks, and semantic structure

## Instructions

### WCAG 2.1 AA Checks via Accessibility Snapshot

agent-browser `snapshot` (without -i) returns the FULL accessibility tree. Use this for comprehensive checks.
agent-browser `snapshot -i` returns only interactive elements. Use this for focused checks on forms/buttons.

### Checklist

**Form Inputs (WCAG 1.3.1, 4.1.2):**
- Every `<input>`, `<select>`, `<textarea>` must have an associated label
- Check for: `aria-label`, `aria-labelledby`, or a `<label>` element
- Snapshot shows: `textbox "Email"` (has label) vs `textbox ""` (missing label)
- **Fix**: Add `aria-label="Field purpose"` or wrap with `<Label>` from shadcn

**Buttons and Links (WCAG 4.1.2, 2.4.4):**
- Every button must have an accessible name (text content or aria-label)
- Snapshot shows: `button "Submit"` (good) vs `button ""` (missing name)
- Icon-only buttons MUST have aria-label
- Links must have descriptive text (not "click here")
- **Fix**: Add aria-label for icon buttons, use descriptive link text

**Images (WCAG 1.1.1):**
- All `<img>` elements must have alt text
- Decorative images should have `alt=""`
- Snapshot shows: `img "Product photo"` (good) vs `img ""` (needs review)
- **Fix**: Add meaningful alt text describing the image content

**Landmarks (WCAG 1.3.1):**
- Page should have: `<main>`, `<nav>` (if navigation exists), `<footer>` (if footer exists)
- Snapshot shows landmark roles: `navigation`, `main`, `contentinfo` (footer)
- Missing landmarks = content not semantically structured
- **Fix**: Wrap content in semantic HTML elements

**Heading Hierarchy (WCAG 1.3.1):**
- Page must have exactly one `<h1>`
- Headings should not skip levels (h1 → h3 without h2)
- Snapshot shows: `heading "Title" [level=1]`, `heading "Section" [level=2]`
- **Fix**: Adjust heading levels to maintain proper hierarchy

**Keyboard Navigation (WCAG 2.1.1):**
- All interactive elements should be focusable
- Custom interactive elements need `tabIndex={0}` and keyboard handlers
- If snapshot shows a `<div>` acting as a button without button role, it's not keyboard-accessible
- **Fix**: Use semantic elements (`<button>`, `<a>`) or add role + tabIndex

### shadcn/ui Component Accessibility Notes

shadcn components generally have good built-in accessibility. Do NOT flag:
- `Dialog` — has proper focus trap and aria attributes
- `Select` — has proper listbox role and keyboard navigation
- `DropdownMenu` — has proper menu role
- `Tabs` — has proper tablist/tab/tabpanel roles
- `Switch` — has proper switch role

DO flag when developers misuse shadcn:
- `Select` with empty string value (`<SelectItem value="">`)
- `Dialog` without `DialogTitle`
- Custom wrappers that break the a11y tree (e.g., wrapping Button in a div with onClick)

### Severity Classification

- **critical**: Forms completely unusable without labels (screen reader user can't fill out form)
- **major**: Missing form labels, empty buttons, no heading hierarchy, missing landmarks
- **minor**: Optional aria-describedby improvements, heading level skip, decorative image with missing alt=""
