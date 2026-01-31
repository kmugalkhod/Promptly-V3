import { NextRequest, NextResponse } from "next/server";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/**
 * List the user's Supabase organizations.
 *
 * GET /api/auth/supabase/organizations?access_token=...
 *   → Returns { organizations: [{ id, name }] }
 */
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get("access_token");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const response = await fetch(`${SUPABASE_API_BASE_URL}/organizations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch organizations: ${response.status}` },
      { status: response.status }
    );
  }

  const orgs = await response.json();

  return NextResponse.json({
    organizations: (
      orgs as Array<{ id: string; name: string }>
    ).map((o) => ({
      id: o.id,
      name: o.name,
    })),
  });
}
