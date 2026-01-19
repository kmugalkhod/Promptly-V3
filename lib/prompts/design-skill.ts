/**
 * Design Skill Module
 *
 * Provides sophisticated design guidelines for the website generator.
 * Includes curated font pairings, color systems, motion patterns,
 * spatial composition, and anti-patterns to avoid.
 */

/**
 * Curated font pairings for distinctive designs.
 * Each pairing has a display font (headings) and body font (text).
 */
export const FONT_PAIRINGS = {
  editorial: {
    display: "Playfair Display",
    body: "Source Serif 4",
    description: "Classic editorial feel, sophisticated and readable",
    weights: { display: "400;700", body: "400;600" },
  },
  brutalist: {
    display: "Space Mono",
    body: "Work Sans",
    description: "Raw, technical, high-contrast typography",
    weights: { display: "400;700", body: "400;500;600" },
  },
  playful: {
    display: "Fredoka",
    body: "Nunito",
    description: "Friendly, approachable, warm personality",
    weights: { display: "400;600", body: "400;600" },
  },
  luxury: {
    display: "Cormorant Garamond",
    body: "Montserrat",
    description: "Elegant, refined, premium feel",
    weights: { display: "400;600", body: "400;500" },
  },
  retro: {
    display: "Righteous",
    body: "Poppins",
    description: "Nostalgic, bold, statement-making",
    weights: { display: "400", body: "400;500;600" },
  },
  geometric: {
    display: "Outfit",
    body: "Inter",
    description: "Clean, modern, tech-forward",
    weights: { display: "400;600;700", body: "400;500" },
  },
  humanist: {
    display: "Fraunces",
    body: "Source Sans 3",
    description: "Warm, organic, human-centered",
    weights: { display: "400;700", body: "400;600" },
  },
  minimal: {
    display: "DM Sans",
    body: "DM Sans",
    description: "Ultra-clean, same family, subtle contrast",
    weights: { display: "400;500;700", body: "400;500" },
  },
  bold: {
    display: "Bebas Neue",
    body: "Open Sans",
    description: "Impactful headlines, clean body text",
    weights: { display: "400", body: "400;600" },
  },
  elegant: {
    display: "Libre Baskerville",
    body: "Karla",
    description: "Timeless serif display, modern sans body",
    weights: { display: "400;700", body: "400;500" },
  },
} as const;

/**
 * Aesthetic-specific color palettes with mood and usage guidance.
 */
export const COLOR_PALETTES = {
  "brutally-minimal": {
    primary: "#000000",
    accent: "#000000",
    background: "#ffffff",
    surface: "#f5f5f5",
    text: "#000000",
    muted: "#737373",
    mood: "stark, honest, raw",
  },
  maximalist: {
    primary: "#7c3aed",
    accent: "#f472b6",
    background: "#faf5ff",
    surface: "#ffffff",
    text: "#1e1b4b",
    muted: "#6b7280",
    mood: "vibrant, energetic, bold",
  },
  "retro-futuristic": {
    primary: "#06b6d4",
    accent: "#f97316",
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    muted: "#94a3b8",
    mood: "neon, cyberpunk, dynamic",
  },
  "organic-natural": {
    primary: "#059669",
    accent: "#d97706",
    background: "#fefce8",
    surface: "#ffffff",
    text: "#1c1917",
    muted: "#57534e",
    mood: "earthy, calm, sustainable",
  },
  "luxury-refined": {
    primary: "#78716c",
    accent: "#b45309",
    background: "#1c1917",
    surface: "#292524",
    text: "#fafaf9",
    muted: "#a8a29e",
    mood: "sophisticated, exclusive, premium",
  },
  playful: {
    primary: "#ec4899",
    accent: "#8b5cf6",
    background: "#fff7ed",
    surface: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
    mood: "fun, energetic, youthful",
  },
  editorial: {
    primary: "#1e3a5f",
    accent: "#dc2626",
    background: "#fffbeb",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    mood: "journalistic, authoritative, classic",
  },
  brutalist: {
    primary: "#ef4444",
    accent: "#facc15",
    background: "#e5e5e5",
    surface: "#ffffff",
    text: "#000000",
    muted: "#525252",
    mood: "raw, confrontational, bold",
  },
  "art-deco": {
    primary: "#ca8a04",
    accent: "#0d9488",
    background: "#1c1917",
    surface: "#292524",
    text: "#fef3c7",
    muted: "#a8a29e",
    mood: "glamorous, geometric, opulent",
  },
  "soft-pastel": {
    primary: "#a78bfa",
    accent: "#fb7185",
    background: "#fdf4ff",
    surface: "#ffffff",
    text: "#374151",
    muted: "#9ca3af",
    mood: "gentle, dreamy, calming",
  },
  industrial: {
    primary: "#f97316",
    accent: "#22d3ee",
    background: "#18181b",
    surface: "#27272a",
    text: "#e4e4e7",
    muted: "#71717a",
    mood: "rugged, urban, mechanical",
  },
} as const;

