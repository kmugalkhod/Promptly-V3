'use client'

import { useEffect, useState } from 'react'
import { NAV_LINKS } from '@/lib/data'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white border-b border-slate-200 shadow-sm'
          : 'bg-white border-b border-slate-100'
      }`}
    >
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#"
          className="text-xl font-bold text-slate-900 tracking-tight hover:text-slate-700 transition-colors"
        >
          Portfolio
        </a>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA Button */}
        <a
          href="#contact"
          className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded hover:bg-slate-800 transition-colors"
        >
          Get in Touch
        </a>
      </div>
    </nav>
  )
}
