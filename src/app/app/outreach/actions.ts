"use server";

import { prisma } from "@/lib/db";
import { getLinkedInProvider } from "@/lib/linkedin-provider";

/**
 * Search LinkedIn profiles using the active provider (mock or real).
 */
export async function searchProfilesAction(
  query: string,
  workspaceId: string
): Promise<{
  profiles: Array<{
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
    company: string | null;
    jobTitle: string | null;
    location: string | null;
    profileUrl: string | null;
    avatarUrl: string | null;
    connectionDegree: number | null;
    isPremium: boolean;
    isOpenToWork: boolean;
    mutualConnections: number | null;
  }>;
  total: number;
  error?: string;
}> {
  if (!query || query.trim().length === 0) {
    return { profiles: [], total: 0, error: "Please enter a search query." };
  }

  // Try to get a LinkedIn account with an access token for real search
  let accessToken: string | undefined;
  try {
    const account = await prisma.linkedinAccount.findFirst({
      where: { workspaceId, accessToken: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (account?.id) {
      const { getLinkedInAccessToken } = await import("@/lib/linkedin");
      accessToken = (await getLinkedInAccessToken(account.id)) || undefined;
    }
  } catch (e) {
    console.error("[Outreach] Failed to get access token:", e);
  }

  // Try real search: headless browser > Voyager API > mock
  let result;
  let usedRealSearch = false;

  // 1. Try headless browser search (if credentials are saved)
  const accountWithCreds = await prisma.linkedinAccount.findFirst({
    where: { workspaceId, linkedinLogin: { not: null }, passwordEnc: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  if (accountWithCreds?.linkedinLogin && accountWithCreds?.passwordEnc) {
    try {
      const { decrypt } = await import("@/lib/crypto");
      const { loginLinkedIn } = await import("@/lib/linkedin-session");
      const password = decrypt(accountWithCreds.passwordEnc);
      
      console.log("[Outreach] Attempting headless browser search for:", query);
      const { context, page } = await loginLinkedIn(
        accountWithCreds.id,
        accountWithCreds.linkedinLogin,
        password
      );

      try {
        // Navigate to LinkedIn search
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(5000);

        // Check if we're on the search results page
        if (page.url().includes("/search/results")) {
          // Extract profiles from the page
          const profiles = await page.evaluate(() => {
            const items = document.querySelectorAll(".reusable-search__result-container .entity-result");
            const results: Array<Record<string, unknown>> = [];
            
            items.forEach((item) => {
              try {
                const nameEl = item.querySelector(".entity-result__title-text a span[aria-hidden]");
                const headlineEl = item.querySelector(".entity-result__primary-subtitle");
                const locationEl = item.querySelector(".entity-result__secondary-subtitle");
                const linkEl = item.querySelector(".entity-result__title-text a");
                const imgEl = item.querySelector("img.presence-entity__image, img.EntityPhoto-circle-5");
                
                const name = nameEl?.textContent?.trim() || "";
                const headline = headlineEl?.textContent?.trim() || "";
                const location = locationEl?.textContent?.trim() || "";
                const profileUrl = linkEl?.getAttribute("href") || "";
                const avatarUrl = imgEl?.getAttribute("src") || "";
                
                if (name) {
                  const nameParts = name.split(" ");
                  results.push({
                    id: profileUrl.replace(/.*\/in\//, "").replace(/\//, "") || name.toLowerCase().replace(/\s+/g, "-"),
                    firstName: nameParts[0] || "",
                    lastName: nameParts.slice(1).join(" ") || "",
                    fullName: name,
                    headline,
                    location,
                    profileUrl: profileUrl.startsWith("http") ? profileUrl : `https://www.linkedin.com${profileUrl}`,
                    avatarUrl,
                    company: headline.split(" at ")[1] || "",
                    jobTitle: headline.split(" at ")[0] || "",
                    isPremium: false,
                    isOpenToWork: false,
                    isCreator: false,
                    connectionDegree: 2,
                  });
                }
              } catch {}
            });
            return results;
          });

          if (profiles.length > 0) {
            result = {
              profiles: profiles.map((p: Record<string, unknown>) => ({
                id: String(p.id),
                publicId: String(p.id),
                firstName: String(p.firstName),
                lastName: String(p.lastName),
                fullName: String(p.fullName),
                headline: String(p.headline || ""),
                company: String(p.company || ""),
                jobTitle: String(p.jobTitle || ""),
                location: String(p.location || ""),
                profileUrl: String(p.profileUrl || ""),
                avatarUrl: String(p.avatarUrl || ""),
                connectionDegree: 2,
                isPremium: false,
                isOpenToWork: false,
                isCreator: false,
              })),
              total: profiles.length,
            };
            usedRealSearch = true;
            console.log("[Outreach] Headless browser search returned", profiles.length, "profiles");
          }
        }
      } finally {
        await context.close();
      }
    } catch (e) {
      console.error("[Outreach] Headless browser search failed:", e);
      // Fall through to other methods
    }
  }

  // 2. Try Voyager API (if OAuth token available)
  if (!usedRealSearch && accessToken) {
    try {
      const provider = getLinkedInProvider(accessToken);
      result = await provider.searchProfiles(query);
      usedRealSearch = true;
      console.log("[Outreach] Voyager API search returned", result.profiles.length, "profiles");
    } catch (e) {
      console.error("[Outreach] Voyager API search failed:", e);
    }
  }

  // 3. Fall back to mock if nothing worked
  if (!usedRealSearch) {
    try {
      const mockProvider = getLinkedInProvider();
      result = await mockProvider.searchProfiles(query);
      console.log("[Outreach] Mock provider returned", result.profiles.length, "profiles");
    } catch (e) {
      console.error("[Outreach] Mock provider also failed:", e);
      return { profiles: [], total: 0, error: "Search failed. Please try again." };
    }
  }

  if (!result) {
    return { profiles: [], total: 0, error: "Search failed. Please try again." };
  }

  console.log("[Outreach] searchProfiles returned:", result.profiles.length, "profiles");

  // Upsert discovered profiles into the database
  for (const p of result.profiles) {
    try {
      const raw = p as unknown as Record<string, unknown>;
      await prisma.linkedInProfile.upsert({
        where: {
          workspaceId_linkedinId: {
            workspaceId,
            linkedinId: p.id,
          },
        },
        update: {
          fullName: p.fullName,
          firstName: p.firstName ?? null,
          lastName: p.lastName ?? null,
          headline: p.headline ?? null,
          company: p.company ?? null,
          jobTitle: p.jobTitle ?? null,
          location: p.location ?? null,
          profileUrl: p.profileUrl ?? null,
          avatarUrl: p.avatarUrl ?? null,
          about: (raw.about as string) ?? null,
          connectionDegree: p.connectionDegree ?? null,
          isPremium: p.isPremium,
          isOpenToWork: p.isOpenToWork,
          mutualConnections: (raw.mutualConnections as number) ?? null,
          raw: JSON.parse(JSON.stringify(p)),
          cachedAt: new Date(),
        },
        create: {
          workspaceId,
          linkedinId: p.id,
          publicId: p.publicId ?? null,
          fullName: p.fullName,
          firstName: p.firstName ?? null,
          lastName: p.lastName ?? null,
          headline: p.headline ?? null,
          company: p.company ?? null,
          jobTitle: p.jobTitle ?? null,
          location: p.location ?? null,
          industry: (raw.industry as string) ?? null,
          profileUrl: p.profileUrl ?? null,
          avatarUrl: p.avatarUrl ?? null,
          about: (raw.about as string) ?? null,
          connectionDegree: p.connectionDegree ?? null,
          isPremium: p.isPremium,
          isOpenToWork: p.isOpenToWork,
          isCreator: p.isCreator,
          mutualConnections: (raw.mutualConnections as number) ?? null,
          raw: JSON.parse(JSON.stringify(p)),
          source: "search",
        },
      });
    } catch (err) {
      console.error("[Outreach] upsert failed for", p.fullName, err);
    }
  }

  // Log the search activity
  await prisma.activityLog.create({
    data: {
      workspaceId,
      type: "note",
      message: `Searched LinkedIn: "${query}" — ${result.total} profiles found`,
    },
  });

  return {
    profiles: result.profiles.map((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return {
        id: p.id,
        fullName: p.fullName,
        headline: p.headline ?? null,
        company: p.company ?? null,
        jobTitle: p.jobTitle ?? null,
        location: p.location ?? null,
        profileUrl: p.profileUrl ?? null,
        avatarUrl: p.avatarUrl ?? null,
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        connectionDegree: p.connectionDegree ?? null,
        isPremium: p.isPremium,
        isOpenToWork: p.isOpenToWork,
        mutualConnections: (raw.mutualConnections as number) ?? null,
      };
    }),
    total: result.total,
  };
}

/**
 * Select a profile for outreach.
 */
export async function selectProfileAction(
  workspaceId: string,
  profileId: string
): Promise<void> {
  await prisma.outreachSelection.upsert({
    where: {
      workspaceId_linkedinProfileId: {
        workspaceId,
        linkedinProfileId: profileId,
      },
    },
    update: {},
    create: {
      workspaceId,
      linkedinProfileId: profileId,
    },
  });
}

/**
 * Deselect a profile.
 */
export async function deselectProfileAction(
  workspaceId: string,
  profileId: string
): Promise<void> {
  await prisma.outreachSelection.deleteMany({
    where: {
      workspaceId,
      linkedinProfileId: profileId,
    },
  });
}

/**
 * Bulk select profiles.
 */
export async function bulkSelectAction(
  workspaceId: string,
  profileIds: string[]
): Promise<void> {
  for (const id of profileIds) {
    await prisma.outreachSelection.upsert({
      where: {
        workspaceId_linkedinProfileId: {
          workspaceId,
          linkedinProfileId: id,
        },
      },
      update: {},
      create: {
        workspaceId,
        linkedinProfileId: id,
      },
    });
  }
}

/**
 * Add selected profiles to a campaign as targets.
 */
export async function addProfilesToCampaignAction(
  workspaceId: string,
  campaignId: string,
  profileIds: string[],
  connectionNote?: string
): Promise<{ added: number; duplicates: number }> {
  let added = 0;
  let duplicates = 0;

  for (const profileId of profileIds) {
    // Find or create lead from profile
    const profile = await prisma.linkedInProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) continue;

    // Find existing lead or create new one
    let lead = await prisma.lead.findFirst({
      where: {
        workspaceId,
        linkedinProfileId: profileId,
      },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          workspaceId,
          linkedinProfileId: profileId,
          name: profile.fullName,
          headline: profile.headline,
          company: profile.company,
          jobTitle: profile.jobTitle,
          linkedinUrl: profile.profileUrl,
          location: profile.location,
          about: profile.about,
          industry: profile.industry,
          avatarUrl: profile.avatarUrl,
          source: "outreach",
          status: "new",
        },
      });
    }

    // Check if already in campaign
    const existing = await prisma.campaignMember.findUnique({
      where: {
        campaignId_leadId: {
          campaignId,
          leadId: lead.id,
        },
      },
    });

    if (existing) {
      duplicates++;
      continue;
    }

    // Add to campaign
    await prisma.campaignMember.create({
      data: {
        campaignId,
        leadId: lead.id,
        status: "queued",
      },
    });

    added++;
  }

  // Log the activity
  await prisma.activityLog.create({
    data: {
      workspaceId,
      campaignId,
      type: "note",
      message: `Added ${added} lead${added !== 1 ? "s" : ""} to campaign${
        duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""
      }`,
    },
  });

  return { added, duplicates };
}

/**
 * Get detailed profile preview using the provider.
 */
export async function getProfilePreviewAction(
  profileUrl: string
): Promise<Record<string, unknown> | null> {
  if (!profileUrl) return null;
  const provider = getLinkedInProvider();
  const profile = await provider.getProfile(profileUrl);
  return profile as Record<string, unknown> | null;
}