/**
 * Dark mode color palettes - each aesthetic has light/dark variants.
 * Light colors are for light mode, dark colors are for dark mode.
 */
export const COLOR_PALETTES_DARK = {
  "brutally-minimal": {
    light: {
      primary: "#000000",
      accent: "#000000",
      background: "#ffffff",
      surface: "#f5f5f5",
      text: "#000000",
      muted: "#737373",
    },
    dark: {
      primary: "#ffffff",
      accent: "#ffffff",
      background: "#000000",
      surface: "#171717",
      text: "#ffffff",
      muted: "#a3a3a3",
    },
  },
  maximalist: {
    light: {
      primary: "#7c3aed",
      accent: "#f472b6",
      background: "#faf5ff",
      surface: "#ffffff",
      text: "#1e1b4b",
      muted: "#6b7280",
    },
    dark: {
      primary: "#a78bfa",
      accent: "#f9a8d4",
      background: "#1e1b4b",
      surface: "#2e2a5e",
      text: "#f5f3ff",
      muted: "#a5b4fc",
    },
  },
  "retro-futuristic": {
    light: {
      primary: "#06b6d4",
      accent: "#f97316",
      background: "#f0f9ff",
      surface: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
    },
    dark: {
      primary: "#22d3ee",
      accent: "#fb923c",
      background: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      muted: "#94a3b8",
    },
  },
  "organic-natural": {
    light: {
      primary: "#059669",
      accent: "#d97706",
      background: "#fefce8",
      surface: "#ffffff",
      text: "#1c1917",
      muted: "#57534e",
    },
    dark: {
      primary: "#34d399",
      accent: "#fbbf24",
      background: "#1c1917",
      surface: "#292524",
      text: "#fafaf9",
      muted: "#a8a29e",
    },
  },
  "luxury-refined": {
    light: {
      primary: "#78716c",
      accent: "#b45309",
      background: "#fafaf9",
      surface: "#ffffff",
      text: "#1c1917",
      muted: "#78716c",
    },
    dark: {
      primary: "#a8a29e",
      accent: "#d97706",
      background: "#1c1917",
      surface: "#292524",
      text: "#fafaf9",
      muted: "#a8a29e",
    },
  },
  playful: {
    light: {
      primary: "#ec4899",
      accent: "#8b5cf6",
      background: "#fff7ed",
      surface: "#ffffff",
      text: "#1f2937",
      muted: "#6b7280",
    },
    dark: {
      primary: "#f472b6",
      accent: "#a78bfa",
      background: "#1f2937",
      surface: "#374151",
      text: "#f9fafb",
      muted: "#9ca3af",
    },
  },
  editorial: {
    light: {
      primary: "#1e3a5f",
      accent: "#dc2626",
      background: "#fffbeb",
      surface: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
    },
    dark: {
      primary: "#3b82f6",
      accent: "#ef4444",
      background: "#0f172a",
      surface: "#1e293b",
      text: "#f8fafc",
      muted: "#94a3b8",
    },
  },
  brutalist: {
    light: {
      primary: "#ef4444",
      accent: "#facc15",
      background: "#e5e5e5",
      surface: "#ffffff",
      text: "#000000",
      muted: "#525252",
    },
    dark: {
      primary: "#f87171",
      accent: "#fde047",
      background: "#171717",
      surface: "#262626",
      text: "#fafafa",
      muted: "#a3a3a3",
    },
  },
  "art-deco": {
    light: {
      primary: "#ca8a04",
      accent: "#0d9488",
      background: "#fffbeb",
      surface: "#ffffff",
      text: "#1c1917",
      muted: "#78716c",
    },
    dark: {
      primary: "#eab308",
      accent: "#14b8a6",
      background: "#1c1917",
      surface: "#292524",
      text: "#fef3c7",
      muted: "#a8a29e",
    },
  },
  "soft-pastel": {
    light: {
      primary: "#a78bfa",
      accent: "#fb7185",
      background: "#fdf4ff",
      surface: "#ffffff",
      text: "#374151",
      muted: "#9ca3af",
    },
    dark: {
      primary: "#c4b5fd",
      accent: "#fda4af",
      background: "#1e1b4b",
      surface: "#2e2a5e",
      text: "#f5f3ff",
      muted: "#a5b4fc",
    },
  },
  industrial: {
    light: {
      primary: "#f97316",
      accent: "#22d3ee",
      background: "#f4f4f5",
      surface: "#ffffff",
      text: "#18181b",
      muted: "#71717a",
    },
    dark: {
      primary: "#fb923c",
      accent: "#67e8f9",
      background: "#18181b",
      surface: "#27272a",
      text: "#e4e4e7",
      muted: "#71717a",
    },
  },
} as const;

