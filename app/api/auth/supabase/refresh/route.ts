import { NextRequest, NextResponse } from "next/server";

const SUPABASE_OAUTH_TOKEN_URL = "https://api.supabase.com/v1/oauth/token";

/**
 * Refresh an expired Supabase OAuth access token using a refresh token.
 * Runs server-side so the client secret is never exposed.
 */
export async function POST(request: NextRequest) {
  const { refresh_token } = await request.json();

  if (!refresh_token) {
    return NextResponse.json(
      { error: "refresh_token is required" },
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

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
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
      { error: `Token refresh failed: ${response.status}`, details: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
