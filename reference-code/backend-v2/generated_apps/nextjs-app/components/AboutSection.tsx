'use client'

import { SKILLS } from '@/lib/data'
import SkillBadge from './SkillBadge'

export default function AboutSection() {
  // Group skills by category
  const skillsByCategory = SKILLS.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = []
      }
      acc[skill.category].push(skill)
      return acc
    },
    {} as Record<string, typeof SKILLS>
  )

  const categories = Object.keys(skillsByCategory).sort()

  return (
    <section id="about" className="py-20 px-6 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">About Me</h2>
          <div className="w-12 h-1 bg-slate-900"></div>
        </div>

        {/* Bio */}
        <div className="mb-16 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <p className="text-lg text-slate-600 leading-relaxed mb-4">
              I'm a full-stack developer with 5+ years of experience building web applications that
              users love. My passion lies in creating elegant solutions to complex problems,
              combining clean code with thoughtful design.
            </p>
            <p className="text-lg text-slate-600 leading-relaxed mb-4">
              When I'm not coding, you can find me exploring new technologies, contributing to
              open-source projects, or sharing knowledge with the developer community.
            </p>
            <p className="text-lg text-slate-600 leading-relaxed">
              I'm currently available for freelance projects and full-time opportunities. Let's
              build something amazing together!
            </p>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">50+</div>
              <div className="text-sm text-slate-600">Projects Completed</div>
            </div>
            <div className="bg-white p-4 rounded border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">30+</div>
              <div className="text-sm text-slate-600">Happy Clients</div>
            </div>
            <div className="bg-white p-4 rounded border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">5+</div>
              <div className="text-sm text-slate-600">Years Experience</div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-8">Skills & Tech Stack</h3>
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {skillsByCategory[category].map((skill) => (
                    <SkillBadge key={skill.name} name={skill.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
