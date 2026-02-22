/**
 * Coder Output Validation
 *
 * Comprehensive validation for coder-generated files. Runs TypeScript check,
 * import validation, and Supabase column matching. Used by the self-healing
 * generation loop to detect issues and provide structured feedback for retry.
 */

import type { SandboxActions } from "../agents/tools";
import { validateGeneratedCode } from "./code-validation";

// ============================================================================
// Types
// ============================================================================

export interface CoderValidationError {
  type: "typescript" | "import" | "supabase_column" | "code_pattern";
  file: string;
  line?: number;
  message: string;
  code?: string;
  suggestion?: string;
}

export interface CoderValidationResult {
  success: boolean;
  errors: CoderValidationError[];
  warnings: string[];
  /** Formatted string ready to pass as errorFeedback to coder */
  formattedErrors: string;
  /** Formatted actionable warnings for retry feedback (unused components, useState patterns) */
  formattedWarnings: string;
}

// ============================================================================
// TypeScript Validation
// ============================================================================

/**
 * Run `npx tsc --noEmit --skipLibCheck` in the sandbox and parse errors.
 * Runs TypeScript compilation and parses the error output.
 */
async function runTypeScriptValidation(
  sandboxActions: SandboxActions
): Promise<CoderValidationError[]> {
  try {
    const result = await sandboxActions.runCommand(
      "npx tsc --noEmit --skipLibCheck 2>&1 || true"
    );

    const output = (result.stdout || "") + (result.stderr || "");
    const parsed = parseTypeScriptOutput(output);

    // Filter out errors from node_modules/ and .next/
    return parsed
      .filter(
        (e) =>
          !e.file.includes("node_modules/") && !e.file.includes(".next/")
      )
      .map((e) => ({
        type: "typescript" as const,
        file: e.file,
        line: e.line,
        message: e.message,
        code: e.code,
        suggestion: getTypeScriptSuggestion(e.code, e.message),
      }));
  } catch (error) {
    console.error("[coder-validation] TypeScript check error:", error);
    return [
      {
        type: "typescript",
        file: "",
        message:
          error instanceof Error
            ? error.message
            : "TypeScript check failed (timeout or sandbox error)",
        code: "TS_CHECK_ERROR",
      },
    ];
  }
}

/**
 * Parse TypeScript compiler output into structured errors.
 * Parses tsc output lines into structured error objects.
 */
function parseTypeScriptOutput(
  output: string
): { file: string; line: number; column: number; code: string; message: string }[] {
  const errors: { file: string; line: number; column: number; code: string; message: string }[] = [];
  // tsc outputs file(line,col): error TSxxxx: msg
  const parenRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  // Some configs output file:line:col: error TSxxxx: msg
  const colonRegex = /^(.+?):(\d+):(\d+):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match;
  while ((match = parenRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
    });
  }
  while ((match = colonRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
    });
  }

  return errors;
}

/** Map common TS error codes to actionable suggestions */
function getTypeScriptSuggestion(code: string, message: string): string | undefined {
  if (message.includes("'use client'") || code === "TS2767") {
    return "Add 'use client' as the first line of the file";
  }
  if (code === "TS2307") {
    return "Check the import path — the referenced module may not exist or has a typo";
  }
  if (code === "TS2322") {
    return "Fix the type annotation or ensure the value matches the expected type";
  }
  if (code === "TS2339") {
    return "The property doesn't exist on this type — check column names match schema.sql";
  }
  if (code === "TS7006") {
    return "Add a type annotation to the parameter";
  }
  return undefined;
}

// ============================================================================
// Import Validation
// ============================================================================

/**
 * Validate that relative and @/ imports in generated files resolve to existing files.
 */