/**
 * Motion pattern definitions with CSS/Tailwind examples.
 */
export const MOTION_PATTERNS = {
  none: {
    description: "No animations, instant state changes",
    transition: "transition-none",
    hover: "",
    example: "Static, print-like aesthetic",
  },
  subtle: {
    description: "Barely perceptible, professional feel",
    transition: "transition-all duration-200 ease-out",
    hover: "hover:translate-y-[-1px] hover:shadow-sm",
    example: "Button lifts 1px on hover",
  },
  expressive: {
    description: "Noticeable but not distracting",
    transition: "transition-all duration-300 ease-out",
    hover: "hover:translate-y-[-4px] hover:shadow-lg hover:scale-[1.02]",
    example: "Cards lift and scale on hover",
  },
  dramatic: {
    description: "Bold, theatrical movements",
    transition: "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    hover: "hover:translate-y-[-8px] hover:shadow-2xl hover:scale-105 hover:rotate-1",
    example: "Elements bounce and rotate on interaction",
  },
} as const;

/**
 * Spatial composition patterns.
 */
export const SPATIAL_PATTERNS = {
  symmetric: {
    description: "Balanced, centered layouts",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
    container: "max-w-6xl mx-auto px-4",
    alignment: "text-center items-center justify-center",
  },
  asymmetric: {
    description: "Intentionally unbalanced, dynamic tension",
    grid: "grid-cols-12 gap-4",
    container: "max-w-7xl ml-auto mr-8 px-4",
    alignment: "text-left items-start",
    note: "Use col-span-5 and col-span-7 for asymmetry",
  },
  "grid-breaking": {
    description: "Elements that escape their containers",
    grid: "grid-cols-1 gap-0",
    container: "max-w-4xl mx-auto px-4 relative",
    alignment: "text-left",
    note: "Use negative margins and absolute positioning",
  },
  overlapping: {
    description: "Layered elements with z-index play",
    grid: "relative",
    container: "max-w-6xl mx-auto px-4",
    alignment: "text-left",
    note: "Use -mt-12 -ml-4 with z-10 z-20 for overlap",
  },
} as const;

