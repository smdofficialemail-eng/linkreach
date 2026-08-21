import { prisma } from "@/lib/db";

/**
 * Refresh a LinkedIn OAuth access token using the stored refresh token.
 * Returns the new access token and expiry, or null if refresh fails.
 */
export async function refreshLinkedInToken(accountId: string): Promise<{
  accessToken: string;
  tokenExpiry: Date;
} | null> {
  const account = await prisma.linkedinAccount.findUnique({ where: { id: accountId } });
  if (!account?.refreshToken) return null;

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    }).toString(),
  });

  if (!res.ok) {
    console.error("[LinkedIn] Token refresh failed:", res.status);
    return null;
  }

  const data = await res.json();
  const accessToken = data.access_token as string;
  const expiresIn = data.expires_in as number;
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

  await prisma.linkedinAccount.update({
    where: { id: accountId },
    data: {
      accessToken,
      refreshToken: data.refresh_token || account.refreshToken,
      tokenExpiry,
    },
  });

  return { accessToken, tokenExpiry };
}

/**
 * Get a valid access token for a LinkedIn account.
 * Automatically refreshes if expired (with 5-minute buffer).
 */
export async function getLinkedInAccessToken(accountId: string): Promise<string | null> {
  const account = await prisma.linkedinAccount.findUnique({ where: { id: accountId } });
  if (!account?.accessToken) return null;

  // Check if token is expired or expiring soon (5 min buffer).
  const bufferMs = 5 * 60 * 1000;
  if (account.tokenExpiry && account.tokenExpiry.getTime() > Date.now() + bufferMs) {
    return account.accessToken;
  }

  // Token expired or missing — try refresh.
  const refreshed = await refreshLinkedInToken(accountId);
  return refreshed?.accessToken ?? account.accessToken;
}

/**
 * Fetch the LinkedIn profile for a connected account.
 * Uses the OpenID Connect userinfo endpoint.
 */
export async function fetchLinkedInProfile(accountId: string) {
  const token = await getLinkedInAccessToken(accountId);
  if (!token) return null;

  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}