async function validateImports(
  sandboxActions: SandboxActions,
  filesCreated: string[]
): Promise<CoderValidationError[]> {
  const errors: CoderValidationError[] = [];
  const codeFiles = filesCreated.filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  );

  for (const filePath of codeFiles) {
    let content: string | null;
    try {
      content = await sandboxActions.readFile(filePath);
    } catch {
      continue;
    }
    if (!content) continue;

    // Extract import paths
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Skip node_modules imports (no ./ or ../ or @/ prefix)
      if (
        !importPath.startsWith("./") &&
        !importPath.startsWith("../") &&
        !importPath.startsWith("@/")
      ) {
        continue;
      }

      // Skip dynamic imports
      if (importPath.includes("*")) continue;

      // Resolve the import path
      let resolvedPath: string;
      if (importPath.startsWith("@/")) {
        // @/ maps to project root
        resolvedPath = importPath.replace("@/", "");
      } else {
        // Relative import — resolve from file's directory
        const fileDir = filePath.includes("/")
          ? filePath.substring(0, filePath.lastIndexOf("/"))
          : "";
        resolvedPath = resolvePath(fileDir, importPath);
      }

      // Check if file exists (try exact path, then with extensions, then index files)
      const exists = await checkFileExists(sandboxActions, resolvedPath);
      if (!exists) {
        errors.push({
          type: "import",
          file: filePath,
          message: `Cannot resolve import '${importPath}' — file not found`,
          suggestion: `Check if the file exists at '${resolvedPath}' or fix the import path`,
        });
      }
    }
  }

  return errors;
}

/** Resolve a relative path from a base directory */
function resolvePath(baseDir: string, relativePath: string): string {
  const parts = baseDir ? baseDir.split("/") : [];
  const relParts = relativePath.split("/");

  for (const part of relParts) {
    if (part === "..") {
      parts.pop();
    } else if (part !== ".") {
      parts.push(part);
    }
  }

  return parts.join("/");
}

/** Check if a file exists in the sandbox, trying multiple extensions */
async function checkFileExists(
  sandboxActions: SandboxActions,
  path: string
): Promise<boolean> {
  // If path already has an extension, check directly
  if (/\.\w+$/.test(path)) {
    try {
      const content = await sandboxActions.readFile(path);
      return content !== null;
    } catch {
      return false;
    }
  }

  // Try common extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const ext of extensions) {
    try {
      const content = await sandboxActions.readFile(path + ext);
      if (content !== null) return true;
    } catch {
      // continue
    }
  }

  // Try index files
  for (const ext of extensions) {
    try {
      const content = await sandboxActions.readFile(`${path}/index${ext}`);
      if (content !== null) return true;
    } catch {
      // continue
    }
  }

  return false;
}

// ============================================================================
// Supabase Column Validation
// ============================================================================

interface TableSchema {
  name: string;
  columns: string[];
  /** True if the table has a user_id column referencing auth.users */
  requiresAuth: boolean;
}

/**
 * Validate that Supabase table/column references in generated files match schema.sql.
 */
