---
name: route-planning
description: Plan pages, API routes, navigation structure, and page blueprints for complex layouts. Use when designing app navigation and page structure.
category: architecture
agents: [architecture]
---

## When to Use
- Defining app routes and navigation
- Planning landing pages with multiple sections
- Creating page blueprints for complex layouts

## Instructions

### ROUTES SECTION FORMAT

```
ROUTES:
- / (homepage - main landing or app entry)
- /dashboard (user's main view)
- /settings (user preferences)
- /[id] (dynamic route for items)
```

### PAGE_BLUEPRINT (for complex pages)

Use PAGE_BLUEPRINT when a page has 3+ content sections (landing pages, marketing pages, dashboards).

```
PAGE_BLUEPRINT:
  /:
    sections:
      - type: hero-centered
        component: HeroSection
        data: { headline: "Your Headline", subheadline: "Supporting text", cta_text: "Get Started", cta_href: "#pricing" }
      - type: features-grid
        component: FeaturesGrid
        data: { features: [{ icon: "Zap", title: "Fast", description: "Lightning speed" }] }
    flow: "hero -> features -> footer"
```

### COMPONENT TEMPLATES (section types)

| Type | Description | Typical Data |
|------|-------------|--------------|
| hero-centered | Full-height centered hero | headline, subheadline, cta_text, cta_href |
| hero-split | Two-column with content left, visual right | headline, description, image, cta |
| features-grid | 3-column icon + title + description cards | features array |
| features-alternating | Left-right alternating sections | features with images |
| pricing-cards | 3-tier pricing with recommended highlight | plans array |
| testimonials-carousel | Customer quote cards | testimonials array |

### PAGE BLUEPRINT RULES
1. Generate PAGE_BLUEPRINT ONLY for pages with 3+ content sections
2. Skip for simple apps (todo, calculator, single-feature apps)
3. Each section type must match a template above OR use descriptive custom type
4. Each component MUST match a name in COMPONENTS list
5. Data = props contract with CONCRETE EXAMPLE VALUES (not just type names)
6. Flow = narrative arrow sequence of section reading order
7. Keep data contracts minimal - only essential props
