import { NextRequest, NextResponse } from "next/server";

const SUPABASE_OAUTH_TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

/**
 * Exchange an authorization code for Supabase OAuth tokens.
 * This runs server-side so the client secret is never exposed.
 * Returns access_token to the client for fetching projects.
 */
export async function POST(request: NextRequest) {
  const { code, codeVerifier, redirectUri } = await request.json();

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "OAuth not configured on server" },
      { status: 500 }
    );
  }

  const body = new URLSearchParams({
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
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Token exchange failed: ${response.status}`, details: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();

  // Return tokens the client needs — access_token for Management API, refresh for auto-renewal
  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