async function validateSupabaseColumns(
  sandboxActions: SandboxActions,
  filesCreated: string[],
  providedSchemaContent?: string | null
): Promise<CoderValidationError[]> {
  // Use provided content or read from sandbox
  let schemaContent: string | null | undefined = providedSchemaContent;
  if (schemaContent === undefined) {
    try {
      schemaContent = await sandboxActions.readFile("schema.sql");
    } catch {
      return [];
    }
  }
  if (!schemaContent?.trim()) return [];

  // Parse tables and columns from schema.sql
  const tables = parseSchemaSQL(schemaContent);
  if (tables.length === 0) return [];

  const tableNames = new Set(tables.map((t) => t.name));
  const tableColumnMap = new Map<string, Set<string>>();
  for (const t of tables) {
    tableColumnMap.set(t.name, new Set(t.columns));
  }

  const errors: CoderValidationError[] = [];
  const codeFiles = filesCreated.filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  );

  for (const filePath of codeFiles) {
    let content: string | null;
    try {
      content = await sandboxActions.readFile(filePath);
    } catch {
      continue;
    }
    if (!content) continue;

    // Check .from('table_name') references
    const fromRegex = /\.from\(\s*['"](\w+)['"]\s*\)/g;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      const tableName = match[1];
      if (!tableNames.has(tableName)) {
        errors.push({
          type: "supabase_column",
          file: filePath,
          message: `Table '${tableName}' referenced in .from() does not exist in schema.sql`,
          suggestion: `Available tables: ${[...tableNames].join(", ")}`,
        });
      }
    }

    // Check .insert({col: val}) column references
    const insertRegex = /\.insert\(\s*\{([^}]+)\}/g;
    while ((match = insertRegex.exec(content)) !== null) {
      // Find the nearest .from() call before this insert
      const beforeInsert = content.substring(0, match.index);
      const lastFrom = beforeInsert.match(/\.from\(\s*['"](\w+)['"]\s*\)/g);
      if (!lastFrom) continue;

      const lastFromMatch = lastFrom[lastFrom.length - 1].match(
        /\.from\(\s*['"](\w+)['"]\s*\)/
      );
      if (!lastFromMatch) continue;

      const tableName = lastFromMatch[1];
      const columns = tableColumnMap.get(tableName);
      if (!columns) continue;

      // Extract column names from the object literal
      const colNames = extractObjectKeys(match[1]);
      for (const col of colNames) {
        if (!columns.has(col)) {
          errors.push({
            type: "supabase_column",
            file: filePath,
            message: `Column '${col}' in .insert() does not exist in table '${tableName}'`,
            suggestion: `Available columns: ${[...columns].join(", ")}`,
          });
        }
      }
    }

    // Check .update({col: val}) column references
    const updateRegex = /\.update\(\s*\{([^}]+)\}/g;
    while ((match = updateRegex.exec(content)) !== null) {
      const beforeUpdate = content.substring(0, match.index);
      const lastFrom = beforeUpdate.match(/\.from\(\s*['"](\w+)['"]\s*\)/g);
      if (!lastFrom) continue;

      const lastFromMatch = lastFrom[lastFrom.length - 1].match(
        /\.from\(\s*['"](\w+)['"]\s*\)/
      );
      if (!lastFromMatch) continue;

      const tableName = lastFromMatch[1];
      const columns = tableColumnMap.get(tableName);
      if (!columns) continue;

      const colNames = extractObjectKeys(match[1]);
      for (const col of colNames) {
        if (!columns.has(col)) {
          errors.push({
            type: "supabase_column",
            file: filePath,
            message: `Column '${col}' in .update() does not exist in table '${tableName}'`,
            suggestion: `Available columns: ${[...columns].join(", ")}`,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Parse CREATE TABLE blocks from schema.sql to extract table names and columns.
 */
function parseSchemaSQL(sql: string): TableSchema[] {
  const tables: TableSchema[] = [];

  // Match CREATE TABLE blocks (handles IF NOT EXISTS)
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    // Extract column names from the table body
    // Each column definition starts with column_name type_name
    const columns: string[] = [];
    const lines = body.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip constraints, indexes, and empty lines
      if (
        !trimmed ||
        trimmed.startsWith("PRIMARY KEY") ||
        trimmed.startsWith("FOREIGN KEY") ||
        trimmed.startsWith("UNIQUE") ||
        trimmed.startsWith("CHECK") ||
        trimmed.startsWith("CONSTRAINT") ||
        trimmed.startsWith(")")
      ) {
        continue;
      }
      // First word is the column name
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (colMatch) {
        columns.push(colMatch[1]);
      }
    }

    // Detect if any column references auth.users (indicates auth-protected table)
    const requiresAuth = /user_id\s+.*REFERENCES\s+auth\.users/i.test(body);

    tables.push({ name: tableName, columns, requiresAuth });
  }

  // Second pass: detect tables with RLS + auth.uid() policies but no user_id FK
  for (const table of tables) {
    if (table.requiresAuth) continue;
    const rlsPattern = new RegExp(
      `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${table.name}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
      "i"
    );
    if (!rlsPattern.test(sql)) continue;
    const policyPattern = new RegExp(
      `CREATE\\s+POLICY[\\s\\S]*?ON\\s+${table.name}[\\s\\S]*?auth\\.uid\\(\\)`,
      "i"
    );
    if (policyPattern.test(sql)) {
      table.requiresAuth = true;
    }
  }

  return tables;
}

/** Extract key names from a JS object literal string like "col1: val, col2: val" */
function extractObjectKeys(objectBody: string): string[] {
  const keys: string[] = [];
  // Match key names (handling both quoted and unquoted keys)
  const keyRegex = /(?:['"]?(\w+)['"]?\s*:)/g;
  let match;
  while ((match = keyRegex.exec(objectBody)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Run all validation checks on coder output and aggregate results.
 *
 * @param sandboxActions - Sandbox actions for file I/O and command execution
 * @param filesCreated - List of file paths created/modified by the coder
 * @returns Aggregated validation result with formatted error string
 */
export async function validateCoderOutput(
  sandboxActions: SandboxActions,
  filesCreated: string[]
): Promise<CoderValidationResult> {
  const allErrors: CoderValidationError[] = [];
  const allWarnings: string[] = [];

  // Skip validation if no files were created
  if (filesCreated.length === 0) {
    return {
      success: true,
      errors: [],
      warnings: [],
      formattedErrors: "",
      formattedWarnings: "",
    };
  }

  // 1. TypeScript validation
  const tsErrors = await runTypeScriptValidation(sandboxActions);
  allErrors.push(...tsErrors);

  // 2. Import validation
  const importErrors = await validateImports(sandboxActions, filesCreated);
  allErrors.push(...importErrors);

  // Read schema.sql once for both Supabase and auth validation
  let schemaContent: string | null = null;
  try {
    schemaContent = await sandboxActions.readFile("schema.sql");
  } catch {
    // no schema.sql — skip schema-dependent validation
  }

  // 3. Supabase column validation
  const supabaseErrors = await validateSupabaseColumns(
    sandboxActions,
    filesCreated,
    schemaContent
  );
  allErrors.push(...supabaseErrors);

  // 3b. Auth pattern validation (INSERT missing user_id, middleware.ts missing)
  if (schemaContent?.trim()) {
    const tables = parseSchemaSQL(schemaContent);
    const authErrors = await validateAuthPatterns(
      sandboxActions,
      filesCreated,
      tables
    );
    allErrors.push(...authErrors);
  }

  // 4. Code pattern validation (reuse existing validateGeneratedCode)
  const codeValidation = await validateGeneratedCode(
    sandboxActions.readFile,
    filesCreated
  );
  // Convert code-validation errors to CoderValidationError format
  for (const err of codeValidation.errors) {
    // Parse "filePath: message" format from code-validation
    const colonIdx = err.indexOf(":");
    allErrors.push({
      type: "code_pattern",
      file: colonIdx > 0 ? err.substring(0, colonIdx).trim() : "",
      message: colonIdx > 0 ? err.substring(colonIdx + 1).trim() : err,
    });
  }
  // Code validation warnings stay as warnings
  allWarnings.push(...codeValidation.warnings);

  // Format errors for coder feedback
  const formattedErrors = formatErrorsForFeedback(allErrors);
  const formattedWarnings = formatWarningsForFeedback(allWarnings);

  return {
    success: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    formattedErrors,
    formattedWarnings,
  };
}

/**
 * Format validation errors into a structured string for coder retry prompt.
 */
function formatErrorsForFeedback(errors: CoderValidationError[]): string {
  if (errors.length === 0) return "";

  // Group errors by type
  const byType = new Map<string, CoderValidationError[]>();
  for (const e of errors) {
    const group = byType.get(e.type) || [];
    group.push(e);
    byType.set(e.type, group);
  }

  const sections: string[] = [];

  for (const [type, errs] of byType) {
    const label = {
      typescript: "TypeScript Errors",
      import: "Import Errors",
      supabase_column: "Supabase Column Mismatches",
      code_pattern: "Code Pattern Issues",
    }[type] || type;

    const lines = errs.map((e) => {
      let line = `- ${e.file}`;
      if (e.line) line += `:${e.line}`;
      line += `: ${e.message}`;
      if (e.code) line += ` (${e.code})`;
      if (e.suggestion) line += `\n  FIX: ${e.suggestion}`;
      return line;
    });

    sections.push(`### ${label} (${errs.length})\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Format actionable warnings into a string for coder retry prompt.
 * Filters to warnings the coder can actually fix (unused components, useState patterns).
 */
function formatWarningsForFeedback(warnings: string[]): string {
  // Filter to actionable warnings only
  const actionable = warnings.filter(
    (w) =>
      w.includes("imports/uses component") ||
      w.includes("useState([])") ||
      w.includes("useState(null)")
  );
  if (actionable.length === 0) return "";

  return `### Actionable Warnings (${actionable.length})\n${actionable.map((w) => `- ${w}`).join("\n")}`;
}

// ============================================================================
// Auth Pattern Validation
// ============================================================================

/**
 * Validate that auth-protected tables have proper user_id in INSERT calls,
 * and that middleware.ts exists when auth tables are present.
 */
async function validateAuthPatterns(
  sandboxActions: SandboxActions,
  filesCreated: string[],
  tables: TableSchema[]
): Promise<CoderValidationError[]> {
  const errors: CoderValidationError[] = [];
  const authTables = tables.filter((t) => t.requiresAuth);

  if (authTables.length === 0) return [];

  const authTableNames = new Set(authTables.map((t) => t.name));

  // Check 1: INSERT to auth tables must include user_id
  const codeFiles = filesCreated.filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  );

  for (const filePath of codeFiles) {
    let content: string | null;
    try {
      content = await sandboxActions.readFile(filePath);
    } catch {
      continue;
    }
    if (!content) continue;

    // Find .insert({...}) patterns and backward-lookup for the nearest .from('table')
    // Uses the same proven approach as validateSupabaseColumns() to handle multiline chains
    const insertRegex = /\.insert\(\s*\{([^}]+)\}/g;
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
      const beforeInsert = content.substring(0, match.index);
      const lastFrom = beforeInsert.match(/\.from\(\s*['"](\w+)['"]\s*\)/g);
      if (!lastFrom) continue;

      const lastFromMatch = lastFrom[lastFrom.length - 1].match(
        /\.from\(\s*['"](\w+)['"]\s*\)/
      );
      if (!lastFromMatch) continue;

      const tableName = lastFromMatch[1];
      const insertBody = match[1];

      if (authTableNames.has(tableName) && !insertBody.includes("user_id")) {
        errors.push({
          type: "supabase_column",
          file: filePath,
          message: `INSERT to auth-protected table '${tableName}' is missing user_id`,
          suggestion:
            "Add user_id: user.id to the .insert() call. Get user from useAuth() hook or supabase.auth.getUser()",
        });
      }
    }
  }

  // Check 2: middleware.ts must exist when auth tables are present
  const hasMiddleware = filesCreated.some((f) => f === "middleware.ts");
  if (!hasMiddleware) {
    // Also check if it exists in the sandbox already
    try {
      const existing = await sandboxActions.readFile("middleware.ts");
      if (!existing) {
        errors.push({
          type: "code_pattern",
          file: "middleware.ts",
          message:
            "middleware.ts is missing but auth-protected tables exist — sessions won't refresh and routes won't be protected",
          suggestion:
            'Create middleware.ts with Supabase auth token refresh (load "auth-setup" skill)',
        });
      }
    } catch {
      errors.push({
        type: "code_pattern",
        file: "middleware.ts",
        message:
          "middleware.ts is missing but auth-protected tables exist — sessions won't refresh and routes won't be protected",
        suggestion:
          'Create middleware.ts with Supabase auth token refresh (load "auth-setup" skill)',
      });
    }
  }

  // Check 3: Login/signup page must exist when auth tables are present
  const authPagePrefixes = [
    "app/auth/",
    "app/login/",
    "app/signup/",
    "app/sign-in/",
    "app/sign-up/",
  ];
  const hasAuthPage = filesCreated.some((f) =>
    authPagePrefixes.some((prefix) => f.startsWith(prefix))
  );
  if (!hasAuthPage) {
    // Also check if an auth page exists in the sandbox already
    let foundInSandbox = false;
    for (const prefix of authPagePrefixes) {
      try {
        const existing = await sandboxActions.readFile(`${prefix}page.tsx`);
        if (existing) {
          foundInSandbox = true;
          break;
        }
      } catch {
        // not found, continue
      }
    }
    if (!foundInSandbox) {
      errors.push({
        type: "code_pattern",
        file: "app/auth/",
        message:
          "No login/signup page found but auth-protected tables exist — users cannot authenticate",
        suggestion:
          'Create app/auth/page.tsx (or app/login/page.tsx) with email/password form using supabase.auth.signInWithPassword(). Load "auth-setup" skill for patterns.',
      });
    }
  }

  return errors;
}
