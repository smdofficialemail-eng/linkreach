"use server";

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export async function addBlacklistEntry(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const identifier = formData.get("identifier") as string;
  const reason = (formData.get("reason") as string) || "manual";
  const notes = (formData.get("notes") as string) || null;

  if (!identifier) return;

  // Check if it's a LinkedIn URL
  const isUrl = identifier.includes("linkedin.com");

  // Check if a matching profile exists
  let profileId: string | undefined;
  if (isUrl) {
    const profile = await prisma.linkedInProfile.findFirst({
      where: {
        workspaceId: workspace.id,
        OR: [
          { profileUrl: identifier },
          { linkedinId: identifier.split("/in/")[1]?.split("?")[0] },
        ],
      },
    });
    if (profile) profileId = profile.id;
  }

  // Check for duplicate
  if (profileId) {
    const existing = await prisma.blacklistEntry.findUnique({
      where: { linkedinProfileId: profileId },
    });
    if (existing) return;
  }

  await prisma.blacklistEntry.create({
    data: {
      workspaceId: workspace.id,
      linkedinProfileId: profileId ?? null,
      profileUrl: isUrl ? identifier : null,
      name: isUrl ? null : identifier,
      reason,
      notes,
    },
  });
}

export async function removeBlacklistEntry(id: string) {
  const { workspace } = await requireWorkspace();

  await prisma.blacklistEntry.deleteMany({
    where: { id, workspaceId: workspace.id },
  });
}
