'use client'

import { PROJECTS } from '@/lib/data'
import ProjectCard from './ProjectCard'

export default function ProjectsGrid() {
  return (
    <section id="projects" className="py-20 px-6 bg-white border-t border-slate-200">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Featured Projects</h2>
          <div className="w-12 h-1 bg-slate-900"></div>
        </div>

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROJECTS.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* View All CTA */}
        <div className="mt-12 text-center">
          <a
            href="#"
            className="inline-block px-6 py-3 border border-slate-900 text-slate-900 font-medium rounded hover:bg-slate-50 transition-colors"
          >
            View All Projects
          </a>
        </div>
      </div>
    </section>
  )
}
