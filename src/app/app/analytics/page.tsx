import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Analytics — LinkReach" };

export default async function AnalyticsPage() {
  const { workspace } = await requireWorkspace();

  const [members, campaigns, leads, accounts, activity] = await Promise.all([
    prisma.campaignMember.findMany({
      where: { campaign: { workspaceId: workspace.id } },
      select: { status: true, createdAt: true, campaign: { select: { name: true } } },
    }),
    prisma.campaign.findMany({ where: { workspaceId: workspace.id } }),
    prisma.lead.count({ where: { workspaceId: workspace.id } }),
    prisma.linkedinAccount.count({ where: { workspaceId: workspace.id } }),
    prisma.activityLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const total = members.length;
  const sent = members.filter((m) => m.status !== "queued").length;
  const accepted = members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length;
  const replied = members.filter((m) => ["replied", "booked"].includes(m.status)).length;
  const booked = members.filter((m) => m.status === "booked").length;

  const pct = (n: number) => (sent ? Math.round((n / sent) * 100) : 0);

  const funnel = [
    { label: "Leads added", value: total, pct: 100 },
    { label: "First step sent", value: sent, pct: pct(sent) },
    { label: "Accepted", value: accepted, pct: pct(accepted) },
    { label: "Replied", value: replied, pct: pct(replied) },
    { label: "Booked calls", value: booked, pct: pct(booked) },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          {leads} leads · {accounts} profiles · {campaigns.length} campaigns
        </p>
      </div>

      {/* Funnel */}
      <div className="card p-6 shadow-card">
        <h2 className="mb-5 text-sm font-extrabold uppercase tracking-wider text-slate-400">
          Outreach funnel
        </h2>
        <div className="space-y-4">
          {funnel.map((f, i) => (
            <div key={f.label}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-300">
                  <span className="mr-2 text-xs font-extrabold text-slate-600">{i + 1}</span>
                  {f.label}
                </span>
                <span className="font-extrabold text-white">
                  {f.value} <span className="text-xs font-semibold text-slate-500">({f.pct}%)</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${["from-sky-500 to-sky-400", "from-brand-600 to-brand-400", "from-violet-500 to-violet-400", "from-emerald-500 to-emerald-400", "from-amber-500 to-amber-400"][i]}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Per campaign */}
        <div className="card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Campaign breakdown
          </h2>
          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">No campaigns yet.</p>
          ) : (
            <ul className="space-y-3">
              {campaigns.map((c) => {
                const m = members.filter((x) => x.campaign.name === c.name);
                const s = m.filter((x) => x.status !== "queued").length;
                const b = m.filter((x) => x.status === "booked").length;
                return (
                  <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-800/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-200">{c.name}</p>
                      <p className="text-xs capitalize text-slate-500">{c.status} · {c.kind}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-white">{s} sent</p>
                      <p className="text-xs text-slate-500">{b} booked</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Activity */}
        <div className="card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Activity timeline
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-300">{a.message}</p>
                    <p className="text-xs text-slate-600">{formatDate(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
