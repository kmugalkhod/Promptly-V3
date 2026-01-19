import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'portfolio-website',
  description: 'Personal portfolio showcasing projects, skills, and contact information with smooth scrolling and responsive design.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
