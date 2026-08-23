import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { AutomationsClient } from "./automations-client";

export default async function AutomationsPage() {
  const { workspace } = await requireWorkspace();

  // Get extension jobs
  const jobs = await prisma.extensionJob.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Enrich jobs with campaign names
  const campaignIds = [...new Set(jobs.map((j) => j.campaignId).filter(Boolean))] as string[];
  const campaigns = campaignIds.length
    ? await prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
    : [];
  const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const enrichedJobs = jobs.map((j) => ({ ...j, campaignName: j.campaignId ? campaignMap[j.campaignId] || "—" : null }));

  // Get scheduled actions
  const scheduled = await prisma.scheduledAction.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  // Enrich scheduled with lead + campaign names
  const leadIds = [...new Set(scheduled.map((s) => s.leadId))];
  const campIds = [...new Set(scheduled.map((s) => s.campaignId))];
  const [leads, camps] = await Promise.all([
    leadIds.length ? prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } }) : [],
    campIds.length ? prisma.campaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } }) : [],
  ]);
  const leadMap = Object.fromEntries(leads.map((l) => [l.id, l.name]));
  const campMap = Object.fromEntries(camps.map((c) => [c.id, c.name]));
  const enrichedScheduled = scheduled.map((s) => ({
    ...s,
    leadName: leadMap[s.leadId] || "—",
    campaignName: campMap[s.campaignId] || "—",
  }));

  // Stats
  const stats = await prisma.extensionJob.groupBy({
    by: ["status"],
    where: { workspaceId: workspace.id },
    _count: true,
  });

  const statMap = Object.fromEntries(stats.map((s) => [s.status, s._count]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Automations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitor your job queue, scheduled actions, and execution history.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-ink-800/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Queued</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-400">{statMap["queued"] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-ink-800/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">In Progress</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-400">{statMap["in_progress"] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-ink-800/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-400">{statMap["done"] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-ink-800/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Failed</p>
          <p className="mt-1 text-2xl font-extrabold text-red-400">{statMap["failed"] ?? 0}</p>
        </div>
      </div>

      <AutomationsClient jobs={enrichedJobs} scheduled={enrichedScheduled} />
    </div>
  );
}
