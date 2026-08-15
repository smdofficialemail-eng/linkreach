import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export const metadata = { title: "Campaigns — LinkReach" };

export const CAMPAIGN_STATUS: Record<string, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-slate-500/15 text-slate-300" },
  running: { label: "Running", classes: "bg-emerald-500/15 text-emerald-300" },
  paused: { label: "Paused", classes: "bg-amber-500/15 text-amber-300" },
  finished: { label: "Finished", classes: "bg-sky-500/15 text-sky-300" },
};

export default async function CampaignsPage() {
  const { workspace } = await requireWorkspace();

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: {
      account: { select: { name: true } },
      _count: { select: { members: true, steps: true } },
      members: {
        select: { status: true },
      },
    },
  });

  const totals = campaigns.map((c) => ({
    ...c,
    funnel: {
      sent: c.members.filter((m) => m.status !== "queued").length,
      accepted: c.members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length,
      replied: c.members.filter((m) => ["replied", "booked"].includes(m.status)).length,
    },
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">
            Automate connections, messages and follow-ups across your profiles.
          </p>
        </div>
        <Link href="/app/campaigns/new" className="btn-primary px-4 py-2">
          + New campaign
        </Link>
      </div>

      {totals.length === 0 ? (
        <div className="card p-16 text-center shadow-card">
          <p className="font-extrabold text-slate-300">No campaigns yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Build a sequence of connection requests and follow-ups, then launch it.
          </p>
          <Link href="/app/campaigns/new" className="btn-primary mt-5 px-4 py-2">
            + New campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {totals.map((c) => {
            const meta = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.draft;
            return (
              <Link
                key={c.id}
                href={`/app/campaigns/${c.id}`}
                className="card group p-5 shadow-card transition hover:border-brand-500/40 hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-white group-hover:text-brand-300">{c.name}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-500">
                      {c.type} · {c.kind}
                      {c.account ? ` · ${c.account.name}` : ""}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${meta.classes}`}>{meta.label}</span>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    ["Leads", c._count.members],
                    ["Sent", c.funnel.sent],
                    ["Accepted", c.funnel.accepted],
                    ["Replies", c.funnel.replied],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-800/60 px-2 py-2 text-center">
                      <p className="text-lg font-extrabold text-white">{value}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
