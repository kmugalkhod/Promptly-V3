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

3. Keep it simple:
   - 1-3 tables max for MVP
   - Avoid over-engineering relationships
   - Only add what's needed now

4. PACKAGES required:
   - Add `@supabase/supabase-js` to PACKAGES section (omit `@supabase/ssr` unless auth is needed)

5. schema.sql is MANDATORY:
   - The coder agent MUST create `schema.sql` from this DATABASE specification
   - Without schema.sql, the auto-execution pipeline has nothing to execute

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
