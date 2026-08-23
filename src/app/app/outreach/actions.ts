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

  // Try real search first, fall back to mock if it fails
  let provider;
  let usedMock = false;
  try {
    provider = getLinkedInProvider(accessToken);
  } catch (e) {
    console.error("[Outreach] Failed to create provider:", e);
    // Fall back to mock
    provider = getLinkedInProvider();
    usedMock = true;
  }

  let result;
  try {
    result = await provider.searchProfiles(query);
  } catch (e) {
    console.error("[Outreach] Real search failed:", e);
    if (!usedMock && accessToken) {
      // Token expired or invalid — fall back to mock provider
      console.log("[Outreach] Falling back to mock provider");
      try {
        const mockProvider = getLinkedInProvider();
        result = await mockProvider.searchProfiles(query);
        usedMock = true;
      } catch (e2) {
        console.error("[Outreach] Mock fallback also failed:", e2);
        return { profiles: [], total: 0, error: `Search failed: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    } else {
      return { profiles: [], total: 0, error: `Search failed: ${e instanceof Error ? e.message : "Unknown error"}` };
    }
  }

  console.log("[Outreach] searchProfiles returned:", result.profiles.length, "profiles");

  // Upsert discovered profiles into the database
  for (const p of result.profiles) {
    try {
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
        about: p.about ?? null,
        connectionDegree: p.connectionDegree ?? null,
        isPremium: p.isPremium,
        isOpenToWork: p.isOpenToWork,
        mutualConnections: p.mutualConnections ?? null,
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
        industry: p.industry ?? null,
        profileUrl: p.profileUrl ?? null,
        avatarUrl: p.avatarUrl ?? null,
        about: p.about ?? null,
        connectionDegree: p.connectionDegree ?? null,
        isPremium: p.isPremium,
        isOpenToWork: p.isOpenToWork,
        isCreator: p.isCreator,
        mutualConnections: p.mutualConnections ?? null,
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
    profiles: result.profiles.map((p) => ({
      ...p,
      headline: p.headline ?? null,
      company: p.company ?? null,
      jobTitle: p.jobTitle ?? null,
      location: p.location ?? null,
      profileUrl: p.profileUrl ?? null,
      avatarUrl: p.avatarUrl ?? null,
      firstName: p.firstName ?? null,
      lastName: p.lastName ?? null,
      connectionDegree: p.connectionDegree ?? null,
      mutualConnections: p.mutualConnections ?? null,
    })),
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
