"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { resolveTemplate } from "@/lib/extension";

const stepSchema = z.object({
  action: z.enum(["connect", "message", "follow_up", "reaction"]),
  daysAfter: z.coerce.number().int().min(0).default(0),
  template: z.string().nullish(),
  variables: z.record(z.string(), z.any()).default({}),
});

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  type: z.enum(["outbound", "inbound"]),
  kind: z.enum(["connections", "messages", "reactions"]),
  linkedinAccountId: z.string().nullish(),
  dailyLimit: z.coerce.number().int().min(1).max(200).default(30),
  minDelayMin: z.coerce.number().int().min(1).max(60).default(4),
  maxDelayMin: z.coerce.number().int().min(1).max(60).default(9),
  smartTimezone: z.coerce.boolean().default(true),
  autoTranslate: z.coerce.boolean().default(false),
  aiPersonalization: z.coerce.boolean().default(true),
  steps: z.array(stepSchema).min(1, "Add at least one step"),
});

export async function createCampaign(prev: unknown, formData: FormData) {
  const { workspace } = await requireWorkspace();

  let stepsJson: unknown = [];
  try {
    stepsJson = JSON.parse(String(formData.get("steps") ?? "[]"));
  } catch {
    stepsJson = [];
  }

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    kind: formData.get("kind"),
    linkedinAccountId: formData.get("linkedinAccountId") || null,
    dailyLimit: formData.get("dailyLimit"),
    minDelayMin: formData.get("minDelayMin"),
    maxDelayMin: formData.get("maxDelayMin"),
    smartTimezone: formData.get("smartTimezone") === "on",
    autoTranslate: formData.get("autoTranslate") === "on",
    aiPersonalization: formData.get("aiPersonalization") === "on",
    steps: stepsJson,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const accountId = parsed.data.linkedinAccountId ?? null;
  if (accountId) {
    const account = await prisma.linkedinAccount.findFirst({
      where: { id: accountId, workspaceId: workspace.id },
    });
    if (!account) return { error: "LinkedIn account not found" };
  }

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      type: parsed.data.type,
      kind: parsed.data.kind,
      linkedinAccountId: accountId,
      dailyLimit: parsed.data.dailyLimit,
      minDelayMin: parsed.data.minDelayMin,
      maxDelayMin: parsed.data.maxDelayMin,
      smartTimezone: parsed.data.smartTimezone,
      autoTranslate: parsed.data.autoTranslate,
      aiPersonalization: parsed.data.aiPersonalization,
      steps: {
        create: parsed.data.steps.map((s, i) => ({
          position: i,
          action: s.action,
          daysAfter: s.daysAfter,
          template: s.template || null,
          variables: s.variables as object,
        })),
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      type: "note",
      message: `Campaign "${campaign.name}" created`,
    },
  });

  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${campaign.id}`);
}

export async function addLeadsToCampaign(prev: unknown, formData: FormData) {
  const { workspace } = await requireWorkspace();
  const campaignId = String(formData.get("campaignId") ?? "");
  const leadIds = String(formData.get("leadIds") ?? "").split(",").filter(Boolean);

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
  });
  if (!campaign) return { error: "Campaign not found" };

  const existing = await prisma.campaignMember.findMany({
    where: { campaignId, leadId: { in: leadIds } },
    select: { leadId: true },
  });
  const existingIds = new Set(existing.map((e) => e.leadId));

  const toAdd = leadIds.filter((id) => !existingIds.has(id));
  if (toAdd.length) {
    await prisma.campaignMember.createMany({
      data: toAdd.map((leadId) => ({ campaignId, leadId, status: "queued" })),
      skipDuplicates: true,
    });
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        campaignId,
        type: "imported",
        message: `Added ${toAdd.length} lead${toAdd.length === 1 ? "" : "s"} to ${campaign.name}`,
      },
    });
  }

  revalidatePath(`/app/campaigns/${campaignId}`);
  return { ok: true, added: toAdd.length };
}

export async function startCampaign(campaignId: string) {
  const { workspace } = await requireWorkspace();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    include: { members: true, steps: { orderBy: { position: "asc" } } },
  });
  if (!campaign) return;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "running" },
  });

  if (workspace.deliveryMode === "extension" || workspace.deliveryMode === "server") {
    // Extension/Server mode: queue a job for the first step of every queued member.
    // The browser extension or the worker service polls and executes on LinkedIn.
    const firstStep = campaign.steps[0];
    if (firstStep) {
      const queued = campaign.members.filter((m) => m.status === "queued");
      const leads = await prisma.lead.findMany({
        where: { id: { in: queued.map((m) => m.leadId) } },
      });
      const leadMap = new Map(leads.map((l) => [l.id, l]));
      const jobs = queued.map((m) => {
        const lead = leadMap.get(m.leadId);
        const template = resolveTemplate(firstStep.template, lead ?? {});
        return {
          workspaceId: workspace.id,
          campaignId,
          memberId: m.id,
          leadId: m.leadId,
          action: firstStep.action,
          payload: { template, note: template },
        };
      });
      await prisma.extensionJob.createMany({ data: jobs });
    }
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        campaignId,
        type: "note",
        message: `Campaign "${campaign.name}" launched — ${campaign.members.length} job${campaign.members.length === 1 ? "" : "s"} queued for your browser extension`,
      },
    });
  } else {
    // Simulation: launching the campaign sends the first step to every queued member.
    const now = new Date();
    await prisma.campaignMember.updateMany({
      where: { campaignId, status: "queued" },
      data: { status: "sent", sentAt: now, nextRunAt: new Date(now.getTime() + 24 * 3600 * 1000) },
    });
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        campaignId,
        type: "sent",
        message: `Campaign "${campaign.name}" launched — first step sent to ${campaign.members.length} leads`,
      },
    });
  }

  revalidatePath(`/app/campaigns/${campaignId}`);
}

export async function pauseCampaign(campaignId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.campaign.updateMany({
    where: { id: campaignId, workspaceId: workspace.id },
    data: { status: "paused" },
  });
  revalidatePath(`/app/campaigns/${campaignId}`);
}

export async function deleteCampaign(campaignId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.campaign.deleteMany({
    where: { id: campaignId, workspaceId: workspace.id },
  });
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}

/**
 * Simulation helper: advance a single campaign member through the funnel.
 * sent -> accepted -> replied -> booked. Creating real inbox conversations/messages.
 */
export async function simulateAdvance(campaignId: string, memberId: string) {
  const { workspace } = await requireWorkspace();
  const member = await prisma.campaignMember.findFirst({
    where: { id: memberId, campaignId, campaign: { workspaceId: workspace.id } },
    include: { lead: true },
  });
  if (!member) return;

  const now = new Date();
  const transitions: Record<string, { next: string; type: string; message: string }> = {
    sent: {
      next: "accepted",
      type: "accepted",
      message: `${member.lead.name} accepted your connection request`,
    },
    accepted: {
      next: "replied",
      type: "replied",
      message: `${member.lead.name} replied to your message`,
    },
    replied: {
      next: "booked",
      type: "booked",
      message: `Call booked with ${member.lead.name}`,
    },
  };
  const t = transitions[member.status];
  if (!t) return;

  await prisma.campaignMember.update({
    where: { id: memberId },
    data:
      t.next === "accepted"
        ? { status: t.next, acceptedAt: now }
        : t.next === "replied"
          ? { status: t.next, repliedAt: now }
          : { status: t.next, bookedAt: now },
  });

  // Conversations begin on acceptance; replies add inbound messages.
  if (t.next === "accepted") {
    await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        linkedinAccountId: member.campaignId ? (await prisma.campaign.findUnique({ where: { id: campaignId } }))?.linkedinAccountId : null,
        leadId: member.leadId,
        lastMessageAt: now,
        messages: {
          create: [
            { direction: "in", body: `Hi there — thanks for reaching out! Happy to connect.`, status: "sent", sentAt: now },
          ],
        },
      },
    });
  } else if (t.next === "replied") {
    const conv = await prisma.conversation.findFirst({ where: { leadId: member.leadId, workspaceId: workspace.id } });
    if (conv) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "in",
          body: `Interesting — how does your solution work exactly? Would love to learn more.`,
          status: "sent",
          sentAt: now,
        },
      });
      await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } });
    }
  }

  await prisma.activityLog.create({
    data: { workspaceId: workspace.id, campaignId, type: t.type, message: t.message },
  });

  revalidatePath(`/app/campaigns/${campaignId}`);
  revalidatePath("/app");
}
