import { NextRequest, NextResponse } from "next/server";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/**
 * Execute SQL against a Supabase project via the Management API.
 *
 * POST /api/auth/supabase/execute-sql
 * Body: { access_token, project_ref, sql }
 *
 * Returns: { success: true, result: ... } or { error: "..." }
 */
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { access_token, project_ref, sql } = body;

  if (
    typeof access_token !== "string" ||
    typeof project_ref !== "string" ||
    typeof sql !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields: access_token, project_ref, sql must be strings" },
      { status: 400 }
    );
  }

  // Validate project_ref format (alphanumeric + hyphens only, max 50 chars)
  if (!/^[a-z0-9-]{1,50}$/i.test(project_ref)) {
    return NextResponse.json(
      { error: "Invalid project_ref format" },
      { status: 400 }
    );
  }

  // Enforce SQL size limit (100KB)
  if (sql.length > 100_000) {
    return NextResponse.json(
      { error: "SQL exceeds maximum length (100KB)" },
      { status: 400 }
    );
  }

  // SQL statement allowlist — only permit schema-building operations
  const allowedPrefixes = [
    "CREATE ", "ALTER ", "ENABLE ", "DROP ", "INSERT ", "SELECT ", "GRANT ",
    "SET ", "BEGIN", "COMMIT", "DO $$", "-- ",
  ];
  const statements = sql.split(";").map((s: string) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const upper = stmt.toUpperCase().trimStart();
    if (!allowedPrefixes.some((prefix) => upper.startsWith(prefix))) {
      return NextResponse.json(
        { error: "SQL statement not allowed. Only schema operations (CREATE, ALTER, DROP, etc.) are permitted." },
        { status: 400 }
      );
    }
  }

  const response = await fetch(
    `${SUPABASE_API_BASE_URL}/projects/${project_ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sql,
        read_only: false,
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    return NextResponse.json(
      { error: `SQL execution failed: ${response.status} - ${errBody}` },
      { status: response.status }
    );
  }

  const result = await response.json();

  return NextResponse.json({ success: true, result });
}