/**
 * Background texture patterns (CSS-only, no images).
 */
export const TEXTURE_PATTERNS = {
  clean: {
    css: "",
    description: "Solid colors only",
  },
  noise: {
    css: `background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");`,
    description: "Subtle grain texture overlay",
    opacity: "opacity-[0.03]",
  },
  "gradient-mesh": {
    css: `background:
      radial-gradient(at 40% 20%, var(--color-primary) 0px, transparent 50%),
      radial-gradient(at 80% 0%, var(--color-accent) 0px, transparent 50%),
      radial-gradient(at 0% 50%, var(--color-primary) 0px, transparent 50%);`,
    description: "Soft blurred color blobs",
    opacity: "opacity-30",
  },
  geometric: {
    css: `background-image:
      linear-gradient(30deg, var(--color-muted) 12%, transparent 12.5%, transparent 87%, var(--color-muted) 87.5%, var(--color-muted)),
      linear-gradient(150deg, var(--color-muted) 12%, transparent 12.5%, transparent 87%, var(--color-muted) 87.5%, var(--color-muted)),
      linear-gradient(30deg, var(--color-muted) 12%, transparent 12.5%, transparent 87%, var(--color-muted) 87.5%, var(--color-muted)),
      linear-gradient(150deg, var(--color-muted) 12%, transparent 12.5%, transparent 87%, var(--color-muted) 87.5%, var(--color-muted));
    background-size: 80px 140px;
    background-position: 0 0, 0 0, 40px 70px, 40px 70px;`,
    description: "Repeating geometric pattern",
    opacity: "opacity-[0.02]",
  },
} as const;

/**
 * Component templates for landing page sections.
 * Each template provides a proven pattern for common landing page elements.
 */
