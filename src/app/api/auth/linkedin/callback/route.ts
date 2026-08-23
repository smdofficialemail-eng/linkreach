import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/app";

/**
 * GET /api/auth/linkedin/callback?code=...&state=...
 * Handles the redirect back from LinkedIn after OAuth authorization.
 * 1. Verifies CSRF state
 * 2. Exchanges the authorization code for an access token
 * 3. Fetches the user's profile via OpenID Connect
 * 4. Creates or updates a LinkedinAccount in the current workspace
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  // If LinkedIn returned an error (user denied, etc.)
  if (error) {
    return NextResponse.redirect(
      new URL(`/app/accounts?linkedin_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/app/accounts?linkedin_error=missing_code", req.url)
    );
  }

  // Verify CSRF state.
  const savedState = req.cookies.get("linkedin_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL("/app/accounts?linkedin_error=invalid_state", req.url)
    );
  }

  // Clear the state cookie.
  const response = NextResponse.redirect(new URL("/app/accounts?linkedin=connected", req.url));
  response.cookies.delete("linkedin_oauth_state");

  try {
    // Exchange code for access token.
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[LinkedIn OAuth] Token exchange failed:", err);
      return NextResponse.redirect(
        new URL(`/app/accounts?linkedin_error=token_exchange_failed`, req.url)
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;
    const expiresIn = tokenData.expires_in as number; // seconds
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // Fetch user profile via OpenID Connect userinfo endpoint.
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let linkedinId = "";
    let fullName = "LinkedIn User";
    let picture: string | null = null;
    let headline: string | null = null;
    let email: string | null = null;

    if (profileRes.ok) {
      const profile = await profileRes.json();
      // OpenID Connect userinfo returns: sub, name, given_name, family_name, picture, email
      linkedinId = profile.sub || "";
      fullName = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim() || "LinkedIn User";
      email = profile.email || null;
      picture = profile.picture || null;
    } else {
      console.error("[LinkedIn OAuth] Profile fetch failed:", profileRes.status);
    }

    // Find the workspace for the current user.
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const workspaceId = membership.workspaceId;

    // Check if this LinkedIn account is already connected to any workspace.
    const existing = await prisma.linkedinAccount.findFirst({
      where: { linkedinId },
    });

    if (existing) {
      if (existing.workspaceId === workspaceId) {
        // Same workspace — update the tokens and profile info.
        await prisma.linkedinAccount.update({
          where: { id: existing.id },
          data: {
            name: fullName || existing.name,
            email: email || existing.email,
            avatarUrl: picture || existing.avatarUrl,
            headline: headline || existing.headline,
            accessToken,
            refreshToken: tokenData.refresh_token || existing.refreshToken,
            tokenExpiry,
          },
        });
      } else {
        // Different workspace — this LinkedIn account is already linked elsewhere.
        // Redirect with an error.
        return NextResponse.redirect(
          new URL("/app/accounts?linkedin_error=already_linked_other_workspace", req.url)
        );
      }
    } else {
      // New connection — create the account.
      await prisma.linkedinAccount.create({
        data: {
          workspaceId,
          name: fullName || "LinkedIn User",
          email,
          linkedinId,
          avatarUrl: picture,
          headline,
          profileUrl: `https://www.linkedin.com/in/${linkedinId}`,
          accessToken,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiry,
        },
      });

      // Log the connection.
      await prisma.activityLog.create({
        data: {
          workspaceId,
          type: "note",
          message: `LinkedIn account "${fullName}" connected via OAuth`,
        },
      });
    }

    return response;
  } catch (err) {
    console.error("[LinkedIn OAuth] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/app/accounts?linkedin_error=unexpected_error", req.url)
    );
  }
}
