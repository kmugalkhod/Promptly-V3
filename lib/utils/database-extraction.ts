/**
 * Database Section Extraction
 *
 * Extracts the DATABASE section from architecture.md text.
 * Used by the Schema-First Pipeline to feed database specs
 * to the Schema Agent before the Coder Agent runs.
 */

/**
 * Extract the DATABASE section from architecture text.
 * Returns the raw text block (YAML-like indentation) or null if not found.
 *
 * The DATABASE section starts with "DATABASE:" and ends at the next
 * top-level section header (## or ALL-CAPS-WORD:) or end of text.
 */
export function extractDatabaseSection(architecture: string): string | null {
  // Match DATABASE: section until next ## header, next top-level YAML key, or end of text
  const dbMatch = architecture.match(
    /DATABASE:\s*\n([\s\S]*?)(?=\n##|\n[A-Z][A-Z_]+:|\s*$)/
  );

  if (!dbMatch) return null;

  const content = dbMatch[1].trim();
  if (!content) return null;

  // Return the full DATABASE section including the header for context
  return `DATABASE:\n${content}`;
}

/**
 * Quick check for whether architecture text contains a DATABASE section.
 */
export function hasDatabaseSection(architecture: string): boolean {
  return /DATABASE:\s*\n\s+\S/.test(architecture);
}

/**
 * Extract table names from a DATABASE section.
 * Parses the YAML-like format: "  - table_name:" at 4-space or 2-space indent.
 */
export function extractTableNames(databaseSection: string): string[] {
  const tables: string[] = [];
  // Match lines like "    - table_name:" or "  - table_name:"
  const tableRegex = /^\s+-\s+(\w+):\s*$/gm;
  let match;

  while ((match = tableRegex.exec(databaseSection)) !== null) {
    const name = match[1];
    // Skip known non-table keys
    if (name !== "tables" && name !== "env_vars") {
      tables.push(name);
    }
  }

  return tables;
}

/**
 * Detect whether a DATABASE section uses authentication.
 *
 * Returns true if the section references auth.users (FK to auth schema),
 * contains a profiles table with auth.users FK, or has user_id/owner_id
 * columns with FK references.
 *
 * When this returns false, the schema should use public-access RLS
 * policies (USING(true) / WITH CHECK(true)) instead of auth.uid() checks.
 */
export function detectAuthUsage(databaseSection: string): boolean {
  // Check for explicit auth.users references (FK declarations)
  if (/auth\.users/i.test(databaseSection)) {
    return true;
  }

  // Check for profiles table (standard auth pattern)
  if (/profiles:/i.test(databaseSection) && /fk\s*->/i.test(databaseSection)) {
    return true;
  }

  // Check for user_id/owner_id columns with FK references (implies auth ownership)
  if (/user_id.*fk|owner_id.*fk/i.test(databaseSection)) {
    return true;
  }

  return false;
}
