---
name: data-modeling
description: Design database schema, tables, columns, and types for apps needing data persistence. Use when the app requires saving or retrieving data.
category: architecture
agents: [architecture]
---

## When to Use
- App needs to save user data
- App needs to persist state across sessions
- User explicitly requests database/storage/persistence
- Features like: user accounts, saving items, tracking progress

## Instructions

### DATABASE SECTION FORMAT

Add to architecture.md only if app needs persistence:

```
DATABASE:
  tables:
    - table_name:
      - id: uuid (pk, default gen_random_uuid())
      - created_at: timestamptz (default now())
      - column_name: type (constraint)
  env_vars:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**IMPORTANT**: When this DATABASE section exists, the coder agent MUST produce a `schema.sql` file from this specification. The column names defined here will become both SQL column names and TypeScript interface field names.

### COLUMN TYPES (Supabase/PostgreSQL)
| Type | Use For |
|------|---------|
| uuid | Primary keys, foreign keys |
| text | Strings of any length |
| boolean | true/false flags |
| integer | Whole numbers |
| timestamptz | Dates and times |
| jsonb | Flexible nested data |

### DATABASE RULES
1. Every table MUST have:
   - `id: uuid (pk, default gen_random_uuid())`
   - `created_at: timestamptz (default now())`

2. Naming conventions:
   - Tables: snake_case plural (e.g., `users`, `todo_items`)
   - Columns: snake_case (e.g., `user_id`, `is_completed`)

3. Scale appropriately:
   - Simple apps (todo, blog): 1-3 tables
   - Medium apps (dashboard, CMS): 3-6 tables
   - Complex apps (project management, SaaS): 6-12 tables with relationships
   - ALWAYS define foreign key relationships explicitly (see below)

4. PACKAGES required:
   - ALWAYS add both `@supabase/supabase-js` AND `@supabase/ssr` to PACKAGES section
   - If auth is needed: also add a note that middleware.ts is required

5. schema.sql is MANDATORY:
   - The coder agent MUST create `schema.sql` from this DATABASE specification
   - Without schema.sql, the auto-execution pipeline has nothing to execute

6. If auth is needed: ALWAYS include a `profiles` table with `id: uuid (pk, fk -> auth.users.id)`, `display_name: text`, `avatar_url: text`, `email: text`. Use `profiles.id` (not `auth.users.id`) for all foreign key references that need to be queried via PostgREST.

7. SECURITY DEFINER requirement:
   - If schema has **3+ tables with foreign key relationships**, the coder/schema agent MUST create a `SECURITY DEFINER` helper function in schema.sql
   - Note this in a comment: `-- NOTE: 3+ tables with FKs = SECURITY DEFINER helper required`
   - This prevents infinite recursion in RLS policies when policies query across tables

8. Table ordering (FK dependency):
   - List tables in parent-before-child order in the DATABASE section
   - Root tables (no FK dependencies) first
   - Child tables that reference parent tables after their parents
   - Example: `workspaces` → `workspace_members` → `projects` → `issues` → `comments`
   - This ordering is critical for schema.sql generation — CREATE TABLE must follow this order

### Relationships (Foreign Keys)

When tables reference each other, specify foreign keys explicitly:

```
DATABASE:
  tables:
    - workspaces:
      - id: uuid (pk, default gen_random_uuid())
      - created_at: timestamptz (default now())
      - name: text (not null)
      - owner_id: uuid (fk -> auth.users.id, not null)

    - projects:
      - id: uuid (pk, default gen_random_uuid())
      - created_at: timestamptz (default now())
      - workspace_id: uuid (fk -> workspaces.id, on delete cascade, not null)
      - name: text (not null)
      - status: text (default 'active')

    - issues:
      - id: uuid (pk, default gen_random_uuid())
      - created_at: timestamptz (default now())
      - project_id: uuid (fk -> projects.id, on delete cascade, not null)
      - assignee_id: uuid (fk -> profiles.id, nullable)
      - title: text (not null)
      - priority: text (default 'medium')
```

**FK syntax**: `column_name: uuid (fk -> table.column, on delete cascade|set null, not null|nullable)`

**Rules for FKs**:
- User references: ALWAYS use `fk -> profiles.id` (NOT `auth.users.id`) for columns that need to be queryable via PostgREST
- Owner/creator references: Use `fk -> auth.users.id` only for the ownership column that RLS policies check against `auth.uid()`
- Cascade: Use `on delete cascade` for child tables (deleting parent deletes children)
- Set null: Use `on delete set null` for optional references (e.g., assignee_id when user is deleted)

### Status/Enum Columns

For columns with a fixed set of values, use `text` with a comment listing valid values:

```
- status: text (default 'active') -- values: active, archived, deleted
- priority: text (default 'medium') -- values: low, medium, high, urgent
- role: text (default 'member') -- values: owner, admin, member, viewer
```

The coder agent will enforce these values in the TypeScript type definition:
```typescript
type Priority = 'low' | 'medium' | 'high' | 'urgent'
```

### Column Naming Guidance

Column names in the DATABASE section become:
1. SQL column names in `schema.sql` (e.g., `text text NOT NULL`)
2. TypeScript interface fields (e.g., `text: string`)
3. Supabase query parameters (e.g., `.insert({ text: '...' })`)

Choose names that work as both SQL columns AND TypeScript fields. Prefer: `title`, `content`, `description`, `name`, `status`, `completed`.

Avoid generic names like `data`, `value`, `item` that may conflict with JS keywords.

### WHEN NOT TO ADD DATABASE
- Simple calculators, converters
- Static content display
- Games that don't save progress
- Timers, clocks, stopwatches
- Single-session tools