export const COMPONENT_TEMPLATES = {
  "hero-centered": {
    description: "Centered hero with headline, subheadline, and CTA buttons",
    structure: `
<section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 bg-[var(--color-background)]">
  <h1 className="font-display text-5xl md:text-7xl font-bold text-[var(--color-text)] mb-6">
    {headline}
  </h1>
  <p className="text-xl text-[var(--color-muted)] max-w-2xl mb-8">
    {subheadline}
  </p>
  <div className="flex gap-4">
    <Button className="bg-[var(--color-primary)] text-white">{primaryCTA}</Button>
    <Button variant="outline" className="border-[var(--color-primary)] text-[var(--color-primary)]">{secondaryCTA}</Button>
  </div>
</section>`,
  },
  "hero-split": {
    description: "Split hero with content left, image/visual right",
    structure: `
<section className="min-h-[80vh] grid md:grid-cols-2 gap-12 items-center px-4 md:px-12 bg-[var(--color-background)]">
  <div className="space-y-6">
    <h1 className="font-display text-4xl md:text-6xl font-bold text-[var(--color-text)]">
      {headline}
    </h1>
    <p className="text-lg text-[var(--color-muted)]">
      {subheadline}
    </p>
    <div className="flex gap-4">
      <Button className="bg-[var(--color-primary)] text-white">{primaryCTA}</Button>
      <Button variant="outline">{secondaryCTA}</Button>
    </div>
  </div>
  <div className="bg-[var(--color-surface)] rounded-2xl aspect-video flex items-center justify-center">
    {/* Image or visual content */}
  </div>
</section>`,
  },
  "features-grid": {
    description: "3-column grid of feature cards with icons",
    structure: `
<section className="py-20 px-4 bg-[var(--color-background)]">
  <div className="max-w-6xl mx-auto">
    <h2 className="font-display text-3xl md:text-4xl font-bold text-center text-[var(--color-text)] mb-12">
      {sectionTitle}
    </h2>
    <div className="grid md:grid-cols-3 gap-8">
      {features.map((feature) => (
        <div key={feature.id} className="bg-[var(--color-surface)] p-6 rounded-xl shadow-md hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center mb-4">
            {feature.icon}
          </div>
          <h3 className="font-display text-xl font-semibold text-[var(--color-text)] mb-2">
            {feature.title}
          </h3>
          <p className="text-[var(--color-muted)]">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>`,
  },
  "features-alternating": {
    description: "Alternating left-right feature sections with images",
    structure: `
<section className="py-20 px-4 bg-[var(--color-background)]">
  <div className="max-w-6xl mx-auto space-y-20">
    {features.map((feature, index) => (
      <div
        key={feature.id}
        className={\`grid md:grid-cols-2 gap-12 items-center \${index % 2 === 1 ? 'md:flex-row-reverse' : ''}\`}
      >
        <div className={index % 2 === 1 ? 'md:order-2' : ''}>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-4">
            {feature.title}
          </h3>
          <p className="text-lg text-[var(--color-muted)] mb-6">
            {feature.description}
          </p>
          <Button variant="outline">{feature.cta}</Button>
        </div>
        <div className={\`bg-[var(--color-surface)] rounded-2xl aspect-video \${index % 2 === 1 ? 'md:order-1' : ''}\`}>
          {/* Image placeholder */}
        </div>
      </div>
    ))}
  </div>
</section>`,
  },
  "pricing-cards": {
    description: "3-tier pricing cards with highlighted recommended plan",
    structure: `
<section className="py-20 px-4 bg-[var(--color-background)]">
  <div className="max-w-6xl mx-auto">
    <h2 className="font-display text-3xl md:text-4xl font-bold text-center text-[var(--color-text)] mb-4">
      {sectionTitle}
    </h2>
    <p className="text-center text-[var(--color-muted)] mb-12 max-w-2xl mx-auto">
      {sectionSubtitle}
    </p>
    <div className="grid md:grid-cols-3 gap-8">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={\`bg-[var(--color-surface)] p-8 rounded-2xl \${plan.recommended ? 'ring-2 ring-[var(--color-primary)] scale-105' : ''}\`}
        >
          {plan.recommended && (
            <span className="bg-[var(--color-primary)] text-white text-sm px-3 py-1 rounded-full">
              Recommended
            </span>
          )}
          <h3 className="font-display text-2xl font-bold text-[var(--color-text)] mt-4">
            {plan.name}
          </h3>
          <div className="mt-4 mb-6">
            <span className="text-4xl font-bold text-[var(--color-text)]">{plan.price}</span>
            <span className="text-[var(--color-muted)]">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-[var(--color-muted)]">
                <Check className="w-5 h-5 text-[var(--color-primary)]" />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            className={\`w-full \${plan.recommended ? 'bg-[var(--color-primary)] text-white' : 'variant-outline'}\`}
          >
            Get Started
          </Button>
        </div>
      ))}
    </div>
  </div>
</section>`,
  },
  "testimonials-carousel": {
    description: "Customer testimonials in card format",
    structure: `
<section className="py-20 px-4 bg-[var(--color-surface)]">
  <div className="max-w-6xl mx-auto">
    <h2 className="font-display text-3xl md:text-4xl font-bold text-center text-[var(--color-text)] mb-12">
      {sectionTitle}
    </h2>
    <div className="grid md:grid-cols-3 gap-8">
      {testimonials.map((testimonial) => (
        <div key={testimonial.id} className="bg-[var(--color-background)] p-6 rounded-xl shadow-md">
          <p className="text-[var(--color-text)] mb-6 italic">
            "{testimonial.quote}"
          </p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center">
              <span className="text-[var(--color-primary)] font-bold">
                {testimonial.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text)]">{testimonial.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{testimonial.role}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>`,
  },
} as const;

/**
 * Anti-patterns to explicitly avoid (the "AI slop" we're fighting against).
 */
