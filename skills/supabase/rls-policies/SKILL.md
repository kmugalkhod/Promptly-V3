---
name: rls-policies
description: Create Supabase schema.sql with Row Level Security policies. Use when setting up database security with IF NOT EXISTS patterns.
category: supabase
agents: [coder, chat]
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
| Content with drafts | Blog | Pattern 6 (draft/publish) |
| Multi-table with teams/orgs | Project management, SaaS | **Pattern 8 (SECURITY DEFINER) — MANDATORY** |

**If your schema has 3+ tables with foreign key chains** (e.g., workspaces → projects → issues), you **MUST** use Pattern 8 with a `SECURITY DEFINER` helper function. Direct cross-table subqueries in policies WILL cause `relation does not exist` errors or infinite recursion.

> **⚠️ CRITICAL WARNING — Auth Detection:**
> If the DATABASE specification has NO `user_id` columns referencing `auth.users`, NO `profiles` table, and NO `auth.users` foreign keys, this is a **non-auth app**. You MUST use **Pattern 5 (Public CRUD)** for ALL tables. NEVER use `auth.uid()` in policies for non-auth apps — the client connects with the anon key, `auth.uid()` returns NULL, and ALL INSERT/UPDATE/DELETE operations will silently fail with "new row violates row-level security policy". This is the #1 cause of RLS-blocked writes in generated apps.

### Supabase Official Policy Guidelines

These patterns come from Supabase's official AI prompt for RLS policy generation:

**PERMISSIVE vs RESTRICTIVE:**
- Always use PERMISSIVE policies (the default). Multiple PERMISSIVE policies on a table combine with OR — a row is accessible if ANY policy allows it.
- Avoid RESTRICTIVE policies unless you have a specific security requirement. RESTRICTIVE policies combine with AND — ALL must pass, which causes unexpected access denials.

**Syntax Ordering (MANDATORY):**
```sql
-- CORRECT: FOR before TO
create policy "Policy name" on table_name
  for select
  to authenticated
  using ( ... );

-- INCORRECT: TO before FOR
create policy "Policy name" on table_name
  to authenticated
  for select
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
Instead of joining the source table to the target table in a policy, fetch relevant IDs into a set and use IN:

```sql
-- BAD: join in policy (slow)
create policy "Team access" on projects
  for select to authenticated
  using (
    (select auth.uid()) in (
      select user_id from team_members
      where team_members.team_id = projects.team_id
    )
  );

-- GOOD: fetch IDs, then use IN (fast)
create policy "Team access" on projects
  for select to authenticated
  using (
    team_id in (
      select team_id from team_members
      where user_id = (select auth.uid())
    )
  );
```

**Index Columns Used in Policies:**
Add indexes on any columns referenced in RLS policy USING/WITH CHECK clauses:

```sql
-- After all policies, add indexes for RLS performance
create index if not exists idx_projects_team_id on projects(team_id);
create index if not exists idx_team_members_user_id on team_members(user_id);
create index if not exists idx_issues_project_id on issues(project_id);
```

## Instructions

### CRITICAL — schema.sql is a MANDATORY File

⚠️ **schema.sql is NOT optional documentation — it is a MANDATORY file that MUST be created in the project root.**

The auto-execution pipeline reads `schema.sql` from the project root and executes it against Supabase. Without this file, NO tables will be created and ALL database operations will fail.

- EVERY table listed in architecture.md DATABASE section MUST have a corresponding `CREATE TABLE IF NOT EXISTS` statement in schema.sql.
- Create this file BEFORE any component files.

### Schema.sql Section Ordering (MANDATORY)

Every schema.sql file MUST follow this exact section order:

1. **ALL `CREATE TABLE IF NOT EXISTS` statements** — parent tables BEFORE child tables (e.g., `workspaces` before `workspace_members` before `projects` before `issues`)
2. **`SECURITY DEFINER` helper functions** — if the schema has multi-table foreign key chains. Create AFTER all tables exist.
3. **ALL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements**
4. **ALL policy statements** — using `DO $$ IF NOT EXISTS` pattern (NEVER bare `CREATE POLICY`)
5. **ALL `CREATE INDEX IF NOT EXISTS` statements**
6. **`NOTIFY pgrst, 'reload schema';`** — ALWAYS the last line of schema.sql

⚠️ **NEVER interleave** table creation with policies. ALL tables must exist before ANY policy is created. Policies that subquery other tables will fail with `relation "tablename" does not exist` if the referenced table hasn't been created yet.

⚠️ **NEVER use `DROP POLICY IF EXISTS` + bare `CREATE POLICY`** — always use the `DO $$ IF NOT EXISTS` pattern from the template below.

### schema.sql Template

ALWAYS create this as a real file named `schema.sql` in the project root. Use IF NOT EXISTS patterns for idempotency:

```sql
-- schema.sql
-- Run this in Supabase SQL Editor to set up your database

