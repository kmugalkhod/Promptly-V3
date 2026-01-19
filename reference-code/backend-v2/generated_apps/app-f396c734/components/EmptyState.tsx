'use client'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onCreateClick: () => void
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-5xl mb-4">✓</div>
        <h3 className="text-lg font-semibold text-slate-900">No tasks yet</h3>
        <p className="text-sm text-slate-600">
          Your task list is empty. Create your first task to get started.
        </p>
        <Button
          onClick={onCreateClick}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white"
        >
          Create First Task
        </Button>
      </div>
    </div>
  )
}
