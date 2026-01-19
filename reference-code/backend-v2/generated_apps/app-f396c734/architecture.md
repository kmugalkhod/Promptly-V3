APP_NAME: task-manager
DESCRIPTION: Minimal task management app with clean, crisp interface for organizing and tracking tasks.

DESIGN_STYLE: minimal
- Clean whites, subtle borders, ample whitespace
- Crisp typography and spacing
- Light UI with focus on clarity

PACKAGES: None
- Default stack sufficient (Next.js, Tailwind, shadcn/ui, TypeScript)

ROUTES:
- / (task dashboard - list and manage all tasks)
- /task/[id] (individual task detail view)

COMPONENTS:
- TaskList: Display all tasks with status badges
- TaskCard: Individual task preview with priority, due date, completion status
- TaskForm: Create/edit task modal with title, description, priority, due date
- TaskFilter: Filter tasks by status (all, active, completed, overdue)
- TaskSearch: Search tasks by title/description
- EmptyState: Empty task list placeholder with CTA to create first task
- TaskHeader: App header with title and create button
- Checkbox: Toggle task completion status
