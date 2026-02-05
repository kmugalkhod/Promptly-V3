---
name: responsive-design
description: Build mobile-first responsive layouts with Tailwind breakpoints. Use when creating responsive grids, typography, or adaptive components.
category: frontend
agents: [coder, chat]
---

## When to Use
- Creating responsive page layouts
- Adapting components for different screen sizes
- Building mobile-first designs
- Using Tailwind breakpoints

## Instructions

### Mobile-First Approach

Always start with mobile styles, then add breakpoints for larger screens:

```tsx
// ❌ WRONG - desktop-first (harder to maintain)
<div className="flex-row md:flex-col">

// ✅ CORRECT - mobile-first
<div className="flex-col md:flex-row">
```

### Tailwind Breakpoint Reference

| Prefix | Min Width | Target |
|--------|-----------|--------|
| (none) | 0px | Mobile phones |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large screens |

### Responsive Grid Patterns

```tsx
// 1 column mobile → 2 columns tablet → 3 columns desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// 1 column mobile → 2 columns tablet → 4 columns desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map(stat => <StatCard key={stat.id} {...stat} />)}
</div>

// Auto-fill with minimum width (flexible)
<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
  {cards.map(card => <Card key={card.id} {...card} />)}
</div>
```

### Responsive Typography

```tsx
// Headline: small on mobile, large on desktop
<h1 className="text-3xl md:text-5xl lg:text-7xl font-display font-bold text-[var(--color-text)]">
  Welcome
</h1>

// Subheadline: responsive sizing
<p className="text-lg md:text-xl lg:text-2xl text-[var(--color-muted)]">
  Subtitle text here
</p>

// Body text with responsive line length
<p className="text-base md:text-lg max-w-prose">
  Body text content...
</p>
```

### Responsive Spacing

```tsx
// Padding: tighter on mobile, looser on desktop
<section className="py-12 md:py-20 lg:py-24 px-4 md:px-8">

// Gap: smaller on mobile
<div className="flex flex-col md:flex-row gap-4 md:gap-8">

// Container with responsive padding
<div className="container mx-auto px-4 md:px-6 lg:px-8">
```

### Show/Hide Patterns

```tsx
// Hide on mobile, show on desktop
<nav className="hidden md:flex gap-6">

// Show on mobile, hide on desktop
<button className="md:hidden">Menu</button>

// Different content per breakpoint
<span className="md:hidden">Mobile Label</span>
<span className="hidden md:inline">Desktop Label with More Detail</span>
```

### Responsive Hero Section

```tsx
<section className="min-h-[60vh] md:min-h-[80vh] flex flex-col items-center justify-center text-center px-4 md:px-8">
  <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-[var(--color-text)] mb-4 md:mb-6">
    Ship Faster
  </h1>
  <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-xl md:max-w-2xl mb-6 md:mb-8">
    The tool that gets out of your way and helps you build better products.
  </p>
  <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
    <Button className="w-full sm:w-auto">Get Started</Button>
    <Button variant="outline" className="w-full sm:w-auto">Learn More</Button>
  </div>
</section>
```

### Responsive Navigation

```tsx
// Mobile: hamburger menu, Desktop: horizontal nav
<header className="flex items-center justify-between px-4 py-4">
  <Logo />

  {/* Desktop nav */}
  <nav className="hidden md:flex items-center gap-6">
    <a href="#features">Features</a>
    <a href="#pricing">Pricing</a>
    <Button>Sign Up</Button>
  </nav>

  {/* Mobile menu button */}
  <button className="md:hidden">
    <Menu className="h-6 w-6" />
  </button>
</header>
```

### Responsive Card Layout

```tsx
// Card with stacked layout on mobile, horizontal on desktop
<div className="flex flex-col md:flex-row bg-[var(--color-surface)] rounded-xl overflow-hidden">
  <div className="md:w-1/3">
    <img src={image} className="w-full h-48 md:h-full object-cover" />
  </div>
  <div className="p-4 md:p-6 md:w-2/3">
    <h3 className="text-xl md:text-2xl font-display">{title}</h3>
    <p className="mt-2 text-[var(--color-muted)]">{description}</p>
  </div>
</div>
```

### Common Responsive Patterns

| Pattern | Classes |
|---------|---------|
| Stack → Row | `flex flex-col md:flex-row` |
| Full width → Centered | `w-full md:max-w-xl md:mx-auto` |
| Single → Multi column | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| Hidden → Visible | `hidden md:block` |
| Visible → Hidden | `block md:hidden` |
| Small text → Large | `text-sm md:text-base lg:text-lg` |
| Tight padding → Loose | `p-4 md:p-6 lg:p-8` |

### Testing Responsive Designs

1. Start with mobile view (375px width)
2. Test at each breakpoint: 640px, 768px, 1024px, 1280px
3. Ensure no horizontal scroll
4. Verify touch targets are 44px+ on mobile
5. Check text readability at all sizes

### RULES

1. **Mobile-first always** — base styles for mobile, breakpoints for larger
2. **Use semantic breakpoints** — sm for phones, md for tablets, lg for desktop
3. **Don't hide essential content** — adapt layout, don't remove information
4. **Test all breakpoints** — verify layout at each size
5. **Keep touch targets large** — minimum 44x44px for interactive elements
6. **Use flexible units** — prefer % and rem over fixed px
