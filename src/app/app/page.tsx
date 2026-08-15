import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Dashboard — LinkReach" };

export default async function DashboardPage() {
  const { workspace } = await requireWorkspace();

  const [leadCount, accountCount, campaignCount, members, conversations, activity] =
    await Promise.all([
      prisma.lead.count({ where: { workspaceId: workspace.id } }),
      prisma.linkedinAccount.count({ where: { workspaceId: workspace.id } }),
      prisma.campaign.count({ where: { workspaceId: workspace.id } }),
      prisma.campaignMember.findMany({
        where: { campaign: { workspaceId: workspace.id } },
        select: { status: true },
      }),
      prisma.conversation.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { lead: { select: { name: true, company: true } } },
      }),
      prisma.activityLog.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  const sent = members.filter((m) => m.status !== "queued").length;
  const accepted = members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length;
  const replied = members.filter((m) => ["replied", "booked"].includes(m.status)).length;
  const booked = members.filter((m) => m.status === "booked").length;

  const stats = [
    { label: "Leads", value: leadCount, accent: "from-sky-500 to-sky-400", hint: "in your database" },
    { label: "Actions sent", value: sent, accent: "from-brand-500 to-brand-400", hint: "across campaigns" },
    { label: "Accepted", value: accepted, accent: "from-violet-500 to-violet-400", hint: `${Math.round((sent ? accepted / sent : 0) * 100)}% acceptance` },
    { label: "Replies", value: replied, accent: "from-emerald-500 to-emerald-400", hint: "conversations started" },
    { label: "Booked calls", value: booked, accent: "from-amber-500 to-amber-400", hint: "meetings scheduled" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Good to see you, {workspace.name} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Here&apos;s what&apos;s happening across your outreach.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link href="/app/leads" className="btn-secondary px-4 py-2">
            + Add leads
          </Link>
          <Link href="/app/campaigns/new" className="btn-primary px-4 py-2">
            + New campaign
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-5 shadow-card">
            <span className={`grid size-9 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-sm font-extrabold text-white`}>
              {s.value}
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">{s.value}</p>
            <p className="text-xs text-slate-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Campaigns */}
        <div className="card p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Campaigns
            </h2>
            <Link href="/app/campaigns" className="text-xs font-bold text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
          {campaignCount === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm font-semibold text-slate-400">No campaigns yet</p>
              <Link href="/app/campaigns/new" className="btn-primary mt-4 px-4 py-2 text-sm">
                Create your first campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {Array.from({ length: 1 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-ink-800/50 p-4">
                  <p className="text-sm font-bold text-slate-200">{campaignCount} campaign{campaignCount === 1 ? "" : "s"}</p>
                  <p className="text-xs text-slate-500">{accountCount} profile{accountCount === 1 ? "" : "s"} connected</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5 shadow-card lg:col-span-3">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing yet — launch a campaign to see activity here.</p>
          ) : (
            <ul className="space-y-1">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300">{a.message}</p>
                    <p className="text-xs text-slate-600">{timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-6 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Latest conversations
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-500">No conversations yet — replies will land in your Inbox.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/inbox?lead=${c.leadId}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-200">{c.lead.name}</p>
                      <p className="truncate text-xs text-slate-500">{c.lead.company ?? "—"}</p>
                    </div>
                    <span className="text-xs text-slate-600">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