-- Create table with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  text text NOT NULL,
  completed boolean DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policy with DO $$ block (prevents errors if policy exists)
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

-- Reload PostgREST schema cache to detect new tables immediately
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

**2. Read-only public access:**

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Anyone can view published posts'
  ) THEN
    CREATE POLICY "Anyone can view published posts" ON posts
      FOR SELECT
      USING (published = true);
  END IF;
END $$;
```

**3. User-specific access (authenticated users own their data):**

> **Performance note:** Always wrap `auth.uid()` in `(select ...)` — e.g., `(select auth.uid())`. This lets Postgres cache the value per-statement instead of re-evaluating per-row, giving ~95% performance improvement on large tables.

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles' AND policyname = 'Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" ON user_profiles
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Users can only update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON user_profiles
      FOR UPDATE
      USING ((select auth.uid()) = id)
      WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;

-- Users can only insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON user_profiles
      FOR INSERT
      WITH CHECK ((select auth.uid()) = id);
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

For apps without authentication (todo lists, trackers, simple tools). This is the DEFAULT pattern when the DATABASE specification has no auth.users references. Uses explicit per-operation policies with `TO anon, authenticated`:

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Anyone can view todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public select'
  ) THEN
    CREATE POLICY "Allow public select" ON todos
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Anyone can create todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public insert'
  ) THEN
    CREATE POLICY "Allow public insert" ON todos
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Anyone can update todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public update'
  ) THEN
    CREATE POLICY "Allow public update" ON todos
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Anyone can delete todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Allow public delete'
  ) THEN
    CREATE POLICY "Allow public delete" ON todos
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
```

**6. Content with Draft/Publish:**

For content apps where the public sees published items, but authors can see their own drafts. The two SELECT policies combine with OR — a row is visible if EITHER policy matches.

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public can view published content
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Anyone can view published posts'
  ) THEN
    CREATE POLICY "Anyone can view published posts" ON posts
      FOR SELECT
      TO anon, authenticated
      USING (published = true);
  END IF;
END $$;

-- Authors can view their own posts (including drafts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can view own posts'
  ) THEN
    CREATE POLICY "Authors can view own posts" ON posts
      FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can create posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can create posts'
  ) THEN
    CREATE POLICY "Authors can create posts" ON posts
      FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can update their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can update own posts'
  ) THEN
    CREATE POLICY "Authors can update own posts" ON posts
      FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can delete their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can delete own posts'
  ) THEN
    CREATE POLICY "Authors can delete own posts" ON posts
      FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;
```

> **Key insight:** Multiple SELECT policies on the same table combine with OR semantics. A row is visible if ANY SELECT policy's `USING` clause evaluates to true. This is how draft/publish works — public sees `published = true` rows, while the author also sees their own unpublished rows via `(select auth.uid()) = user_id`.

**7. User-Owned Rows with Complete CRUD:**

For authenticated apps where users own their rows. Explicit per-operation policies with `TO authenticated` role:

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Users can view their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can view own todos'
  ) THEN
    CREATE POLICY "Users can view own todos" ON todos
      FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can create their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can create own todos'
  ) THEN
    CREATE POLICY "Users can create own todos" ON todos
      FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can update their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can update own todos'
  ) THEN
    CREATE POLICY "Users can update own todos" ON todos
      FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can delete their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can delete own todos'
  ) THEN
    CREATE POLICY "Users can delete own todos" ON todos
      FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;
```

**8. Team/Workspace Access (Multi-Table):**

Use this pattern for workspaces, teams, organizations, or any multi-tenant app where access depends on membership in a parent entity. The key challenge is avoiding **infinite recursion** — when policies on table A query table B, and table B's policies query table A, PostgreSQL enters an infinite loop.

**Step 1: Create a SECURITY DEFINER helper function**

This function bypasses RLS (runs as the function owner, not the calling user), breaking the circular dependency chain. All policies reference this function instead of querying membership tables directly.

```sql
-- SECURITY DEFINER helper: returns workspace IDs accessible to current user
-- Bypasses RLS to prevent circular dependency between workspaces ↔ members
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workspaces WHERE owner_id = (select auth.uid())
  UNION
  SELECT workspace_id FROM workspace_members WHERE user_id = (select auth.uid());
$$;
```

