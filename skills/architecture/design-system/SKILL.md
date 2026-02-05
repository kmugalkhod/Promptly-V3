---
name: design-system
description: Choose color palette, aesthetic, and visual style decisions for distinctive app design. Use when determining the visual identity of an app.
category: architecture
agents: [architecture]
---

## When to Use
- Choosing aesthetic direction for a new app
- Selecting color palette (light and dark mode)
- Determining visual personality and signature element

## Instructions

### DESIGN REASONING
Before choosing aesthetic, answer these questions:

1. **WHO is the user?**
   - Consumer app → playful, soft-pastel, maximalist
   - Business/B2B → editorial, minimal, luxury-refined
   - Developer tools → brutally-minimal, industrial

2. **WHAT is the mood?**
   - Fun/casual → maximalist, playful, retro-futuristic
   - Serious/professional → brutally-minimal, editorial, luxury-refined
   - Creative/artistic → brutalist, art-deco

3. **WHAT is the content?**
   - Text-heavy → editorial (good typography focus)
   - Visual-heavy → art-deco, maximalist (bold visuals)
   - Data-focused → geometric, industrial (clear, structured)

### AESTHETIC REFERENCE TABLE

| Aesthetic | Best For | Spacing | Shadow | Radius |
|-----------|----------|---------|--------|--------|
| brutally-minimal | Productivity, dev tools | tight | flat | sharp |
| maximalist | Entertainment, social | loose | dramatic | pill |
| retro-futuristic | Games, tech demos | normal | elevated | rounded |
| organic-natural | Health, wellness, eco | loose | subtle | rounded |
| luxury-refined | Finance, premium SaaS | loose | dramatic | subtle |
| playful | Kids, casual apps | normal | elevated | pill |
| editorial | Blogs, news, portfolios | normal | subtle | subtle |
| brutalist | Creative, art, experimental | tight | flat | sharp |
| art-deco | Luxury, events, hospitality | normal | elevated | subtle |
| soft-pastel | Wellness, beauty, lifestyle | loose | subtle | rounded |
| industrial | Construction, manufacturing | tight | flat | sharp |

### COLOR RULES
1. NEVER use default white (#ffffff) or gray/slate colors
2. Every color value MUST be actual hex (not "#hex" placeholder)
3. Light and dark mode MUST both have complete color sets
4. Signature colors should match the aesthetic personality

### SIGNATURE ELEMENT
Every app MUST have a signature_element - one unique memorable visual feature:
- Gradient background
- Animated logo
- Unique button shape
- Distinctive card style
- Custom cursor
- Micro-interaction
