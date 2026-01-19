'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TaskForm } from '@/components/TaskForm'
import { Checkbox } from '@/components/Checkbox'
import { Task } from '@/types'
import {
  generateMockTasks,
  formatDate,
  getPriorityColor,
  getPriorityLabel,
  isOverdue,
} from '@/lib/helpers'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  // Initialize with all tasks and find the one we need
  // Check for client-side only to prevent hydration mismatch
  const [allTasks, setAllTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return []
    return generateMockTasks()
  })
  const [editOpen, setEditOpen] = useState(false)

  const task = allTasks.find(t => t.id === id)

  if (!task) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-slate-200 bg-white">
          <div className="container mx-auto px-6 py-6">
            <Link href="/">
              <Button variant="ghost" className="text-slate-600 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tasks
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">Task not found</h1>
            <p className="text-slate-600">
              The task you're looking for doesn't exist.
            </p>
            <Link href="/">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                Return to Tasks
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const overdue = isOverdue(task.dueDate, task.completed)

  const handleToggleComplete = () => {
    setAllTasks(prev =>
      prev.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    )
  }

  const handleDelete = () => {
    setAllTasks(prev => prev.filter(t => t.id !== id))
    router.push('/')
  }

  const handleUpdate = (taskData: Partial<Task>) => {
    setAllTasks(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              title: taskData.title || t.title,
              description: taskData.description || t.description,
              priority: taskData.priority || t.priority,
              dueDate: taskData.dueDate !== undefined ? taskData.dueDate : t.dueDate,
            }
          : t
      )
    )
    setEditOpen(false)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-6">
          <Link href="/">
            <Button
              variant="ghost"
              className="text-slate-600 hover:bg-slate-50 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tasks
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl space-y-6">
          {/* Task Title and Completion */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Checkbox
                checked={task.completed}
                onCheckedChange={handleToggleComplete}
              />
              <div className="flex-1">
                <h1
                  className={`text-3xl font-bold ${
                    task.completed
                      ? 'text-slate-400 line-through'
                      : 'text-slate-900'
                  }`}
                >
                  {task.title}
                </h1>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="ml-12 space-y-2">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}
          </div>

          {/* Task Details Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Priority
                </p>
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className={`text-sm font-medium border ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    {getPriorityLabel(task.priority)}
                  </Badge>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Due Date
                </p>
                {task.dueDate ? (
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className={`text-sm font-medium border ${
                        overdue
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {overdue ? '⚠ ' : ''}
                      {formatDate(task.dueDate)}
                    </Badge>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No due date</p>
                )}
              </div>

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Status
                </p>
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className={
                      task.completed
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }
                  >
                    {task.completed ? '✓ Completed' : '○ Active'}
                  </Badge>
                </div>
              </div>

              {/* Created Date */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Created
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {new Date(task.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setEditOpen(true)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
            >
              Edit Task
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>

      {/* Edit Form Dialog */}
      <TaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleUpdate}
        initialTask={task}
      />
    </div>
  )
}
