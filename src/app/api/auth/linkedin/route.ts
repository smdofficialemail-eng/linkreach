import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/linkedin
 * Redirects the user to LinkedIn's OAuth consent screen.
 * After authorization, LinkedIn redirects to /api/auth/linkedin/callback.
 *
 * Env vars needed:
 *   LINKEDIN_CLIENT_ID   — from linkedin.com/developers
 *   LINKEDIN_REDIRECT_URI — your app's callback URL (set in LinkedIn app settings)
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID is not configured. Add it to your environment variables." },
      { status: 500 }
    );
  }

  // Use r_liteprofile + r_emailaddress (available by default on all LinkedIn apps).
  // If the app has "Sign In with LinkedIn using OpenID Connect" enabled, you can
  // switch to ["openid", "profile", "email"] for richer profile data.
  const scopes = ["r_liteprofile", "r_emailaddress"].join(" ");

  // State parameter — random CSRF token, stored in a cookie.
  const state = crypto.randomUUID();

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri || `${req.nextUrl.origin}/api/auth/linkedin/callback`);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  // Store state in a cookie for CSRF verification in the callback.
  response.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
