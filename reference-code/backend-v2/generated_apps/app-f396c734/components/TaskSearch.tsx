'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface TaskSearchProps {
  value: string
  onChange: (value: string) => void
}

export function TaskSearch({ value, onChange }: TaskSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <Input
        placeholder="Search tasks..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500"
      />
    </div>
  )
}