> **Why SECURITY DEFINER?** This function runs with the permissions of its owner (typically the superuser who created it), bypassing RLS on the tables it queries. `SET search_path = public` prevents search_path hijacking attacks — always include this with SECURITY DEFINER functions.

**Step 2: Parent table policies (workspaces)**

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Members can view workspaces they belong to (uses helper to avoid recursion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'Members can view workspaces'
  ) THEN
    CREATE POLICY "Members can view workspaces" ON workspaces
      FOR SELECT
      TO authenticated
      USING (id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

-- Only owners can update their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'Owners can update workspaces'
  ) THEN
    CREATE POLICY "Owners can update workspaces" ON workspaces
      FOR UPDATE
      TO authenticated
      USING (owner_id = (select auth.uid()))
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

-- Authenticated users can create workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'Users can create workspaces'
  ) THEN
    CREATE POLICY "Users can create workspaces" ON workspaces
      FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

-- Only owners can delete their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'Owners can delete workspaces'
  ) THEN
    CREATE POLICY "Owners can delete workspaces" ON workspaces
      FOR DELETE
      TO authenticated
      USING (owner_id = (select auth.uid()));
  END IF;
END $$;
```

**Step 3: Membership table policies (workspace_members)**

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members in their workspaces (uses helper)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspace_members' AND policyname = 'Members can view workspace members'
  ) THEN
    CREATE POLICY "Members can view workspace members" ON workspace_members
      FOR SELECT
      TO authenticated
      USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

-- Workspace owners can add members (uses helper)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspace_members' AND policyname = 'Owners can add members'
  ) THEN
    CREATE POLICY "Owners can add members" ON workspace_members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- Members can remove themselves; owners can remove anyone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspace_members' AND policyname = 'Members can leave or owners can remove'
  ) THEN
    CREATE POLICY "Members can leave or owners can remove" ON workspace_members
      FOR DELETE
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR workspace_id IN (
          SELECT id FROM workspaces WHERE owner_id = (select auth.uid())
        )
      );
  END IF;
END $$;
```

**Step 4: Child table policies (projects, issues, etc.)**

Child tables reference the helper function through their parent's workspace_id:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Members can view projects in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Members can view projects'
  ) THEN
    CREATE POLICY "Members can view projects" ON projects
      FOR SELECT
      TO authenticated
      USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

-- Members can create projects in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Members can create projects'
  ) THEN
    CREATE POLICY "Members can create projects" ON projects
      FOR INSERT
      TO authenticated
      WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

-- Members can update projects in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Members can update projects'
  ) THEN
    CREATE POLICY "Members can update projects" ON projects
      FOR UPDATE
      TO authenticated
      USING (workspace_id IN (SELECT get_user_workspace_ids()))
      WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

-- Members can delete projects in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'Members can delete projects'
  ) THEN
    CREATE POLICY "Members can delete projects" ON projects
      FOR DELETE
      TO authenticated
      USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;
```

**Step 5: Deep child tables (comments on issues)**

For tables further down the hierarchy, cascade through parent tables using JOINs — but still use the helper for the workspace check:

```sql
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Members can view comments on issues in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comments' AND policyname = 'Members can view comments'
  ) THEN
    CREATE POLICY "Members can view comments" ON comments
      FOR SELECT
      TO authenticated
      USING (
        issue_id IN (
          SELECT i.id FROM issues i
          JOIN projects p ON p.id = i.project_id
          WHERE p.workspace_id IN (SELECT get_user_workspace_ids())
        )
      );
  END IF;
END $$;

-- Members can create comments on issues in their workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comments' AND policyname = 'Members can create comments'
  ) THEN
    CREATE POLICY "Members can create comments" ON comments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (select auth.uid()) = user_id
        AND issue_id IN (
          SELECT i.id FROM issues i
          JOIN projects p ON p.id = i.project_id
          WHERE p.workspace_id IN (SELECT get_user_workspace_ids())
        )
      );
  END IF;
END $$;

-- Users can update their own comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comments' AND policyname = 'Users can update own comments'
  ) THEN
    CREATE POLICY "Users can update own comments" ON comments
      FOR UPDATE
      TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

-- Users can delete their own comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comments' AND policyname = 'Users can delete own comments'
  ) THEN
    CREATE POLICY "Users can delete own comments" ON comments
      FOR DELETE
      TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;
