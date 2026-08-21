import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWorkspaceToken } from "@/lib/extension";

/**
 * GET /api/extension/jobs?limit=5
 * Bearer: <workspace token>
 * Returns queued jobs with the lead info + resolved payload the extension
 * needs to act on LinkedIn (open profile, click Connect, send message).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const workspaceId = verifyWorkspaceToken(token);
  if (!workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "5") || 5, 20);

  const jobs = await prisma.extensionJob.findMany({
    where: { workspaceId, status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      workspace: { select: { id: true } },
    },
  });

  // Claim the jobs so a second poll doesn't get the same batch.
  if (jobs.length) {
    await prisma.extensionJob.updateMany({
      where: { id: { in: jobs.map((j) => j.id) } },
      data: { status: "in_progress", claimedAt: new Date() },
    });
  }

  const leadIds = [...new Set(jobs.map((j) => j.leadId))];
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: {
      id: true,
      name: true,
      headline: true,
      company: true,
      location: true,
      linkedinUrl: true,
      email: true,
      phone: true,
    },
  });
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  return NextResponse.json({
    ok: true,
    jobs: jobs.map((j) => ({
      id: j.id,
      action: j.action,
      lead: leadMap.get(j.leadId) ?? null,
      payload: (j.payload as Record<string, unknown>) ?? {},
    })),
  });
}
