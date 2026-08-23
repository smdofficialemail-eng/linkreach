"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { resolveTemplate } from "@/lib/extension";
import { getLinkedInProvider } from "@/lib/linkedin-provider";

/**
 * Process all queued extension jobs — simulates the worker picking up jobs
 * and executing them through the LinkedIn provider (mock or real).
 */
export async function processJobs() {
  const { workspace } = await requireWorkspace();

  const queuedJobs = await prisma.extensionJob.findMany({
    where: { workspaceId: workspace.id, status: "queued" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  if (queuedJobs.length === 0) return { processed: 0 };

  const provider = getLinkedInProvider();
  let processed = 0;

  for (const job of queuedJobs) {
    await prisma.extensionJob.update({
      where: { id: job.id },
      data: { status: "in_progress", claimedAt: new Date() },
    });

    try {
      const lead = await prisma.lead.findUnique({ where: { id: job.leadId } });
      if (!lead) throw new Error("Lead not found");

      const payload = (job.payload as Record<string, unknown>) || {};
      const template = String(payload.template || payload.note || "");
      const profileUrl = lead.linkedinUrl || "";

      let result: unknown;

      switch (job.action) {
        case "connect": {
          const note = resolveTemplate(template, lead);
          result = await provider.sendConnectionRequest(profileUrl, note);
          if (job.memberId) {
            await prisma.campaignMember.update({
              where: { id: job.memberId },
              data: { status: "sent", sentAt: new Date() },
            });
          }
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "connection_pending" },
          });
          break;
        }
        case "message":
        case "follow_up": {
          const body = resolveTemplate(template, lead);
          result = await provider.sendMessage(profileUrl, body);
          if (job.memberId) {
            await prisma.campaignMember.update({
              where: { id: job.memberId },
              data: { status: "sent", sentAt: new Date() },
            });
          }
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "messaged" },
          });
          break;
        }
        default: {
          result = { ok: true, action: job.action };
        }
      }

      await prisma.extensionJob.update({
        where: { id: job.id },
        data: { status: "done" },
      });

      await prisma.activityLog.create({
        data: {
          workspaceId: workspace.id,
          campaignId: job.campaignId,
          leadId: job.leadId,
          type: job.action === "connect" ? "sent" : "note",
          message: `${job.action === "connect" ? "Connection request sent to" : job.action === "message" || job.action === "follow_up" ? "Message sent to" : `Action "${job.action}" completed for`} ${lead.name}`,
        },
      });

      processed++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const jobData = await prisma.extensionJob.findUnique({ where: { id: job.id }, select: { attempts: true } });
      const newAttempts = (jobData?.attempts ?? 0) + 1;
      await prisma.extensionJob.update({
        where: { id: job.id },
        data: {
          status: newAttempts >= 3 ? "failed" : "queued",
          error: errMsg,
        },
      });
    }
  }

  revalidatePath("/app/automations");
  revalidatePath("/app");
  return { processed };
}

/**
 * Cancel a queued job.
 */
export async function cancelJob(jobId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.extensionJob.updateMany({
    where: { id: jobId, workspaceId: workspace.id, status: "queued" },
    data: { status: "cancelled" },
  });
  revalidatePath("/app/automations");
}

/**
 * Retry a failed job.
 */
export async function retryJob(jobId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.extensionJob.updateMany({
    where: { id: jobId, workspaceId: workspace.id, status: "failed" },
    data: { status: "queued", error: null, attempts: 0 },
  });
  revalidatePath("/app/automations");
}