END $$;
```

> **Adapt table/column names** to match your architecture.md. The pattern is: always use the `get_user_workspace_ids()` helper for workspace membership checks, never inline cross-table subqueries that would trigger RLS on other tables.

### Full Example: Todo App with Auth

```sql
-- schema.sql for authenticated todo app

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  completed boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Users can only see their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can view own todos'
  ) THEN
    CREATE POLICY "Users can view own todos" ON todos
      FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can create their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can create own todos'
  ) THEN
    CREATE POLICY "Users can create own todos" ON todos
      FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can update their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can update own todos'
  ) THEN
    CREATE POLICY "Users can update own todos" ON todos
      FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Users can delete their own todos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'todos' AND policyname = 'Users can delete own todos'
  ) THEN
    CREATE POLICY "Users can delete own todos" ON todos
      FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;
```

### Index Creation (Optional)

```sql
-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos(created_at DESC);
```

### Full Example: Blog App with Draft/Publish

```sql
-- schema.sql for blog app with draft/publish workflow

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  content text,
  excerpt text,
  published boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public can view published posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Anyone can view published posts'
  ) THEN
    CREATE POLICY "Anyone can view published posts" ON posts
      FOR SELECT
      TO anon, authenticated
      USING (published = true);
  END IF;
END $$;

-- Authors can view their own posts (including drafts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can view own posts'
  ) THEN
    CREATE POLICY "Authors can view own posts" ON posts
      FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can create posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can create posts'
  ) THEN
    CREATE POLICY "Authors can create posts" ON posts
      FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can update their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can update own posts'
  ) THEN
    CREATE POLICY "Authors can update own posts" ON posts
      FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Authors can delete their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Authors can delete own posts'
  ) THEN
    CREATE POLICY "Authors can delete own posts" ON posts
      FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
CREATE INDEX IF NOT EXISTS posts_published_created_at_idx ON posts(published, created_at DESC);
```

### Validation Checklist

After writing schema.sql, verify:

- [ ] Every table from architecture.md DATABASE section has a CREATE TABLE statement
- [ ] Every column from DATABASE section is present with matching name and type
- [ ] RLS is enabled on every table
- [ ] At least one policy exists per table
- [ ] All IF NOT EXISTS and DO $$ patterns are used correctly
- [ ] Every table with a `published` column has a draft-visibility SELECT policy for the author
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
5. **Use `(select auth.uid())`** for user-specific policies — always wrap in `(select ...)` for performance
6. **Policy names must be unique** per table
7. **schema.sql MUST be created as a real file in the project root** — it is NOT optional
8. **Every table in architecture.md DATABASE section MUST have a CREATE TABLE in schema.sql**
9. **Always include a DELETE policy** for every table — apps with delete buttons will fail silently without one
10. **For tables with a `published` column**, always add an author-can-see-drafts SELECT policy alongside the public-read policy
11. **Use `(select auth.uid())`** instead of bare `auth.uid()` for better query performance on large tables
12. **Use `TO authenticated` or `TO anon`** to specify which roles a policy applies to
13. **For multi-table schemas with foreign keys**: ALWAYS create a `SECURITY DEFINER` helper function (Pattern 8). NEVER write policies with direct cross-table subqueries (e.g., `SELECT id FROM workspaces` inside a projects policy). Direct subqueries cause `relation does not exist` errors or infinite recursion. This is MANDATORY for any schema with 3+ tables.
14. **schema.sql section order**: ALL CREATE TABLE first → helper functions → ALL ALTER TABLE ENABLE RLS → ALL policies (DO $$ IF NOT EXISTS) → ALL indexes. NEVER interleave table creation with policy creation.
15. **NEVER use bare `CREATE POLICY` or `DROP POLICY IF EXISTS`** — always use the `DO $$ BEGIN IF NOT EXISTS ... END $$;` pattern for idempotent, re-runnable schemas.
16. **ALWAYS end schema.sql with `NOTIFY pgrst, 'reload schema';`** — this forces PostgREST to detect new tables immediately. Without it, the API may return "table not found" for up to 2 minutes after table creation.
17. **Write SQL in lowercase** — Supabase convention. Use lowercase for all SQL keywords: `create table`, `select`, `insert`, etc. (Policy names in double quotes remain mixed case.)
18. **Prefer PERMISSIVE policies** (the default) — avoid RESTRICTIVE unless you have a specific requirement. RESTRICTIVE policies combine with AND and cause unexpected access denials.
19. **Always specify roles with TO** — use `to authenticated` or `to anon` on every policy. This prevents policies from running for roles that don't need them (e.g., `anon` users don't need authenticated-only policies).
20. **Add indexes for every column used in RLS policies** — `user_id`, `workspace_id`, `team_id`, `project_id`, and any other FK columns referenced in USING/WITH CHECK clauses. Without indexes, RLS causes full table scans.
21. **Minimize joins in policies** — use `column IN (SELECT ...)` pattern instead of joining the source table. This allows Postgres to optimize the subquery independently.
