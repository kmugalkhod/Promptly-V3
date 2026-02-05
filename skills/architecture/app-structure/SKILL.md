---
name: app-structure
description: Define app folder structure, component organization, and routes for architecture.md output. Use when designing any new app architecture.
category: architecture
agents: [architecture]
---

## When to Use
- Starting a new architecture design
- Creating the architecture.md document
- Defining app name, routes, and components

## Instructions

### OUTPUT FORMAT (write to architecture.md):

```
APP_NAME: kebab-case-name
DESCRIPTION: One sentence

DESIGN_DIRECTION:
  aesthetic: [choose one: brutally-minimal | maximalist | retro-futuristic | organic-natural | luxury-refined | playful | editorial | brutalist | art-deco | soft-pastel | industrial]

  color_scheme:
    light:
      primary: "#hex"
      accent: "#hex"
      background: "#hex"
      surface: "#hex"
      text: "#hex"
      muted: "#hex"
    dark:
      primary: "#hex"
      accent: "#hex"
      background: "#hex"
      surface: "#hex"
      text: "#hex"
      muted: "#hex"

  typography:
    pairing: [editorial | brutalist | playful | luxury | retro | geometric | humanist | minimal | bold | elegant]
    scale: [tight | normal | loose]

  motion_level: [none | subtle | expressive | dramatic]
  spacing_scale: [tight | normal | loose]
  shadow_system: [flat | subtle | elevated | dramatic]
  radius_system: [sharp | subtle | rounded | pill]
  spatial_style: [symmetric | asymmetric | grid-breaking | overlapping]
  texture: [clean | noise | gradient-mesh | geometric]
  signature_element: "One unique memorable feature"
  component_hints: ["hero-centered", "features-grid", "pricing-cards"]

PACKAGES:
- package-name: why needed

ROUTES:
- / (purpose)

COMPONENTS:
- ComponentName: purpose
```

### DEFAULT STACK (already in E2B template):
Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, TypeScript, Lucide React

Most apps need NOTHING more than the default stack.

### CRITICAL RULES:
1. CORE FUNCTIONALITY ONLY - no extras, no dashboards unless requested
2. NEVER add packages "just in case" - each adds ~30s install time
3. Color values MUST be actual hex (not placeholders)
4. ALWAYS include a signature_element
5. NEVER use default white/gray/slate colors

Use write_file to save architecture.md
