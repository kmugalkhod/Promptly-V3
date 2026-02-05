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
   - Add `@supabase/supabase-js` and `@supabase/ssr` to PACKAGES section

### WHEN NOT TO ADD DATABASE
- Simple calculators, converters
- Static content display
- Games that don't save progress
- Timers, clocks, stopwatches
- Single-session tools
