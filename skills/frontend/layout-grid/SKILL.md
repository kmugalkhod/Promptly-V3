---
name: layout-grid
description: Create page layouts with CSS Grid and Flexbox. Use when building page structures, card grids, or responsive containers.
category: frontend
agents: [coder, chat]
---

## When to Use
- Building page layouts (header, main, footer)
- Creating card grids
- Designing responsive containers
- Organizing sections on landing pages

## Instructions

### Page Layout Pattern

```tsx
export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Logo</h1>
          <nav className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#" className="text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* content */}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="container mx-auto text-center text-muted-foreground">
          &copy; 2024 Company
        </div>
      </footer>
    </div>
  )
}
```

### Grid Patterns

| Use Case | Classes | Description |
|----------|---------|-------------|
| 3-column | `grid grid-cols-1 md:grid-cols-3 gap-6` | Cards, features |
| 2-column | `grid grid-cols-1 md:grid-cols-2 gap-8` | Split layouts |
| 4-column | `grid grid-cols-2 md:grid-cols-4 gap-4` | Image gallery |
| Auto-fill | `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6` | Flexible cards |

### Features Grid Section

```tsx
<section className="py-20 px-4 bg-background">
  <div className="max-w-6xl mx-auto">
    <h2 className="font-display text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
      Features
    </h2>
    <div className="grid md:grid-cols-3 gap-8">
      {features.map((feature) => (
        <div key={feature.id} className="bg-card p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            {feature.icon}
          </div>
          <h3 className="font-display text-xl font-semibold text-foreground mb-2">
            {feature.title}
          </h3>
          <p className="text-muted-foreground">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>
```

### Flexbox Patterns

| Use Case | Classes | Description |
|----------|---------|-------------|
| Center content | `flex items-center justify-center` | Center both axes |
| Space between | `flex items-center justify-between` | Header nav |
| Column stack | `flex flex-col gap-4` | Vertical list |
| Wrap cards | `flex flex-wrap gap-4` | Flexible cards |

### Hero Section Layouts

**Centered Hero:**
```tsx
<section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-background">
  <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground mb-6">
    {headline}
  </h1>
  <p className="text-xl text-muted-foreground max-w-2xl mb-8">
    {subheadline}
  </p>
  <div className="flex gap-4">
    <Button>{primaryCTA}</Button>
    <Button variant="outline">{secondaryCTA}</Button>
  </div>
</section>
```

**Split Hero (content left, image right):**
```tsx
<section className="min-h-[80vh] grid md:grid-cols-2 gap-12 items-center px-4 md:px-12 bg-background">
  <div className="space-y-6">
    <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground">
      {headline}
    </h1>
    <p className="text-lg text-muted-foreground">
      {subheadline}
    </p>
    <div className="flex gap-4">
      <Button>{primaryCTA}</Button>
      <Button variant="outline">{secondaryCTA}</Button>
    </div>
  </div>
  <div className="bg-card rounded-2xl aspect-video flex items-center justify-center">
    {/* Image or visual content */}
  </div>
</section>
```

### Container Patterns

```tsx
// Standard centered container
<div className="max-w-6xl mx-auto px-4">

// Full width with padding
<div className="w-full px-4 md:px-8 lg:px-12">

// Narrow content (articles, forms)
<div className="max-w-2xl mx-auto px-4">

// Wide content (dashboards)
<div className="max-w-7xl mx-auto px-4">
```

### Section Spacing

```tsx
// Standard section spacing
<section className="py-20 px-4">

// Tight spacing (spacing_scale: tight)
<section className="py-12 px-4">

// Loose spacing (spacing_scale: loose)
<section className="py-24 px-4 md:py-32">
```

### Visual Rhythm (Alternating Backgrounds)

```tsx
<div className="min-h-screen bg-background">
  <section className="py-20 bg-background">
    {/* Section 1 */}
  </section>
  <section className="py-20 bg-card">
    {/* Section 2 - alternate background */}
  </section>
  <section className="py-20 bg-background">
    {/* Section 3 */}
  </section>
</div>
```

### Dashboard Layout

```tsx
<div className="min-h-screen bg-background">
  <div className="flex">
    {/* Sidebar */}
    <aside className="w-64 border-r border-border bg-card min-h-screen p-4">
      <nav className="space-y-2">
        {navItems.map(item => (
          <a key={item.id} href={item.href} className="block px-4 py-2 rounded-lg hover:bg-primary/10">
            {item.label}
          </a>
        ))}
      </nav>
    </aside>

    {/* Main Content */}
    <main className="flex-1 p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats cards */}
      </div>
    </main>
  </div>
</div>
```

### RULES

1. Use CSS Grid for 2D layouts (rows AND columns)
2. Use Flexbox for 1D layouts (row OR column)
3. Always use Tailwind theme classes for colors (bg-primary, text-foreground, bg-card, etc.)
4. Use container with mx-auto for centered content
5. Apply consistent section spacing (py-16, py-20, or py-24)
6. Alternate backgrounds for visual rhythm
