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
  const body = await request.json();
  const { access_token, project_ref, sql } = body;

  if (!access_token || !project_ref || !sql) {
    return NextResponse.json(
      { error: "Missing required fields: access_token, project_ref, sql" },
      { status: 400 }
    );
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
