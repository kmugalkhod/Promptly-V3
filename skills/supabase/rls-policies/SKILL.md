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

## Instructions

### CRITICAL — schema.sql is a MANDATORY File

⚠️ **schema.sql is NOT optional documentation — it is a MANDATORY file that MUST be created in the project root.**

The auto-execution pipeline reads `schema.sql` from the project root and executes it against Supabase. Without this file, NO tables will be created and ALL database operations will fail.

- EVERY table listed in architecture.md DATABASE section MUST have a corresponding `CREATE TABLE IF NOT EXISTS` statement in schema.sql.
- Create this file BEFORE any component files.

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

**5. Public CRUD (no auth required):**

For apps without authentication (todo lists, simple tools). Uses explicit per-operation policies:

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
