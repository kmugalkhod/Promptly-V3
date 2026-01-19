'use client'

export default function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-6 bg-white">
      <div className="container mx-auto max-w-4xl text-center">
        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
          Creative Developer & Designer
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
          I build elegant, functional digital products that solve real problems. Specializing in
          full-stack development with a focus on user experience.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#projects"
            className="px-8 py-3 bg-slate-900 text-white font-medium rounded hover:bg-slate-800 transition-colors"
          >
            View My Work
          </a>
          <a
            href="#contact"
            className="px-8 py-3 border border-slate-900 text-slate-900 font-medium rounded hover:bg-slate-50 transition-colors"
          >
            Contact Me
          </a>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-16 flex justify-center">
          <a
            href="#about"
            className="text-slate-400 hover:text-slate-600 transition-colors animate-bounce"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
