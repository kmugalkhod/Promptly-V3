'use client'

import { useState } from 'react'
import { TaskHeader } from '@/components/TaskHeader'
import { TaskForm } from '@/components/TaskForm'
import { TaskSearch } from '@/components/TaskSearch'
import { TaskFilter } from '@/components/TaskFilter'
import { TaskList } from '@/components/TaskList'
import { EmptyState } from '@/components/EmptyState'
import { Task, FilterType } from '@/types'
import {
  generateMockTasks,
  searchTasks,
  filterTasks,
} from '@/lib/helpers'

export default function Page() {
  // Suppress hydration mismatch warning - mock data generates on client
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === 'undefined') return []
    return generateMockTasks()
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()

  // Filter and search tasks
  const filteredTasks = filterTasks(
    searchTasks(tasks, searchQuery),
    filterType
  )

  // Handle create/update task
  const handleTaskSubmit = (taskData: Partial<Task>) => {
    if (editingTask) {
      // Update existing task
      setTasks(prev =>
        prev.map(task =>
          task.id === editingTask.id
            ? {
                ...task,
                title: taskData.title || task.title,
                description: taskData.description || task.description,
                priority: taskData.priority || task.priority,
                dueDate: taskData.dueDate !== undefined ? taskData.dueDate : task.dueDate,
              }
            : task
        )
      )
      setEditingTask(undefined)
    } else {
      // Create new task
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskData.title || '',
        description: taskData.description || '',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || null,
        completed: false,
        createdAt: new Date().toISOString(),
      }
      setTasks(prev => [newTask, ...prev])
    }
  }

  // Handle toggle task completion
  const handleToggleComplete = (id: string, completed: boolean) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, completed } : task
      )
    )
  }

  // Handle edit task
  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  // Handle delete task
  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id))
  }

  // Handle form close
  const handleFormClose = (open: boolean) => {
    if (!open) {
      setEditingTask(undefined)
    }
    setFormOpen(open)
  }

  const hasAnyTasks = tasks.length > 0
  const hasFilteredTasks = filteredTasks.length > 0

  return (
    <div className="min-h-screen bg-white">
      <TaskHeader onCreateClick={() => setFormOpen(true)} />

      <main className="container mx-auto px-6 py-8">
        {!hasAnyTasks ? (
          <EmptyState onCreateClick={() => setFormOpen(true)} />
        ) : (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="space-y-4">
              <TaskSearch value={searchQuery} onChange={setSearchQuery} />
              <TaskFilter
                activeFilter={filterType}
                onFilterChange={setFilterType}
              />
            </div>

            {/* Task List */}
            {hasFilteredTasks ? (
              <TaskList
                tasks={filteredTasks}
                onToggleComplete={handleToggleComplete}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">No tasks match your criteria.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Form Dialog */}
      <TaskForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={handleTaskSubmit}
        initialTask={editingTask}
      />
    </div>
  )
}
