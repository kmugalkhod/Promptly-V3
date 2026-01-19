'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/Checkbox'
import { Task } from '@/types'
import { formatDate, getPriorityColor, getPriorityLabel, isOverdue } from '@/lib/helpers'
import { Edit2, Trash2 } from 'lucide-react'

interface TaskCardProps {
  task: Task
  onToggleComplete: (id: string, completed: boolean) => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (id: string) => void
}

export function TaskCard({ 
  task, 
  onToggleComplete,
  onEditTask,
  onDeleteTask,
}: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.completed)

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEditTask?.(task)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDeleteTask?.(task.id)
    }
  }

  return (
    <Link href={`/task/${task.id}`}>
      <div className="p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer space-y-3 group">
        <div className="flex items-start gap-3">
          <div
            className="mt-1"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Checkbox
              checked={task.completed}
              onCheckedChange={checked => {
                onToggleComplete(task.id, checked as boolean)
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`font-medium text-sm leading-tight break-words ${
                task.completed
                  ? 'text-slate-400 line-through'
                  : 'text-slate-900'
              }`}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <div 
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.preventDefault()}
          >
            {onEditTask && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEditClick}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                title="Edit task"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {onDeleteTask && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteClick}
                className="h-8 w-8 p-0 text-slate-500 hover:text-red-700 hover:bg-red-50"
                title="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-xs font-medium border ${getPriorityColor(
              task.priority
            )}`}
          >
            {getPriorityLabel(task.priority)}
          </Badge>

          {task.dueDate && (
            <Badge
              variant="outline"
              className={`text-xs font-medium border ${
                overdue
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {overdue ? '⚠ ' : ''}
              {formatDate(task.dueDate)}
            </Badge>
          )}

          {task.completed && (
            <Badge
              variant="outline"
              className="text-xs font-medium bg-green-50 text-green-700 border-green-200"
            >
              ✓ Done
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}
