'use client'

import { Project } from '@/types'
import SkillBadge from './SkillBadge'

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="relative overflow-hidden bg-slate-100 h-48 md:h-56">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 mb-2">{project.title}</h3>

        {/* Description */}
        <p className="text-slate-600 text-sm leading-relaxed mb-4">{project.description}</p>

        {/* Technologies */}
        <div className="flex flex-wrap gap-2 mb-6">
          {project.technologies.map((tech) => (
            <SkillBadge key={tech} name={tech} variant="default" />
          ))}
        </div>

        {/* Links */}
        <div className="flex gap-4 items-center pt-4 border-t border-slate-200">
          <a
            href={project.link}
            className="text-sm font-medium text-slate-900 hover:text-slate-600 transition-colors"
          >
            View Project →
          </a>
          {project.github && (
            <a
              href={project.github}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
