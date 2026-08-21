import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWorkspaceToken } from "@/lib/extension";

/**
 * POST /api/extension/jobs/:id
 * Bearer: <workspace token>
 * Body: { status: "done" | "failed", note?: string, response?: string }
 * Reports the outcome of a job. On success the campaign member advances
 * (connect -> sent -> accepted flow) and the inbox gets the message.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const workspaceId = verifyWorkspaceToken(token);
  if (!workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { status?: string; note?: string; response?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await params;
  const job = await prisma.extensionJob.findFirst({
    where: { id, workspaceId },
    include: {
      workspace: { select: { id: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const status = body.status === "done" ? "done" : "failed";
  const now = new Date();

  await prisma.extensionJob.update({
    where: { id: job.id },
    data: { status, error: status === "failed" ? String(body.note ?? body.response ?? "Failed").slice(0, 500) : null },
  });

  if (status === "done") {
    // Advance the campaign member through the funnel.
    if (job.memberId) {
      const member = await prisma.campaignMember.findUnique({
        where: { id: job.memberId },
        include: { campaign: true, lead: true },
      });
      if (member) {
        const data: Record<string, unknown> = {};
        if (member.status === "queued") {
          data.status = "sent";
          data.sentAt = now;
          data.nextRunAt = new Date(now.getTime() + 24 * 3600 * 1000);
        } else if (member.status === "sent") {
          data.status = "accepted";
          data.acceptedAt = now;
        } else if (member.status === "accepted") {
          data.status = "replied";
          data.repliedAt = now;
        }
        if (Object.keys(data).length) {
          await prisma.campaignMember.update({ where: { id: member.id }, data });
        }

        // Inbox: create/update the conversation thread.
        let conv = await prisma.conversation.findFirst({
          where: { workspaceId, leadId: member.leadId },
        });
        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              workspaceId,
              linkedinAccountId: member.campaign?.linkedinAccountId ?? null,
              leadId: member.leadId,
              lastMessageAt: now,
            },
          });
        }
        const payload = (job.payload as Record<string, unknown>) ?? {};
        const outbound = String(payload.template ?? payload.note ?? "").slice(0, 4000);
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "out",
            body: outbound || `Connection request sent to ${member.lead.name}`,
            status: "sent",
            sentAt: now,
          },
        });
        await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } });

        await prisma.activityLog.create({
          data: {
            workspaceId,
            campaignId: job.campaignId ?? member.campaignId,
            type: "sent",
            message: `${member.lead.name} — ${job.action} executed via browser extension`,
          },
        });
      }
    }
  } else {
    // Failed job: mark the member so the campaign doesn't stall silently.
    if (job.memberId) {
      await prisma.campaignMember.updateMany({
        where: { id: job.memberId, status: "queued" },
        data: { status: "skipped" },
      });
    }
    await prisma.activityLog.create({
      data: {
        workspaceId,
        campaignId: job.campaignId,
        type: "note",
        message: `Job ${job.action} failed: ${String(body.note ?? body.response ?? "unknown error").slice(0, 200)}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
