import { Task, FilterType } from '@/types'

// Check if task is overdue
export function isOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

// Format date for display
export function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const dateOnly = new Date(date)
  dateOnly.setHours(0, 0, 0, 0)
  
  if (dateOnly.getTime() === today.getTime()) return 'Today'
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow'
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: dateOnly.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

// Filter tasks based on filter type
export function filterTasks(tasks: Task[], filterType: FilterType): Task[] {
  switch (filterType) {
    case 'active':
      return tasks.filter(task => !task.completed)
    case 'completed':
      return tasks.filter(task => task.completed)
    case 'overdue':
      return tasks.filter(task => isOverdue(task.dueDate, task.completed))
    case 'all':
    default:
      return tasks
  }
}

// Get priority color
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

// Get priority label
export function getPriorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

// Search tasks
export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks
  const lowerQuery = query.toLowerCase()
  return tasks.filter(task =>
    task.title.toLowerCase().includes(lowerQuery) ||
    task.description.toLowerCase().includes(lowerQuery)
  )
}

// Generate mock tasks
export function generateMockTasks(): Task[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 3)

  return [
    {
      id: '1',
      title: 'Review project proposal',
      description: 'Review and provide feedback on the Q1 project proposal document',
      priority: 'high',
      dueDate: today.toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      title: 'Update documentation',
      description: 'Update the API documentation with new endpoints and examples',
      priority: 'medium',
      dueDate: tomorrow.toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      title: 'Complete weekly report',
      description: 'Compile and submit the weekly status report to the team',
      priority: 'high',
      dueDate: lastWeek.toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      title: 'Prepare presentation slides',
      description: 'Create slides for the upcoming team meeting',
      priority: 'medium',
      dueDate: nextWeek.toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      title: 'Code review for feature branch',
      description: 'Review the authentication feature branch and provide feedback',
      priority: 'high',
      dueDate: tomorrow.toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6',
      title: 'Deploy to staging',
      description: 'Deploy latest changes to the staging environment and run tests',
      priority: 'medium',
      dueDate: nextWeek.toISOString().split('T')[0],
      completed: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '7',
      title: 'Fix critical bug',
      description: 'Resolve the memory leak issue in the user service',
      priority: 'high',
      dueDate: today.toISOString().split('T')[0],
      completed: true,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '8',
      title: 'Schedule client meeting',
      description: 'Coordinate with team and client to schedule Q2 planning meeting',
      priority: 'low',
      dueDate: null,
      completed: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]
}
