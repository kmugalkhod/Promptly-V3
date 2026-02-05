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

### schema.sql Template

Always use IF NOT EXISTS patterns to make schema idempotent:

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
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
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
      WITH CHECK (auth.uid() = id);
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
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
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
      USING (auth.uid() = user_id);
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
      WITH CHECK (auth.uid() = user_id);
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
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
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
      USING (auth.uid() = user_id);
  END IF;
END $$;
```

### Index Creation (Optional)

```sql
-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos(created_at DESC);
```

### RULES

1. **Always use IF NOT EXISTS** for tables and indexes
2. **Always use DO $$ block** for policies (prevents duplicate errors)
3. **Always enable RLS** with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. **Match columns to DATABASE section** in architecture.md
5. **Use auth.uid()** for user-specific policies
6. **Policy names must be unique** per table
