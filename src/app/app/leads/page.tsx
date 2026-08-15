import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { CsvImport } from "./csv-import";

export const metadata = { title: "Leads — LinkReach" };

export const LEAD_STATUS: Record<string, { label: string; classes: string }> = {
  new: { label: "New", classes: "bg-sky-500/15 text-sky-300" },
  contacted: { label: "Contacted", classes: "bg-violet-500/15 text-violet-300" },
  replied: { label: "Replied", classes: "bg-emerald-500/15 text-emerald-300" },
  booked: { label: "Booked", classes: "bg-amber-500/15 text-amber-300" },
  negative: { label: "Negative", classes: "bg-red-500/15 text-red-300" },
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string; status?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { list, status } = await searchParams;

  const lists = await prisma.list.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });

  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: workspace.id,
      ...(list ? { listId: list } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true, color: true } } },
    take: 100,
  });

  const counts = await prisma.lead.groupBy({
    by: ["status"],
    where: { workspaceId: workspace.id },
    _count: { _all: true },
  });
  const statusCounts: Record<string, number> = {};
  for (const row of counts) statusCounts[row.status] = row._count._all;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-400">
            {leads.length} prospects in your database — add, import, or filter.
          </p>
        </div>
        <div className="flex gap-2.5">
          <CsvImport lists={lists.map((l) => ({ id: l.id, name: l.name }))} />
          <Link href="/app/leads/new" className="btn-primary px-4 py-2">
            + Add lead
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/app/leads"
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            !list && !status
              ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/25"
              : "border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
          }`}
        >
          All
        </Link>
        {lists.map((l) => (
          <Link
            key={l.id}
            href={`/app/leads?list=${l.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              list === l.id
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/25"
                : "border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="size-1.5 rounded-full" style={{ background: l.color }} />
            {l.name}
          </Link>
        ))}
        {Object.entries(LEAD_STATUS).map(([key, meta]) => (
          <Link
            key={key}
            href={`/app/leads?status=${key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
              status === key
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/25"
                : "border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {meta.label} {statusCounts[key] ? `(${statusCounts[key]})` : ""}
          </Link>
        ))}
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="card p-16 text-center shadow-card">
          <p className="font-extrabold text-slate-300">No leads here yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add a lead manually or import a CSV to start building your database.
          </p>
          <Link href="/app/leads/new" className="btn-primary mt-5 px-4 py-2">
            + Add lead
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">List</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Source</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((lead) => {
                  const meta = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new;
                  return (
                    <tr key={lead.id} className="transition hover:bg-white/3">
                      <td className="px-5 py-4">
                        <Link href={`/app/leads/${lead.id}`} className="font-bold text-slate-100 hover:text-brand-300">
                          {lead.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{lead.headline ?? ""}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{lead.company ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-400">{lead.location ?? "—"}</td>
                      <td className="px-5 py-4">
                        {lead.list ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <span className="size-1.5 rounded-full" style={{ background: lead.list.color }} />
                            {lead.list.name}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`chip ${meta.classes}`}>{meta.label}</span>
                      </td>
                      <td className="px-5 py-4 text-xs uppercase text-slate-500">{lead.source}</td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/app/leads/${lead.id}`} className="text-xs font-bold text-brand-400 hover:text-brand-300">
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
