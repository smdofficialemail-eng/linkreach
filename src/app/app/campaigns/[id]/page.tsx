import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { formatDateTime } from "@/lib/format";
import { CAMPAIGN_STATUS } from "../page";
import { startCampaign, pauseCampaign, deleteCampaign, simulateAdvance } from "../actions";
import { AddLeads } from "./add-leads";

const STEP_ICONS: Record<string, string> = {
  connect: "＋ Connection request",
  message: "✉ Message",
  follow_up: "⇄ Follow-up",
  reaction: "♡ Reaction",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      account: true,
      steps: { orderBy: { position: "asc" } },
      members: {
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { id: true, name: true, company: true, headline: true } } },
      },
    },
  });
  if (!campaign) notFound();

  const meta = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  const funnel = {
    total: campaign.members.length,
    sent: campaign.members.filter((m) => m.status !== "queued").length,
    accepted: campaign.members.filter((m) => ["accepted", "replied", "booked"].includes(m.status)).length,
    replied: campaign.members.filter((m) => ["replied", "booked"].includes(m.status)).length,
    booked: campaign.members.filter((m) => m.status === "booked").length,
  };

  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, company: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/campaigns" className="text-sm font-bold text-brand-400 hover:text-brand-300">
            ← Back to campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">{campaign.name}</h1>
          <p className="mt-1 text-sm capitalize text-slate-400">
            {campaign.type} · {campaign.kind}
            {campaign.account ? ` · ${campaign.account.name}` : ""} · limit {campaign.dailyLimit}/day
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`chip ${meta.classes}`}>{meta.label}</span>
          {campaign.status === "draft" && (
            <form action={startCampaign.bind(null, campaign.id)}>
              <button type="submit" className="btn-primary px-4 py-2">
                ▶ Start campaign
              </button>
            </form>
          )}
          {campaign.status === "running" && (
            <form action={pauseCampaign.bind(null, campaign.id)}>
              <button type="submit" className="btn-secondary px-4 py-2">
                ⏸ Pause
              </button>
            </form>
          )}
          <AddLeads campaignId={campaign.id} leads={leads} />
          <form action={deleteCampaign.bind(null, campaign.id)}>
            <button type="submit" className="btn-ghost px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300">
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Funnel */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["Leads", funnel.total],
          ["Sent", funnel.sent],
          ["Accepted", funnel.accepted],
          ["Replied", funnel.replied],
          ["Booked", funnel.booked],
        ].map(([label, value]) => (
          <div key={label} className="card p-4 text-center shadow-card">
            <p className="text-2xl font-extrabold text-white">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Steps */}
        <div className="card p-5 shadow-card lg:col-span-1">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">Sequence</h2>
          <ol className="space-y-2.5">
            {campaign.steps.map((step, i) => (
              <li key={step.id} className="relative rounded-xl border border-white/8 bg-ink-800/50 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600/25 text-[11px] font-extrabold text-brand-300">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-200">{STEP_ICONS[step.action] ?? step.action}</span>
                  <span className="ml-auto text-xs text-slate-500">+{step.daysAfter}d</span>
                </div>
                {step.template && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{step.template}</p>
                )}
              </li>
            ))}
            {campaign.steps.length === 0 && (
              <li className="text-sm text-slate-500">No steps yet.</li>
            )}
          </ol>
        </div>

        {/* Members */}
        <div className="card overflow-hidden shadow-card lg:col-span-2">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Leads in campaign ({funnel.total})
            </h2>
            {campaign.status === "running" && (
              <p className="mt-1 text-xs text-slate-500">
                Simulation mode — use the “advance” button on a member to move them through the funnel.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Step</th>
                  <th className="px-5 py-3 text-right">Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaign.members.map((m) => (
                  <tr key={m.id} className="transition hover:bg-white/3">
                    <td className="px-5 py-3.5">
                      <Link href={`/app/leads/${m.lead.id}`} className="font-bold text-slate-100 hover:text-brand-300">
                        {m.lead.name}
                      </Link>
                      <p className="text-xs text-slate-500">{m.lead.company ?? ""}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="chip bg-white/5 text-slate-300">{m.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      Step {m.stepIndex + 1}
                      {m.sentAt && <span className="block">{formatDateTime(m.sentAt)}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {campaign.status === "running" && ["sent", "accepted", "replied"].includes(m.status) && (
                        <form action={simulateAdvance.bind(null, campaign.id, m.id)}>
                          <button
                            type="submit"
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-brand-500/40 hover:text-brand-300"
                          >
                            {m.status === "sent" ? "Accept →" : m.status === "accepted" ? "Reply →" : "Book →"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {campaign.members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                      No leads yet — add leads to this campaign to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
