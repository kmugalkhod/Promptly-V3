import { NextRequest, NextResponse } from "next/server";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/**
 * Fetch the user's Supabase projects and optionally get API keys for a specific project.
 *
 * GET /api/auth/supabase/projects?access_token=...
 *   → Returns list of projects
 *
 * GET /api/auth/supabase/projects?access_token=...&projectRef=...
 *   → Returns project URL + anon key for the specified project
 */
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get("access_token");
  const projectRef = request.nextUrl.searchParams.get("projectRef");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  // If projectRef is provided, fetch API keys for that project
  if (projectRef) {
    const response = await fetch(
      `${SUPABASE_API_BASE_URL}/projects/${projectRef}/api-keys`,
      { headers }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch API keys: ${response.status}` },
        { status: response.status }
      );
    }

    const apiKeys = await response.json();
    const anonKey = (apiKeys as Array<{ name: string; api_key: string }>).find(
      (k) => k.name === "anon" || k.name === "publishable"
    );

    if (!anonKey) {
      return NextResponse.json(
        { error: "Could not find anon key for this project" },
        { status: 404 }
      );
    }

    const serviceKey = (apiKeys as Array<{ name: string; api_key: string }>).find(
      (k) => k.name === "service_role"
    );

    return NextResponse.json({
      supabaseUrl: `https://${projectRef}.supabase.co`,
      supabaseAnonKey: anonKey.api_key,
      ...(serviceKey ? { supabaseServiceRoleKey: serviceKey.api_key } : {}),
    });
  }

  // Otherwise, fetch all projects
  const response = await fetch(`${SUPABASE_API_BASE_URL}/projects`, { headers });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch projects: ${response.status}` },
      { status: response.status }
    );
  }

  const projects = await response.json();

  return NextResponse.json({
    projects: (
      projects as Array<{
        id: string;
        name: string;
        organization_id: string;
        ref: string;
        region: string;
      }>
    ).map((p) => ({
      ref: p.ref ?? p.id,
      name: p.name,
      region: p.region,
    })),
  });
}
