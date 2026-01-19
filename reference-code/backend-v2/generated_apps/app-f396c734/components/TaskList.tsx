'use client'

import { TaskCard } from '@/components/TaskCard'
import { Task } from '@/types'

interface TaskListProps {
  tasks: Task[]
  onToggleComplete: (id: string, completed: boolean) => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (id: string) => void
}

export function TaskList({ 
  tasks, 
  onToggleComplete,
  onEditTask,
  onDeleteTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">No tasks match your criteria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onToggleComplete={onToggleComplete}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </div>
  )
}
