'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface TaskHeaderProps {
  onCreateClick: () => void
}

export function TaskHeader({ onCreateClick }: TaskHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-600 mt-1">Organize and track your work</p>
        </div>
        <Button
          onClick={onCreateClick}
          className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>
    </header>
  )
}
