import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler for Supabase Management API OAuth.
 *
 * Supabase redirects here with ?code=...&state=... after user authorizes.
 * We return a minimal HTML page that uses postMessage to send the code
 * back to the opener window (SupabaseIntegrationPanel), which then
 * calls a Convex action to exchange the code for tokens server-side.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Build the HTML response that communicates with the opener window
  const html = `<!DOCTYPE html>
<html>
<head><title>Supabase OAuth</title></head>
<body>
<p>Completing authorization...</p>
<script>
(function() {
  var message = ${JSON.stringify({ code, state, error, errorDescription })};
  if (window.opener) {
    window.opener.postMessage(
      { type: "supabase-oauth-callback", ...message },
      window.location.origin
    );
    window.close();
  } else {
    document.body.innerHTML = '<p>Authorization complete. You can close this window.</p>';
  }
})();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
