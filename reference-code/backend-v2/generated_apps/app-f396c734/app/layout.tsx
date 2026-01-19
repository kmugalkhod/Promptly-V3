import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'task-manager',
  description: 'Minimal task management app with clean, crisp interface for organizing and tracking tasks.',
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
