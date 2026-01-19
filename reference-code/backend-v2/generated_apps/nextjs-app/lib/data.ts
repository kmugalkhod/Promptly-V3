import { Project, Skill } from '@/types'

export const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
]

export const SKILLS: Skill[] = [
  // Frontend
  { name: 'React', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'TypeScript', category: 'Frontend' },
  { name: 'Tailwind CSS', category: 'Frontend' },
  { name: 'JavaScript', category: 'Frontend' },
  
  // Backend
  { name: 'Node.js', category: 'Backend' },
  { name: 'Express', category: 'Backend' },
  { name: 'PostgreSQL', category: 'Backend' },
  { name: 'MongoDB', category: 'Backend' },
  { name: 'REST APIs', category: 'Backend' },
  
  // Tools
  { name: 'Git', category: 'Tools' },
  { name: 'Docker', category: 'Tools' },
  { name: 'AWS', category: 'Tools' },
  { name: 'Figma', category: 'Tools' },
  { name: 'Vercel', category: 'Tools' },
]

export const PROJECTS: Project[] = [
  {
    id: '1',
    title: 'E-Commerce Platform',
    description: 'Full-stack e-commerce application with product catalog, shopping cart, and secure payment integration. Features user authentication, order tracking, and admin dashboard.',
    image: 'https://images.unsplash.com/photo-1661956600684-34aa3443c7b1?w=600&h=400&fit=crop',
    technologies: ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'Stripe'],
    link: '#',
    github: '#',
  },
  {
    id: '2',
    title: 'Task Management App',
    description: 'Collaborative task management tool with real-time updates, team collaboration features, and custom workflows. Includes drag-and-drop interface and progress tracking.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
    technologies: ['React', 'Firebase', 'Tailwind CSS', 'TypeScript'],
    link: '#',
    github: '#',
  },
  {
    id: '3',
    title: 'Weather Dashboard',
    description: 'Real-time weather application with geolocation support, detailed forecasts, and weather alerts. Built with responsive design for mobile and desktop viewing.',
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600&h=400&fit=crop',
    technologies: ['React', 'OpenWeather API', 'Chart.js', 'Tailwind CSS'],
    link: '#',
    github: '#',
  },
  {
    id: '4',
    title: 'Portfolio Generator',
    description: 'Tool to generate stunning portfolios from JSON configuration. Features customizable templates, responsive design, and one-click deployment to Vercel.',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop',
    technologies: ['Next.js', 'React', 'Tailwind CSS', 'Vercel API'],
    link: '#',
    github: '#',
  },
  {
    id: '5',
    title: 'Blog Platform',
    description: 'Content management system for creating and publishing blog posts. Includes markdown support, SEO optimization, and comment system with moderation.',
    image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=400&fit=crop',
    technologies: ['Next.js', 'Markdown', 'MongoDB', 'NextAuth'],
    link: '#',
    github: '#',
  },
  {
    id: '6',
    title: 'Social Media Analytics',
    description: 'Analytics dashboard for tracking social media performance across platforms. Visualizes metrics with interactive charts and provides actionable insights.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop',
    technologies: ['React', 'Chart.js', 'Node.js', 'PostgreSQL'],
    link: '#',
    github: '#',
  },
]
