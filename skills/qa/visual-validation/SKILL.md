---
name: visual-validation
description: Validate visual quality of generated websites using agent-browser snapshots and screenshots. Checks for layout issues, empty sections, and visual defects.
category: qa
agents: [qa]
---

## When to Use
- Validating a generated website's visual quality
- Checking for empty/blank sections, broken layouts, missing content
- Analyzing agent-browser accessibility snapshot output for visual issues

## Instructions

### Interpreting Accessibility Snapshots

agent-browser `snapshot -i` returns a tree of interactive elements with refs (@e1, @e2, etc.):
```
@e1 link "Home" [href="/"]
@e2 button "Get Started"
@e3 heading "Welcome to MyApp" [level=1]
@e4 img "Hero banner" [src="/hero.png"]
```

- **Refs** (@e1, @e2) identify elements for interaction (click, type)
- **Role** (link, button, heading, img) indicates element type
- **Name** (quoted text) is the accessible name
- **Attributes** in brackets show properties

### Visual Quality Heuristics from Snapshots

**Empty/Blank Page Detection:**
- If snapshot returns very few elements (< 3), the page may be blank
- If no heading elements exist, the page likely failed to render
- If no interactive elements but architecture specifies buttons/forms, components are missing

**Missing Content Sections:**
- Cross-reference snapshot elements with architecture's COMPONENTS section
- If architecture lists a "Hero" component but snapshot has no heading or large text block, it's missing
- If architecture lists a "Footer" but snapshot has no footer landmark, it's missing

**Error State Detection:**
- Look for text containing "Error", "Something went wrong", "undefined", "null"
- Look for elements with error-related roles or classes mentioned in snapshot
- If a section shows "Loading..." indefinitely, the data fetch may have failed

**Image Issues:**
- Images with empty alt text AND no visible content suggest failed loads
- Images referenced in architecture but absent from snapshot are missing

### Common Visual Issues in Generated Next.js Apps

| Issue | Snapshot Signal | Likely Cause |
|-------|----------------|-------------|
| White/blank page | Very few or no elements | Missing CSS variables in globals.css, or component import error |
| Broken grid | Elements appear in unexpected order | Missing responsive Tailwind classes, flex/grid misconfiguration |
| Images not loading | img elements without proper src | Incorrect image paths, missing public/ files |
| Components outside viewport | Elements present in snapshot but not visible | Absolute/fixed positioning without proper constraints |
| Repeated error messages | Multiple text elements with "Error" | Failed API calls, missing environment variables |
| Missing interactivity | Buttons/links present but not functional | Missing 'use client' directive, broken event handlers |

### Severity Classification

- **critical**: Blank page, all content missing, crash/error screen
- **major**: Major section missing, images broken, grid layout completely wrong
- **minor**: Slight visual inconsistency, minor spacing issues, optional enhancement
