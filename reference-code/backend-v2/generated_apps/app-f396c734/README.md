# Task Manager

A minimal task management application with a clean, crisp interface for organizing and tracking tasks.

## Features

- **Task Dashboard**: View all tasks with status badges, priorities, and due dates
- **Task Management**: Create, edit, and delete tasks with full control
- **Search**: Quickly find tasks by title or description
- **Filter**: View tasks by status (All, Active, Completed, Overdue)
- **Task Details**: View detailed information for each task
- **Smart Dates**: Automatic detection of overdue tasks with visual indicators
- **Priority Levels**: Organize tasks by low, medium, or high priority
- **Clean UI**: Minimal design with ample whitespace and crisp typography

## Pages

- **`/`** - Task dashboard with list, search, and filtering
- **`/task/[id]`** - Individual task detail view with edit and delete options

## Components

- **TaskList**: Displays all tasks with status badges
- **TaskCard**: Individual task preview with priority, due date, and completion status
- **TaskForm**: Create/edit task modal with validation
- **TaskFilter**: Filter tasks by status (all, active, completed, overdue)
- **TaskSearch**: Search tasks by title or description
- **EmptyState**: Empty task list placeholder with CTA
- **TaskHeader**: App header with title and create button
- **Checkbox**: Toggle task completion status

## Tech Stack

- **Framework**: Next.js 16
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Language**: TypeScript
- **Icons**: Lucide React

## Getting Started

The application includes sample tasks to demonstrate functionality. You can:

1. **Create** new tasks using the "New Task" button
2. **Search** tasks by title or description
3. **Filter** tasks by status
4. **Toggle** completion status with checkboxes
5. **Edit** task details from the detail page
6. **Delete** tasks from the detail page

## Design Philosophy

Built with a minimal design approach emphasizing:
- Clean whites and subtle borders
- Ample whitespace for clarity
- Crisp typography and consistent spacing
- Focus on core functionality without clutter
- Semantic color usage (green for completed, red for overdue, amber for medium priority)
