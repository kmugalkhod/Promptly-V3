import { NextRequest, NextResponse } from "next/server";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/** Poll interval in ms */
const POLL_INTERVAL = 5000;
/** Max wait time in ms (3 minutes) */
const MAX_WAIT = 180000;

/**
 * Create a new Supabase project and wait until it's ready.
 *
 * POST /api/auth/supabase/create-project
 * Body: { access_token, org_id, project_name, region, db_password }
 *
 * Returns: { projectRef, supabaseUrl, supabaseAnonKey }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { access_token, org_id, project_name, region, db_password } = body;

  if (!access_token || !org_id || !project_name || !db_password) {
    return NextResponse.json(
      { error: "Missing required fields: access_token, org_id, project_name, db_password" },
      { status: 400 }
    );
  }

  const headers = {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  };

  // 1. Create the project
  const createRes = await fetch(`${SUPABASE_API_BASE_URL}/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      organization_id: org_id,
      name: project_name,
      region: region || "us-east-1",
      db_pass: db_password,
      plan: "free",
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    return NextResponse.json(
      { error: `Failed to create project: ${createRes.status} - ${errBody}` },
      { status: createRes.status }
    );
  }

  const project = await createRes.json() as { id: string; ref: string; name: string };
  const projectRef = project.ref ?? project.id;

  // 2. Poll until project is ACTIVE_HEALTHY
  const startTime = Date.now();
  let status = "";

  while (Date.now() - startTime < MAX_WAIT) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    const statusRes = await fetch(`${SUPABASE_API_BASE_URL}/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json() as { status: string };
      status = statusData.status;
      if (status === "ACTIVE_HEALTHY") {
        break;
      }
    }
  }

  if (status !== "ACTIVE_HEALTHY") {
    return NextResponse.json(
      { error: `Project created but not ready yet (status: ${status}). It may still be provisioning — try selecting it from the project list in a minute.`, projectRef },
      { status: 202 }
    );
  }

  // 3. Fetch API keys
  const keysRes = await fetch(`${SUPABASE_API_BASE_URL}/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!keysRes.ok) {
    return NextResponse.json(
      { error: `Project created but failed to fetch API keys: ${keysRes.status}`, projectRef },
      { status: 500 }
    );
  }

  const apiKeys = await keysRes.json() as Array<{ name: string; api_key: string }>;
  const anonKey = apiKeys.find((k) => k.name === "anon" || k.name === "publishable");

  if (!anonKey) {
    return NextResponse.json(
      { error: "Project created but anon key not found", projectRef },
      { status: 500 }
    );
  }

  return NextResponse.json({
    projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co`,
    supabaseAnonKey: anonKey.api_key,
  });
}
