'use client'

import { Button } from '@/components/ui/button'
import { FilterType } from '@/types'

interface TaskFilterProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

export function TaskFilter({ activeFilter, onFilterChange }: TaskFilterProps) {
  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Overdue', value: 'overdue' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <Button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          variant={activeFilter === filter.value ? 'default' : 'outline'}
          size="sm"
          className={
            activeFilter === filter.value
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }
        >
          {filter.label}
        </Button>
      ))}
    </div>
  )
}
