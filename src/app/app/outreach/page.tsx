import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { OutreachClient } from "./outreach-client";

export const metadata = { title: "Outreach — LinkReach" };

export default async function OutreachPage() {
  const { workspace } = await requireWorkspace();

  const [profiles, selections, campaigns, accounts, blacklistEntries] =
    await Promise.all([
      prisma.linkedInProfile.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.outreachSelection.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { selectedAt: "desc" },
      }),
      prisma.campaign.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.linkedinAccount.findMany({
        where: { workspaceId: workspace.id, status: "active" },
      }),
      prisma.blacklistEntry.findMany({
        where: { workspaceId: workspace.id },
      }),
    ]);

  return (
    <OutreachClient
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialProfiles={profiles}
      initialSelections={selections.map((s: { linkedinProfileId: string }) => s.linkedinProfileId)}
      campaigns={campaigns.map((c: { id: string; name: string; status: string }) => ({
        id: c.id,
        name: c.name,
        status: c.status,
      }))}
      accounts={accounts.map((a: { id: string; name: string }) => ({
        id: a.id,
        name: a.name,
      }))}
      blacklistedIds={blacklistEntries
        .filter((b: { linkedinProfileId: string | null }) => b.linkedinProfileId)
        .map((b: { linkedinProfileId: string | null }) => b.linkedinProfileId!)}
      deliveryMode={workspace.deliveryMode}
    />
  );
}
