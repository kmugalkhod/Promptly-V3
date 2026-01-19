# Portfolio Website

A minimal, elegant personal portfolio showcasing projects, skills, and contact information with smooth scrolling and responsive design.

## Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Smooth Scrolling**: Seamless navigation between sections using anchor links
- **Sticky Navigation**: Fixed navbar that adapts based on scroll position
- **Project Showcase**: Grid display of featured projects with descriptions and technologies
- **Skills Section**: Organized by category (Frontend, Backend, Tools)
- **Contact Form**: Functional form for inquiries with validation
- **Social Links**: Easy access to social media profiles
- **Dark Footer**: Professional footer with back-to-top functionality
- **Clean Aesthetic**: Minimal design with whitespace, typography-focused layout

## Tech Stack

- **Framework**: Next.js 16 with React
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **TypeScript**: Type-safe implementation

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── globals.css         # Global styles
│   └── page.tsx            # Home page
├── components/
│   ├── Navbar.tsx          # Fixed header navigation
│   ├── HeroSection.tsx      # Full-height intro section
│   ├── AboutSection.tsx     # Bio and skills showcase
│   ├── SkillBadge.tsx       # Skill/technology badge component
│   ├── ProjectCard.tsx      # Individual project display
│   ├── ProjectsGrid.tsx     # Project grid layout
│   ├── ContactForm.tsx      # Contact form with validation
│   ├── ContactSection.tsx   # Contact section with form
│   └── Footer.tsx           # Footer with links and back-to-top
├── types/
│   └── index.ts            # TypeScript interfaces
└── lib/
    └── data.ts             # Mock data and constants

```

## Sections

### Hero Section
- Large headline with subheading
- Call-to-action buttons
- Scroll indicator animation

### About Section
- Personal biography
- Quick stats (projects, clients, experience)
- Organized skill categories (Frontend, Backend, Tools)

### Projects Section
- Responsive project grid (3 columns on desktop, 2 on tablet, 1 on mobile)
- Project cards with images, descriptions, and tech tags
- Links to project demos and GitHub repositories

### Contact Section
- Functional contact form with name, email, and message fields
- Social media links
- Success feedback message

### Footer
- Navigation links
- Social media links
- Copyright information
- Back-to-top button (visible after scrolling)

## Customization

### Update Content
Edit `lib/data.ts` to customize:
- Navigation links
- Skills and technologies
- Project portfolio

### Update Colors
The portfolio uses a minimal slate color scheme. To modify:
1. Edit `app/globals.css` for theme colors
2. Update Tailwind classes in components

### Update Contact Form
The form currently logs to console. To add real email functionality:
1. Implement an API route in `app/api/contact/route.ts`
2. Update the `handleSubmit` function in `ContactForm.tsx`

## Responsive Breakpoints

- **Mobile**: < 640px - Single column layouts
- **Tablet**: 640px - 1024px - Two column layouts
- **Desktop**: > 1024px - Three column layouts

## Performance Optimizations

- Server-side rendering for fast initial load
- Client-side hydration for interactivity
- Optimized images with lazy loading
- Minimal CSS with Tailwind utility classes
- Smooth transitions and animations

## Deployment

Deploy to Vercel or any Node.js hosting:

```bash
npm run build
npm start
```

## License

Open source - feel free to use this as a template for your portfolio.
