export interface Project {
  id: string
  title: string
  description: string
  image: string
  technologies: string[]
  link: string
  github?: string
}

export interface Skill {
  name: string
  category: string
}

export interface NavLink {
  label: string
  href: string
}