export const ANTI_PATTERNS = [
  "Using Inter font for everything (default = forgettable)",
  "Purple/blue gradient backgrounds (overused AI aesthetic)",
  "Generic slate-500 color scheme with no personality",
  "Perfectly symmetrical layouts (feels templated)",
  "No motion at all OR over-animated everything",
  "Stock photo hero sections with generic headlines",
  "Cards with identical shadows and rounded corners",
  "Using only Tailwind defaults without customization",
  "Centered everything with max-w-4xl (blog post layout for non-blogs)",
  "Generic 'Welcome to...' or 'Get Started' headlines",
] as const;

/**
 * Spacing scale systems for consistent rhythm.
 * Choose based on content density needs.
 */
export const SPACING_SCALES = {
  tight: {
    description: "Dense, compact layouts for data-heavy apps",
    base: "4px",
    scale: [4, 6, 8, 12, 16, 24, 32],
    gap: "gap-1 gap-2 gap-3",
    padding: "p-1 p-2 p-3 p-4",
    example: "Dashboards, admin panels, data tables",
  },
  normal: {
    description: "Balanced spacing for most applications",
    base: "4px",
    scale: [4, 8, 12, 16, 24, 32, 48, 64],
    gap: "gap-2 gap-3 gap-4 gap-6",
    padding: "p-2 p-4 p-6 p-8",
    example: "Todo apps, forms, general CRUD apps",
  },
  loose: {
    description: "Generous whitespace for premium/editorial feel",
    base: "8px",
    scale: [8, 16, 24, 32, 48, 64, 96, 128],
    gap: "gap-4 gap-6 gap-8 gap-12",
    padding: "p-4 p-6 p-8 p-12",
    example: "Landing pages, portfolios, marketing sites",
  },
} as const;

/**
 * Shadow depth systems for consistent elevation.
 * Match to aesthetic - minimal uses flat, playful uses elevated.
 */
export const SHADOW_SYSTEMS = {
  flat: {
    description: "No shadows, relies on borders/color for depth",
    base: "shadow-none",
    hover: "hover:shadow-none",
    card: "shadow-none border border-[var(--color-muted)]/20",
    example: "Brutalist, brutally-minimal aesthetics",
  },
  subtle: {
    description: "Barely visible shadows, professional feel",
    base: "shadow-sm",
    hover: "hover:shadow-md",
    card: "shadow-sm hover:shadow-md transition-shadow",
    example: "Minimal, geometric, editorial aesthetics",
  },
  elevated: {
    description: "Clear depth hierarchy, modern SaaS feel",
    base: "shadow-md",
    hover: "hover:shadow-lg",
    card: "shadow-md hover:shadow-lg transition-shadow",
    example: "Most web apps, dashboards, playful aesthetics",
  },
  dramatic: {
    description: "Bold shadows, strong depth, premium feel",
    base: "shadow-lg",
    hover: "hover:shadow-xl",
    card: "shadow-xl hover:shadow-2xl transition-shadow",
    example: "Luxury, art-deco, maximalist aesthetics",
  },
} as const;

/**
 * Border radius systems for consistent shape language.
 * Match to aesthetic - brutalist uses sharp, playful uses pill.
 */
export const RADIUS_SYSTEMS = {
  sharp: {
    description: "No rounding, raw geometric shapes",
    button: "rounded-none",
    card: "rounded-none",
    input: "rounded-none",
    badge: "rounded-none",
    example: "Brutalist, industrial aesthetics",
  },
  subtle: {
    description: "Slight rounding, professional feel",
    button: "rounded",
    card: "rounded-lg",
    input: "rounded",
    badge: "rounded",
    example: "Editorial, minimal, geometric aesthetics",
  },
  rounded: {
    description: "Noticeable rounding, friendly modern feel",
    button: "rounded-lg",
    card: "rounded-xl",
    input: "rounded-lg",
    badge: "rounded-full",
    example: "Most web apps, soft-pastel, organic aesthetics",
  },
  pill: {
    description: "Maximum rounding, playful bubbly feel",
    button: "rounded-full",
    card: "rounded-2xl",
    input: "rounded-full",
    badge: "rounded-full",
    example: "Playful, maximalist aesthetics",
  },
} as const;

