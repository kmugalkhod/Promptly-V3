'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log('Form submitted:', formData)
    setSubmitted(true)
    setFormData({ name: '', email: '', message: '' })
    setIsLoading(false)

    // Reset success message after 5 seconds
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-slate-900 font-medium">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          value={formData.name}
          onChange={handleChange}
          required
          className="border-slate-200 focus:border-slate-900"
        />
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-900 font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your.email@example.com"
          value={formData.email}
          onChange={handleChange}
          required
          className="border-slate-200 focus:border-slate-900"
        />
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Label htmlFor="message" className="text-slate-900 font-medium">
          Message
        </Label>
        <textarea
          id="message"
          name="message"
          placeholder="Tell me about your project..."
          value={formData.message}
          onChange={handleChange}
          required
          rows={5}
          className="w-full px-3 py-2 border border-slate-200 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
        />
      </div>

      {/* Success Message */}
      {submitted && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          Thank you! Your message has been sent. I'll get back to you soon.
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium"
      >
        {isLoading ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  )
}
