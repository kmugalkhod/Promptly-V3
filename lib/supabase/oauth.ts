/**
 * Supabase OAuth 2.1 PKCE utilities
 *
 * Used client-side to initiate the OAuth flow and generate PKCE parameters.
 * The actual token exchange happens server-side in a Convex action.
 */

// Supabase Management API OAuth endpoints
export const SUPABASE_OAUTH_AUTHORIZE_URL =
  "https://api.supabase.com/v1/oauth/authorize";
export const SUPABASE_OAUTH_TOKEN_URL =
  "https://api.supabase.com/v1/oauth/token";
export const SUPABASE_API_BASE_URL = "https://api.supabase.com/v1";

/**
 * Generate a cryptographically random code verifier for PKCE.
 * Must be 43-128 characters, URL-safe.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate SHA-256 code challenge from a code verifier.
 */
export async function generateCodeChallenge(
  verifier: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generate a random state string for CSRF protection.
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Build the Supabase OAuth authorization URL.
 */
export function getAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(SUPABASE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  return url.toString();
}

/**
 * Get the OAuth callback redirect URI based on the app URL.
 */
export function getRedirectUri(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/supabase/callback`;
}

/**
 * Base64url encode a Uint8Array (RFC 4648 Section 5).
 * Replaces + with -, / with _, removes = padding.
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
