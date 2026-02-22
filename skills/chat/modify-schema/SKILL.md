---
name: modify-schema
description: Safely modify database schema. Use when user requests adding columns, tables, RLS policies, or fixing schema issues.
category: chat
agents: [chat]
---

## When to Use
- User asks to add a column or field to an existing table
- User asks to add a new table
- User asks to modify or add RLS policies
- User asks to fix schema issues (missing columns, wrong types)
- User asks to drop a column or table (destructive — warn first)

## Instructions

### Safe Modification Workflow

1. **Always read schema.sql first** — use `read_file("schema.sql")` to get the current state
2. **Identify what needs to change** — compare user request against existing schema
3. **Use additive patterns** — prefer `IF NOT EXISTS` and `IF EXISTS` for idempotency
4. **Update both CREATE TABLE and add ALTER TABLE** — keep the CREATE TABLE definition consistent with the actual state, and add ALTER TABLE statements for the change
5. **Always preserve NOTIFY pgrst as the last line** — this reloads the PostgREST schema cache
6. **After modifying schema.sql, update all dependent code:**
   - TypeScript interfaces to match new columns
   - `.select()` queries to include new columns
   - INSERT operations to include new columns where needed
   - UI components to display/input new fields

### Additive Patterns (Safe — Use These)

**Add a column to an existing table:**
```sql
-- Update the CREATE TABLE to include the new column for consistency
-- Then add ALTER TABLE for the actual migration:
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;
```

**Add a new table:**
```sql
-- Place in correct FK order (parent tables before child tables)
CREATE TABLE IF NOT EXISTS new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  -- columns here
);
```

**Add an RLS policy:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'table_name' AND policyname = 'Policy name'
  ) THEN
    CREATE POLICY "Policy name" ON table_name
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
```

**Add SECURITY DEFINER helper (when adding 3rd+ table with FKs):**

If your modification adds a table that brings the total to 3+ tables with foreign key chains, you MUST also add a SECURITY DEFINER helper function:

```sql
-- Create AFTER all tables, BEFORE policies
create or replace function get_user_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select id from workspaces where owner_id = (select auth.uid())
  union
  select workspace_id from workspace_members where user_id = (select auth.uid());
$$;
```

Adapt the function name and query to match your schema's ownership/membership pattern.

**Add an index:**
```sql
CREATE INDEX IF NOT EXISTS index_name ON table_name(column_name);
```

### Destructive Patterns (Warn User First)

These operations permanently delete data. Only use when the user explicitly requests removal.

**Drop a column:**
```sql
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
```

**Drop a table:**
```sql
DROP TABLE IF EXISTS table_name CASCADE;
```

Always warn the user: "This will permanently delete data. Are you sure?"

**Rename a column (data loss risk):**
Renaming requires DROP + ADD. Instead, recommend:
1. Add new column with desired name
2. Copy data: `UPDATE table SET new_col = old_col;`
3. Drop old column only after confirming data is migrated

### Schema.sql Section Ordering (MANDATORY)

Every schema.sql file MUST follow this exact section order:

1. **ALL `CREATE TABLE IF NOT EXISTS` statements** — parent tables BEFORE child tables
2. **`ALTER TABLE ADD COLUMN IF NOT EXISTS` statements** — for schema modifications
3. **`SECURITY DEFINER` helper functions** — if multi-table FK chains exist
4. **ALL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements**
5. **ALL policy statements** — using `DO $$ IF NOT EXISTS` pattern
6. **ALL `CREATE INDEX IF NOT EXISTS` statements**
7. **`NOTIFY pgrst, 'reload schema';`** — ALWAYS the last line

### Post-Modification Checklist

After modifying schema.sql, you MUST also update:

- [ ] **TypeScript interfaces** — add/remove fields to match new columns
- [ ] **`.select()` queries** — include new columns in select statements
- [ ] **INSERT operations** — include new columns where they have user-provided values
- [ ] **UI components** — add input fields or display elements for new data

### Rules

1. **ALWAYS read schema.sql before modifying** — never write from memory
2. **NEVER rewrite schema.sql from scratch** — modify the existing file
3. **NEVER remove existing CREATE TABLE, RLS, or policy statements** unless explicitly asked
4. **Use IF NOT EXISTS / IF EXISTS** for all operations (idempotency)
5. **ALWAYS end with `NOTIFY pgrst, 'reload schema';`**
6. **Update TypeScript types and queries** to match schema changes
7. **Preserve section ordering** — don't interleave tables with policies
8. **Column names must be consistent** across schema.sql, TypeScript interfaces, and CRUD operations
9. **If schema has 3+ tables with FKs, ensure SECURITY DEFINER helper exists** — when adding tables, check if the schema now has 3+ tables with foreign key chains. If so, add a SECURITY DEFINER helper function if one doesn't exist yet.
