---
name: rls-policies
description: Create Supabase schema.sql with Row Level Security policies. Use when setting up database security with IF NOT EXISTS patterns. Load "rls-policies-advanced" for multi-table SECURITY DEFINER, draft/publish, and full examples.
category: supabase
agents: [coder, chat, schema]
---

## When to Use
- Creating schema.sql for Supabase
- Setting up Row Level Security (RLS)
- Defining table policies
- Architecture.md has DATABASE section

### Choose the Right RLS Pattern

| Schema Type | Example | Pattern to Use |
|-------------|---------|----------------|
| Single table, no auth | Todo list | Pattern 1 (public) or 5 (public CRUD) |
| Single table, with auth | Personal notes | Pattern 4 or 7 (user-owned rows) |
| Content with drafts | Blog | Pattern 6 (draft/publish) — load "rls-policies-advanced" |
| Multi-table with teams/orgs | Project management, SaaS | **Pattern 8 (SECURITY DEFINER) — MANDATORY** — load "rls-policies-advanced" |

**If your schema has 3+ tables with foreign key chains** (e.g., workspaces → projects → issues), you **MUST** use Pattern 8 with a `SECURITY DEFINER` helper function. Direct cross-table subqueries in policies WILL cause `relation does not exist` errors or infinite recursion.

> **⚠️ CRITICAL WARNING — Auth Detection:**
> If the DATABASE specification has NO `user_id` columns referencing `auth.users`, NO `profiles` table, and NO `auth.users` foreign keys, this is a **non-auth app**. You MUST use **Pattern 5 (Public CRUD)** for ALL tables. NEVER use `auth.uid()` in policies for non-auth apps — the client connects with the anon key, `auth.uid()` returns NULL, and ALL INSERT/UPDATE/DELETE operations will silently fail with "new row violates row-level security policy". This is the #1 cause of RLS-blocked writes in generated apps.

### Supabase Official Policy Guidelines

**PERMISSIVE vs RESTRICTIVE:**
- Always use PERMISSIVE policies (the default). Multiple PERMISSIVE policies combine with OR.
- Avoid RESTRICTIVE policies unless you have a specific requirement.

**Syntax Ordering (MANDATORY):**
```sql
-- CORRECT: FOR before TO
create policy "Policy name" on table_name
  for select
  to authenticated
  using ( ... );
```

**Operation-Specific Clauses:**
| Operation | USING | WITH CHECK | Notes |
|-----------|-------|------------|-------|
| SELECT | Required | Never | Filter which rows are visible |
| INSERT | Never | Required | Validate new row data |
| UPDATE | Required (filter rows) | Required (validate new data) | Both needed |
| DELETE | Required | Never | Filter which rows can be deleted |

**Minimize Joins in Policies:**
Use `column IN (SELECT ...)` pattern instead of joining source table.

**Index Columns Used in Policies:**
Add indexes on any columns referenced in RLS policy USING/WITH CHECK clauses.

## Instructions

### CRITICAL — schema.sql is a MANDATORY File

⚠️ **schema.sql is NOT optional documentation — it is a MANDATORY file that MUST be created in the project root.**

### Schema.sql Section Ordering (MANDATORY)

1. ALL `CREATE TABLE IF NOT EXISTS` — parent tables BEFORE child tables
2. `SECURITY DEFINER` helper functions (if 3+ tables with FK chains)
3. ALL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. ALL policies via `DO $$ IF NOT EXISTS` pattern (NEVER bare `CREATE POLICY`)
5. ALL `CREATE INDEX IF NOT EXISTS`
6. `NOTIFY pgrst, 'reload schema';` — ALWAYS last line

### schema.sql Template

```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  text text NOT NULL,
  completed boolean DEFAULT false
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public access'
  ) THEN
    CREATE POLICY "Allow public access" ON todos
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
```

### Common Table Patterns

**Basic table with timestamps:**

```sql
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title text NOT NULL,
  content text,
  published boolean DEFAULT false
);
```

**Table with user reference (for auth):**

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text
);
```

**Table with foreign key:**

```sql
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL
);
```

### RLS Policy Patterns

**1. Public access (anyone can read/write):**

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public access'
  ) THEN
    CREATE POLICY "Allow public access" ON todos
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
```

**4. User owns their rows:**

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can manage own todos'
  ) THEN
    CREATE POLICY "Users can manage own todos" ON todos
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;
```

**5. Public CRUD (no auth required) — DEFAULT for non-auth apps:**

For apps without authentication. Explicit per-operation policies with `TO anon, authenticated`:

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Allow public select'
  ) THEN
    CREATE POLICY "Allow public select" ON todos FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Allow public insert'
  ) THEN
    CREATE POLICY "Allow public insert" ON todos FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Allow public update'
  ) THEN
    CREATE POLICY "Allow public update" ON todos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Allow public delete'
  ) THEN
    CREATE POLICY "Allow public delete" ON todos FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;
```

### Validation Checklist

After writing schema.sql, verify:

- [ ] Every table from architecture.md DATABASE section has a CREATE TABLE statement
- [ ] Every column from DATABASE section is present with matching name and type
- [ ] RLS is enabled on every table
- [ ] At least one policy exists per table
- [ ] All IF NOT EXISTS and DO $$ patterns are used correctly
- [ ] Every table has a DELETE policy (not just SELECT+INSERT+UPDATE)
- [ ] `auth.uid()` is wrapped in `(select ...)` for performance
- [ ] No circular cross-table references in policies (use SECURITY DEFINER helpers)
- [ ] If no auth.users references in DATABASE spec, ALL policies use USING(true)/WITH CHECK(true) (Pattern 5) — no auth.uid() anywhere
- [ ] If auth is used, policies with auth.uid() checks are only on tables that have user_id FK columns

### RULES

1. **Always use IF NOT EXISTS** for tables and indexes
2. **Always use DO $$ block** for policies (prevents duplicate errors)
3. **Always enable RLS** with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. **Match columns to DATABASE section** in architecture.md
5. **Use `(select auth.uid())`** — always wrap in `(select ...)` for performance
6. **Policy names must be unique** per table
7. **schema.sql MUST be created as a real file in the project root**
8. **Always include a DELETE policy** for every table
9. **For multi-table schemas with foreign keys**: ALWAYS create a `SECURITY DEFINER` helper — load "rls-policies-advanced" for Pattern 8
10. **schema.sql section order**: ALL CREATE TABLE → helper functions → ALL ENABLE RLS → ALL policies → ALL indexes
11. **NEVER use bare `CREATE POLICY`** — always use `DO $$ BEGIN IF NOT EXISTS ... END $$;`
12. **ALWAYS end with `NOTIFY pgrst, 'reload schema';`**
13. **Write SQL in lowercase** — Supabase convention
14. **Prefer PERMISSIVE policies** — avoid RESTRICTIVE
15. **Always specify roles with TO** — `to authenticated` or `to anon`
16. **Add indexes for every column used in RLS policies**
17. **Minimize joins in policies** — use `column IN (SELECT ...)` pattern
