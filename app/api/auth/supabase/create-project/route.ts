import { NextRequest, NextResponse } from "next/server";

const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/** Initial poll interval in ms */
const INITIAL_POLL_INTERVAL = 3000;
/** Max poll interval in ms */
const MAX_POLL_INTERVAL = 15000;
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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { access_token, org_id, project_name, region, db_password } = body;

  if (
    typeof access_token !== "string" ||
    typeof org_id !== "string" ||
    typeof project_name !== "string" ||
    typeof db_password !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields: access_token, org_id, project_name, db_password must be strings" },
      { status: 400 }
    );
  }

  // Validate project_name length and format (1-64 chars, alphanumeric + hyphens + spaces)
  if (project_name.length < 1 || project_name.length > 64 || !/^[a-z0-9\s-]+$/i.test(project_name)) {
    return NextResponse.json(
      { error: "Invalid project_name: must be 1-64 characters, alphanumeric, hyphens, or spaces" },
      { status: 400 }
    );
  }

  // Validate region format if provided (alphanumeric + hyphens)
  if (region !== undefined && (typeof region !== "string" || !/^[a-z0-9-]+$/i.test(region))) {
    return NextResponse.json(
      { error: "Invalid region format" },
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

  const project = await createRes.json();
  if (!project || typeof project !== "object") {
    return NextResponse.json(
      { error: "Unexpected project creation response format" },
      { status: 502 }
    );
  }
  const projectRef = (project.ref ?? project.id) as string;
  if (typeof projectRef !== "string" || !projectRef) {
    return NextResponse.json(
      { error: "Unexpected project creation response: missing project reference" },
      { status: 502 }
    );
  }

  // 2. Poll until project is ACTIVE_HEALTHY (with exponential backoff)
  const startTime = Date.now();
  let status = "";
  let attempt = 0;

  while (Date.now() - startTime < MAX_WAIT) {
    const delay = Math.min(
      INITIAL_POLL_INTERVAL * Math.pow(2, attempt) + Math.floor(Math.random() * 500),
      MAX_POLL_INTERVAL
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt++;

    const statusRes = await fetch(`${SUPABASE_API_BASE_URL}/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      status = typeof statusData?.status === "string" ? statusData.status : "";
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

  const apiKeys = await keysRes.json();
  if (!Array.isArray(apiKeys)) {
    return NextResponse.json(
      { error: "Unexpected API keys response format", projectRef },
      { status: 502 }
    );
  }
  const anonKey = (apiKeys as Array<{ name: string; api_key: string }>).find(
    (k) => k.name === "anon" || k.name === "publishable"
  );

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
