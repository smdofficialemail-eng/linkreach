import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Dashboard — LinkReach" };

export default async function DashboardPage() {
  const { workspace } = await requireWorkspace();

  const [leadCount, accountCount, campaigns, members, conversations, activity, templates] =
    await Promise.all([
      prisma.lead.count({ where: { workspaceId: workspace.id } }),
      prisma.linkedinAccount.count({ where: { workspaceId: workspace.id } }),
      prisma.campaign.findMany({
        where: { workspaceId: workspace.id },
        include: {
          account: { select: { name: true } },
          members: { select: { status: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.campaignMember.findMany({
        where: { campaign: { workspaceId: workspace.id } },
        select: { status: true, createdAt: true },
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
        take: 10,
      }),
      prisma.template.count({ where: { workspaceId: workspace.id } }),
    ]);

  const sent = members.filter((m) => m.status !== "queued").length;
  const accepted = members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length;
  const replied = members.filter((m) => ["replied", "booked"].includes(m.status)).length;
  const booked = members.filter((m) => m.status === "booked").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "running").length;
  const acceptanceRate = sent ? Math.round((accepted / sent) * 100) : 0;
  const replyRate = sent ? Math.round((replied / sent) * 100) : 0;

  // Activity chart data (last 7 days)
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const activityByDay: Record<string, { connections: number; accepted: number; messages: number; replies: number }> = {};
  for (const day of days) {
    activityByDay[day] = { connections: 0, accepted: 0, messages: 0, replies: 0 };
  }
  for (const m of members) {
    const day = m.createdAt.toISOString().split("T")[0];
    if (activityByDay[day]) {
      if (m.status !== "queued") activityByDay[day].connections++;
      if (["accepted", "replied", "booked"].includes(m.status)) activityByDay[day].accepted++;
      if (["replied", "booked"].includes(m.status)) activityByDay[day].replies++;
    }
  }

  const kpis = [
    { label: "LinkedIn Accounts", value: accountCount, icon: "◉", accent: "from-sky-500 to-sky-400" },
    { label: "Active Campaigns", value: activeCampaigns, icon: "🚀", accent: "from-emerald-500 to-emerald-400" },
    { label: "Leads Found", value: leadCount, icon: "👤", accent: "from-violet-500 to-violet-400" },
    { label: "Connection Requests", value: sent, icon: "🤝", accent: "from-brand-500 to-brand-400" },
    { label: "Connections Accepted", value: accepted, icon: "✅", accent: "from-green-500 to-green-400" },
    { label: "Acceptance Rate", value: `${acceptanceRate}%`, icon: "📈", accent: "from-amber-500 to-amber-400" },
    { label: "Messages Sent", value: replied + sent - accepted, icon: "💬", accent: "from-pink-500 to-pink-400" },
    { label: "Replies", value: replied, icon: "📬", accent: "from-cyan-500 to-cyan-400" },
    { label: "Reply Rate", value: `${replyRate}%`, icon: "📊", accent: "from-indigo-500 to-indigo-400" },
    { label: "Meetings / Conversions", value: booked, icon: "📅", accent: "from-rose-500 to-rose-400" },
  ];

  return (
    <div>
      {/* Header */}
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
          <Link href="/app/outreach" className="btn-secondary px-4 py-2">
            🔍 Outreach
          </Link>
          <Link href="/app/campaigns/new" className="btn-primary px-4 py-2">
            + New campaign
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className={`grid size-8 place-items-center rounded-lg bg-gradient-to-br ${kpi.accent} text-sm`}>
                {kpi.icon}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
            </div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Activity Chart */}
      <div className="mt-6 card p-5 shadow-card">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">
          Outreach Activity (7 Days)
        </h2>
        <div className="flex items-end gap-2 h-40">
          {days.map((day) => {
            const data = activityByDay[day];
            const maxVal = Math.max(1, ...days.map((d) => activityByDay[d].connections));
            const date = new Date(day + "T12:00:00");
            const label = date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-0.5" style={{ height: `${Math.max(8, (data.connections / maxVal) * 120)}px` }}>
                  <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${data.connections > 0 ? 60 : 0}%` }} />
                  <div className="w-full rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${data.accepted > 0 ? 40 : 0}%` }} />
                  <div className="w-full rounded-t bg-gradient-to-t from-violet-600 to-violet-400" style={{ height: `${data.replies > 0 ? 30 : 0}%` }} />
                </div>
                <p className="text-[9px] text-slate-600 text-center leading-tight">{label}</p>
                <p className="text-[10px] font-bold text-slate-400">{data.connections}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand-500" /> Sent</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Accepted</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-violet-500" /> Replied</span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Campaign Performance */}
        <div className="card p-5 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Campaign Performance
            </h2>
            <Link href="/app/campaigns" className="text-xs font-bold text-brand-400 hover:text-brand-300">
              View all →
            </Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="font-extrabold text-slate-400">No campaigns yet</p>
              <Link href="/app/campaigns/new" className="btn-primary mt-4 inline-block px-4 py-2 text-sm">
                Create your first campaign
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    <th className="pb-2 pr-3">Campaign</th>
                    <th className="pb-2 px-2 text-center">Targets</th>
                    <th className="pb-2 px-2 text-center">Sent</th>
                    <th className="pb-2 px-2 text-center">Accepted</th>
                    <th className="pb-2 px-2 text-center">Accept %</th>
                    <th className="pb-2 px-2 text-center">Replies</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaigns.slice(0, 5).map((c) => {
                    const total = c.members.length;
                    const cSent = c.members.filter((m) => m.status !== "queued").length;
                    const cAccepted = c.members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length;
                    const cReplied = c.members.filter((m) => ["replied", "booked"].includes(m.status)).length;
                    const cRate = cSent ? Math.round((cAccepted / cSent) * 100) : 0;
                    const statusColors: Record<string, string> = {
                      draft: "bg-slate-500/15 text-slate-300",
                      running: "bg-emerald-500/15 text-emerald-300",
                      paused: "bg-amber-500/15 text-amber-300",
                      finished: "bg-sky-500/15 text-sky-300",
                    };
                    return (
                      <tr key={c.id} className="transition hover:bg-white/3">
                        <td className="py-2.5 pr-3">
                          <Link href={`/app/campaigns/${c.id}`} className="font-bold text-slate-200 hover:text-brand-300">
                            {c.name}
                          </Link>
                          <p className="text-[10px] text-slate-600">{c.account?.name ?? "No account"}</p>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-300">{total}</td>
                        <td className="py-2.5 px-2 text-center text-slate-300">{cSent}</td>
                        <td className="py-2.5 px-2 text-center text-slate-300">{cAccepted}</td>
                        <td className="py-2.5 px-2 text-center text-slate-300">{cRate}%</td>
                        <td className="py-2.5 px-2 text-center text-slate-300">{cReplied}</td>
                        <td className="py-2.5 text-right">
                          <span className={`chip ${statusColors[c.status] ?? statusColors.draft}`}>{c.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card p-5 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Recent Activity
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
                    <p className="text-[11px] text-slate-600">{timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 mt-5 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Latest Conversations
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-500">No conversations yet.</p>
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
