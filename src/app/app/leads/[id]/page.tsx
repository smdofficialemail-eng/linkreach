import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { formatDateTime } from "@/lib/format";
import { LEAD_STATUS } from "../page";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      list: { select: { name: true, color: true } },
      campaignMembers: { include: { campaign: { select: { id: true, name: true, status: true } } } },
      conversations: { include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } } },
    },
  });
  if (!lead) notFound();

  const meta = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new;

  const fields = [
    ["Headline", lead.headline],
    ["Company", lead.company],
    ["Location", lead.location],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["LinkedIn", lead.linkedinUrl],
    ["Source", lead.source],
  ].filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/leads" className="text-sm font-bold text-brand-400 hover:text-brand-300">
        ← Back to leads
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{lead.name}</h1>
          <p className="text-sm text-slate-400">{lead.headline ?? "—"}</p>
        </div>
        <span className={`chip ${meta.classes}`}>{meta.label}</span>
      </div>

      {lead.conversations[0] && (
        <Link
          href={`/app/inbox?lead=${lead.id}`}
          className="btn-secondary mt-4 px-4 py-2 text-sm"
        >
          ✉ Open conversation
        </Link>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">Details</h2>
          <dl className="space-y-3">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</dt>
                <dd className="break-words text-sm text-slate-200">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">List</dt>
              <dd className="text-sm text-slate-200">
                {lead.list ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ background: lead.list.color }} />
                    {lead.list.name}
                  </span>
                ) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Campaign history
          </h2>
          {lead.campaignMembers.length === 0 ? (
            <p className="text-sm text-slate-500">Not in any campaign yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {lead.campaignMembers.map((m) => (
                <li key={m.id} className="rounded-xl border border-white/5 bg-ink-800/50 p-3.5">
                  <Link href={`/app/campaigns/${m.campaign.id}`} className="text-sm font-bold text-slate-200 hover:text-brand-300">
                    {m.campaign.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>{m.status}</span>
                    {m.sentAt && <span>sent {formatDateTime(m.sentAt)}</span>}
                    {m.acceptedAt && <span>accepted {formatDateTime(m.acceptedAt)}</span>}
                    {m.repliedAt && <span>replied {formatDateTime(m.repliedAt)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {lead.notes && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wider text-slate-400">Notes</h2>
              <p className="whitespace-pre-line text-sm text-slate-300">{lead.notes}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
