'use client'

import ContactForm from './ContactForm'

export default function ContactSection() {
  return (
    <section id="contact" className="py-20 px-6 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Let's Work Together</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Have a project in mind? I'd love to hear about it. Get in touch and let's create
            something amazing.
          </p>
        </div>

        {/* Contact Form */}
        <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
          <ContactForm />
        </div>

        {/* Social Links */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 mb-6">Or reach out directly on social media:</p>
          <div className="flex justify-center gap-6">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              Twitter
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
