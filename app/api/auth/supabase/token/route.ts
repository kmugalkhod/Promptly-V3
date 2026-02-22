import { NextRequest, NextResponse } from "next/server";

const SUPABASE_OAUTH_TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

/**
 * Exchange an authorization code for Supabase OAuth tokens.
 * This runs server-side so the client secret is never exposed.
 * Returns access_token to the client for fetching projects.
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

  const { code, codeVerifier, redirectUri } = body;

  if (
    typeof code !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof redirectUri !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields: code, codeVerifier, redirectUri must be strings" },
      { status: 400 }
    );
  }

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "OAuth not configured on server" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(SUPABASE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Token exchange failed: ${response.status}`, details: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();

  if (
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    typeof data.expires_in !== "number"
  ) {
    return NextResponse.json(
      { error: "Unexpected token response format from Supabase" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
