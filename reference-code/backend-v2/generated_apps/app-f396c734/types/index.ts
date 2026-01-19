export type TaskStatus = 'active' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'
export type FilterType = 'all' | 'active' | 'completed' | 'overdue'

export interface Task {
  id: string
  title: string
  description: string
  priority: TaskPriority
  dueDate: string | null
  completed: boolean
  createdAt: string
}
