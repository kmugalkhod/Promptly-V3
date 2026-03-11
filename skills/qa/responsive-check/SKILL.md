---
name: responsive-check
description: Validate responsive behavior of generated websites at mobile (375px) and desktop (1280px) viewports. Checks for overflow, broken layouts, and readability.
category: qa
agents: [qa]
---

## When to Use
- Comparing desktop vs mobile snapshots for responsive issues
- Checking for content overflow, broken layouts at mobile breakpoints
- Validating navigation adapts for small screens

## Instructions

### Viewport Commands

```
set viewport 375 812    # iPhone SE / small mobile
set viewport 1280 800   # Standard desktop
```

Always capture snapshots at BOTH viewports for comparison:
1. Desktop first (default 1280px) — `snapshot -i` + `screenshot`
2. Then mobile — `set viewport 375 812` + `snapshot -i` + `screenshot --full`
3. Reset — `set viewport 1280 800`

### Responsive Validation Checklist

**Content Overflow (CRITICAL):**
- At 375px, no element should be wider than the viewport
- Horizontal scrollbar at mobile is always a bug
- Common causes: fixed-width elements, long unbroken text, large images without max-width
- Snapshot signal: elements appearing that shouldn't exist at mobile, or text being cut off
- **Fix**: Add `max-w-full`, `overflow-hidden`, or `break-words` classes

**Text Readability:**
- Minimum font size at mobile: 14px (anything smaller is hard to read)
- Body text should be at least 16px on mobile
- If text is cramped or overlapping in mobile snapshot, it's too small
- **Fix**: Use responsive text classes (`text-sm md:text-base lg:text-lg`)

**Touch Targets:**
- Buttons and links should be at least 44x44px on mobile
- Closely spaced touch targets cause misclicks
- Snapshot signal: many interactive elements listed very close together
- **Fix**: Add `min-h-[44px] min-w-[44px]` or increase padding

**Navigation:**
- Desktop: horizontal navigation bar is fine
- Mobile: should collapse to hamburger menu, bottom nav, or stacked layout
- If snapshot shows same horizontal nav at 375px as at 1280px, navigation isn't responsive
- **Fix**: Use responsive visibility (`hidden md:flex` for desktop nav, `md:hidden` for mobile menu)

**Image Scaling:**
- Images should not overflow their container at mobile
- Use `max-w-full h-auto` or `object-cover` with fixed container
- Background images should still be visible at mobile
- **Fix**: Add `w-full max-w-full` to image elements

**Grid/Flex Layouts:**
- Multi-column grids should stack on mobile
- 3+ column layouts MUST become 1-2 columns at 375px
- Snapshot signal: at mobile, columns should appear as sequential sections instead of side-by-side
- **Fix**: Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Cards and Containers:**
- Cards should be full-width on mobile, not side-by-side
- Padding should reduce on mobile (e.g., `p-4 md:p-6 lg:p-8`)
- Content shouldn't have excessive horizontal padding at mobile (wastes space)
- **Fix**: Use responsive padding and width classes

### Common Tailwind Responsive Issues in Generated Code

| Issue | Pattern | Fix |
|-------|---------|-----|
| Grid doesn't stack | `grid-cols-3` without responsive | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| Fixed width element | `w-[600px]` | `w-full max-w-[600px]` |
| Text overflow | Long text in flex child | Add `min-w-0` to flex child, `break-words` to text |
| Image overflow | `<img>` without width constraint | Add `max-w-full h-auto` |
| Nav doesn't collapse | `flex gap-4` for nav items | Add mobile hamburger with `hidden md:flex` |
| Padding too large on mobile | `p-12` everywhere | `p-4 md:p-8 lg:p-12` |
| Hero text too large on mobile | `text-6xl` fixed | `text-3xl md:text-5xl lg:text-6xl` |

### Severity Classification

- **critical**: Page completely unusable at mobile (all content overflows, nothing visible)
- **major**: Navigation broken at mobile, content overflow causing horizontal scroll, grid doesn't stack
- **minor**: Slight padding issues, text could be larger, minor spacing differences
