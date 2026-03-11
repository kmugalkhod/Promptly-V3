---
name: rls-policies-advanced
description: Advanced RLS patterns — multi-table SECURITY DEFINER (Pattern 8), draft/publish (Pattern 6), user-owned CRUD (Pattern 7), profiles (Pattern 3), and full worked examples. Load after "rls-policies" core skill.
category: supabase
agents: [coder, chat, schema]
---

## When to Use
- Schema has 3+ tables with foreign keys (Pattern 8 — MANDATORY)
- Content with draft/publish workflow (Pattern 6)
- User profiles with auth (Pattern 3)
- Need full worked examples

## Advanced RLS Patterns

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

> **Performance note:** Always wrap `auth.uid()` in `(select ...)` — e.g., `(select auth.uid())`.

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

> **Key insight:** Multiple SELECT policies on the same table combine with OR semantics. A row is visible if ANY SELECT policy's `USING` clause evaluates to true.

**7. User-Owned Rows with Complete CRUD:**

For authenticated apps where users own their rows. Explicit per-operation policies with `TO authenticated` role:

```sql
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can view own todos'
  ) THEN
    CREATE POLICY "Users can view own todos" ON todos FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can create own todos'
  ) THEN
    CREATE POLICY "Users can create own todos" ON todos FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can update own todos'
  ) THEN
    CREATE POLICY "Users can update own todos" ON todos FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can delete own todos'
  ) THEN
    CREATE POLICY "Users can delete own todos" ON todos FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
END $$;
```

**8. Team/Workspace Access (Multi-Table) — MANDATORY for 3+ tables with FK chains:**

The key challenge is avoiding **infinite recursion** — when policies on table A query table B, and table B's policies query table A.

**Step 1: Create a SECURITY DEFINER helper function**

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

> **Why SECURITY DEFINER?** Runs with owner's permissions, bypassing RLS on queried tables. `SET search_path = public` prevents search_path hijacking.

**Step 2: Parent table policies (workspaces)**

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Members can view workspaces'
  ) THEN
    CREATE POLICY "Members can view workspaces" ON workspaces FOR SELECT TO authenticated USING (id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Owners can update workspaces'
  ) THEN
    CREATE POLICY "Owners can update workspaces" ON workspaces FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Users can create workspaces'
  ) THEN
    CREATE POLICY "Users can create workspaces" ON workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'Owners can delete workspaces'
  ) THEN
    CREATE POLICY "Owners can delete workspaces" ON workspaces FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));
  END IF;
END $$;
```

**Step 3: Membership table policies (workspace_members)**

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members can view workspace members'
  ) THEN
    CREATE POLICY "Members can view workspace members" ON workspace_members FOR SELECT TO authenticated USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Owners can add members'
  ) THEN
    CREATE POLICY "Owners can add members" ON workspace_members FOR INSERT TO authenticated
      WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = (select auth.uid())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Members can leave or owners can remove'
  ) THEN
    CREATE POLICY "Members can leave or owners can remove" ON workspace_members FOR DELETE TO authenticated
      USING (user_id = (select auth.uid()) OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id = (select auth.uid())));
  END IF;
END $$;
```

**Step 4: Child table policies (projects, issues, etc.)**

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Members can view projects'
  ) THEN
    CREATE POLICY "Members can view projects" ON projects FOR SELECT TO authenticated USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Members can create projects'
  ) THEN
    CREATE POLICY "Members can create projects" ON projects FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Members can update projects'
  ) THEN
    CREATE POLICY "Members can update projects" ON projects FOR UPDATE TO authenticated
      USING (workspace_id IN (SELECT get_user_workspace_ids())) WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Members can delete projects'
  ) THEN
    CREATE POLICY "Members can delete projects" ON projects FOR DELETE TO authenticated USING (workspace_id IN (SELECT get_user_workspace_ids()));
  END IF;
END $$;
```

**Step 5: Deep child tables (comments on issues)**

For tables further down the hierarchy, cascade through parent tables but still use the helper for workspace check:

```sql
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Members can view comments'
  ) THEN
    CREATE POLICY "Members can view comments" ON comments FOR SELECT TO authenticated
      USING (issue_id IN (SELECT i.id FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.workspace_id IN (SELECT get_user_workspace_ids())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Members can create comments'
  ) THEN
    CREATE POLICY "Members can create comments" ON comments FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = user_id AND issue_id IN (SELECT i.id FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.workspace_id IN (SELECT get_user_workspace_ids())));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can update own comments'
  ) THEN
    CREATE POLICY "Users can update own comments" ON comments FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Users can delete own comments'
  ) THEN
    CREATE POLICY "Users can delete own comments" ON comments FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
  END IF;
END $$;
```

> **Adapt table/column names** to match your architecture.md. Always use the `get_user_workspace_ids()` helper for workspace membership checks.

### Full Example: Todo App with Auth

```sql
-- schema.sql for authenticated todo app

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  completed boolean DEFAULT false
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can view own todos') THEN CREATE POLICY "Users can view own todos" ON todos FOR SELECT TO authenticated USING ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can create own todos') THEN CREATE POLICY "Users can create own todos" ON todos FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can update own todos') THEN CREATE POLICY "Users can update own todos" ON todos FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can delete own todos') THEN CREATE POLICY "Users can delete own todos" ON todos FOR DELETE TO authenticated USING ((select auth.uid()) = user_id); END IF; END $$;

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
NOTIFY pgrst, 'reload schema';
```

### Full Example: Blog App with Draft/Publish

```sql
-- schema.sql for blog app with draft/publish workflow

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

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Anyone can view published posts') THEN CREATE POLICY "Anyone can view published posts" ON posts FOR SELECT TO anon, authenticated USING (published = true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Authors can view own posts') THEN CREATE POLICY "Authors can view own posts" ON posts FOR SELECT TO authenticated USING ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Authors can create posts') THEN CREATE POLICY "Authors can create posts" ON posts FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Authors can update own posts') THEN CREATE POLICY "Authors can update own posts" ON posts FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Authors can delete own posts') THEN CREATE POLICY "Authors can delete own posts" ON posts FOR DELETE TO authenticated USING ((select auth.uid()) = user_id); END IF; END $$;

CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts(slug);
CREATE INDEX IF NOT EXISTS posts_published_created_at_idx ON posts(published, created_at DESC);
NOTIFY pgrst, 'reload schema';
```