/**
 * Compact design skill for embedding in coder prompt (~50 lines).
 * Contains essential guidance without overwhelming the prompt.
 */
export const DESIGN_SKILL_COMPACT = `
## DESIGN SKILL - Create Distinctive, Memorable UIs

### Font Loading (REQUIRED in layout.tsx)
\`\`\`tsx
import { Display_Font, Body_Font } from 'next/font/google'
const displayFont = Display_Font({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700']
})
const bodyFont = Body_Font({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600']
})

// In <html> tag:
<html lang="en" className={\`\${displayFont.variable} \${bodyFont.variable}\`}>
<body className="font-body">
\`\`\`

### CSS Variables (REQUIRED in globals.css after @import "tailwindcss")
\`\`\`css
:root {
  --font-display: 'Font Name', serif;
  --font-body: 'Font Name', sans-serif;
  --color-primary: /* from DESIGN_DIRECTION */;
  --color-accent: /* from DESIGN_DIRECTION */;
  --color-background: /* from DESIGN_DIRECTION */;
  --color-surface: /* from DESIGN_DIRECTION */;
  --color-text: /* from DESIGN_DIRECTION */;
  --color-muted: /* from DESIGN_DIRECTION */;
}

.font-display { font-family: var(--font-display); }
.font-body { font-family: var(--font-body); }
\`\`\`

### Typography Rules
- Headings: \`className="font-display text-[--color-text]"\`
- Body text: \`className="font-body text-[--color-muted]"\`
- Use responsive sizes: text-3xl md:text-5xl lg:text-6xl
- Create hierarchy with weight AND size, not just size

### Motion Levels
- none: No transitions
- subtle: \`transition-all duration-200\` + \`hover:translate-y-[-1px]\`
- expressive: \`transition-all duration-300\` + \`hover:scale-[1.02] hover:shadow-lg\`
- dramatic: \`transition-all duration-500\` + \`hover:scale-105 hover:rotate-1\`

### NEVER DO (AI Slop)
- Inter font with slate colors (default = forgettable)
- Purple gradient backgrounds (overused)
- All cards identical with same shadows
- Everything centered with max-w-4xl
- No personality, no signature element

### ALWAYS DO
- Use fonts from DESIGN_DIRECTION (not Inter!)
- Add one signature_element that's memorable
- Match motion_level from architecture
- Use color palette consistently
- Break from perfect symmetry when spatial_style allows
`;

/**
 * Full design guidelines (for reference, not embedded in prompts).
 */
export const DESIGN_SKILL_FULL = `
# Frontend Design Skill - Complete Reference

## Philosophy
Great design is distinctive and memorable. It has personality.
Generic design (Inter font, purple gradients, perfect grids) is forgettable.
Every project should have at least ONE thing that makes it visually unique.

## Font Pairing Reference
${Object.entries(FONT_PAIRINGS)
  .map(
    ([key, val]) =>
      `- ${key}: "${val.display}" + "${val.body}" - ${val.description}`
  )
  .join("\n")}

## Color Palette Reference
${Object.entries(COLOR_PALETTES)
  .map(([key, val]) => `- ${key}: ${val.mood} (primary: ${val.primary})`)
  .join("\n")}

## Motion Patterns
${Object.entries(MOTION_PATTERNS)
  .map(([key, val]) => `- ${key}: ${val.description}`)
  .join("\n")}

## Spatial Composition
${Object.entries(SPATIAL_PATTERNS)
  .map(([key, val]) => `- ${key}: ${val.description}`)
  .join("\n")}

## Anti-Patterns to Avoid
${ANTI_PATTERNS.map((p) => `- ${p}`).join("\n")}
`;
