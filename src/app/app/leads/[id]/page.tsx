import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { formatDateTime, timeAgo } from "@/lib/format";
import { LEAD_STATUS } from "../page";
import { LeadActions } from "./lead-actions";
import { TagManager } from "./tag-manager";

export const metadata = { title: "Lead Detail — LinkReach" };

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const { tab = "profile" } = await searchParams;

  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      list: { select: { name: true, color: true } },
      campaignMembers: {
        include: { campaign: { select: { id: true, name: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
      conversations: {
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 50 },
          account: { select: { name: true } },
        },
      },
    },
  });
  if (!lead) notFound();

  // Get activity logs for this lead
  const activities = await prisma.activityLog.findMany({
    where: {
      workspaceId: workspace.id,
      message: { contains: lead.name },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const meta = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new;
  const tags = (lead.tags as string[]) ?? [];

  const fields = [
    ["Headline", lead.headline],
    ["Company", lead.company],
    ["Job Title", lead.jobTitle],
    ["Location", lead.location],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Industry", lead.industry],
    ["LinkedIn", lead.linkedinUrl, "link"],
    ["Source", lead.source],
  ].filter(([, v]) => v);

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "campaigns", label: "Campaigns", icon: "📧", count: lead.campaignMembers.length },
    { id: "activity", label: "Activity", icon: "📋", count: activities.length },
    { id: "messages", label: "Messages", icon: "💬", count: lead.conversations.reduce((acc, c) => acc + c.messages.length, 0) },
    { id: "notes", label: "Notes", icon: "📝" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/leads" className="text-sm font-bold text-brand-400 hover:text-brand-300">
        ← Back to leads
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 text-2xl font-extrabold text-white shadow-lg shadow-brand-600/25">
            {lead.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{lead.name}</h1>
            <p className="text-sm text-slate-400">{lead.headline ?? "No headline"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`chip ${meta.classes}`}>{meta.label}</span>
              {lead.list && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  <span className="size-1.5 rounded-full" style={{ background: lead.list.color }} />
                  {lead.list.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <LeadActions leadId={lead.id} status={lead.status} linkedinUrl={lead.linkedinUrl} />
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-white/8">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/app/leads/${lead.id}?tab=${t.id}`}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold">
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Profile Tab */}
        {tab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Details Card */}
              <div className="card p-6 shadow-card">
                <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">Contact Details</h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {fields.map(([label, value, type]) => (
                    <div key={label as string}>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label as string}</dt>
                      <dd className="break-words text-sm text-slate-200">
                        {type === "link" ? (
                          <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                            {value as string}
                          </a>
                        ) : (
                          value as string
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* About Card */}
              {lead.about && (
                <div className="card p-6 shadow-card">
                  <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">About</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{lead.about}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Tags Card */}
              <div className="card p-5 shadow-card">
                <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">Tags</h2>
                <TagManager leadId={lead.id} tags={tags} />
              </div>

              {/* Quick Stats */}
              <div className="card p-5 shadow-card">
                <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">Quick Stats</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Added</span>
                    <span className="text-sm font-semibold text-slate-200">{timeAgo(lead.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Last updated</span>
                    <span className="text-sm font-semibold text-slate-200">{timeAgo(lead.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Campaigns</span>
                    <span className="text-sm font-semibold text-slate-200">{lead.campaignMembers.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Conversations</span>
                    <span className="text-sm font-semibold text-slate-200">{lead.conversations.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {tab === "campaigns" && (
          <div className="card p-6 shadow-card">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">Campaign History</h2>
            {lead.campaignMembers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg font-extrabold text-slate-300">Not in any campaign yet</p>
                <p className="mt-1 text-sm text-slate-500">Add this lead to a campaign from the Outreach page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lead.campaignMembers.map((m) => (
                  <Link
                    key={m.id}
                    href={`/app/campaigns/${m.campaign.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-800/50 p-4 transition hover:border-brand-500/30 hover:bg-ink-800"
                  >
                    <div>
                      <p className="font-bold text-slate-200 hover:text-brand-300">{m.campaign.name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span className="capitalize">{m.status}</span>
                        {m.sentAt && <span>· sent {formatDateTime(m.sentAt)}</span>}
                        {m.acceptedAt && <span>· accepted {formatDateTime(m.acceptedAt)}</span>}
                        {m.repliedAt && <span>· replied {formatDateTime(m.repliedAt)}</span>}
                      </div>
                    </div>
                    <span className={`chip ${
                      m.status === "replied" || m.status === "booked"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : m.status === "accepted"
                          ? "bg-violet-500/15 text-violet-300"
                          : m.status === "sent" || m.status === "contacted"
                            ? "bg-sky-500/15 text-sky-300"
                            : "bg-white/5 text-slate-400"
                    }`}>
                      {m.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {tab === "activity" && (
          <div className="card p-6 shadow-card">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">Activity Timeline</h2>
            {activities.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg font-extrabold text-slate-300">No activity yet</p>
                <p className="mt-1 text-sm text-slate-500">Actions will appear here as you outreach to this lead.</p>
              </div>
            ) : (
              <div className="relative ml-3 border-l-2 border-white/5 pl-6 space-y-6">
                {activities.map((a) => (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[31px] top-1 size-3 rounded-full border-2 border-ink-850 bg-brand-500" />
                    <div>
                      <p className="text-sm text-slate-200">{a.message}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {tab === "messages" && (
          <div className="space-y-4">
            {lead.conversations.length === 0 ? (
              <div className="card p-12 text-center shadow-card">
                <p className="text-lg font-extrabold text-slate-300">No messages yet</p>
                <p className="mt-1 text-sm text-slate-500">Conversations will appear here once outreach begins.</p>
              </div>
            ) : (
              lead.conversations.map((conv) => (
                <div key={conv.id} className="card overflow-hidden shadow-card">
                  <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-brand-600/25 text-xs font-bold text-brand-300">
                        {conv.account?.name?.charAt(0) ?? "?"}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{conv.account?.name ?? "Unknown account"}</p>
                        <p className="text-xs text-slate-500">{conv.messages.length} messages</p>
                      </div>
                    </div>
                    <Link href={`/app/inbox?lead=${lead.id}`} className="text-xs font-bold text-brand-400 hover:text-brand-300">
                      Open in Inbox →
                    </Link>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-4 space-y-2">
                    {conv.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          m.direction === "in"
                            ? "border border-white/8 bg-ink-800 text-slate-300"
                            : "bg-brand-600 text-white"
                        }`}>
                          {m.body}
                          <p className={`mt-1 text-[10px] ${m.direction === "in" ? "text-slate-600" : "text-white/60"}`}>
                            {m.sentAt ? timeAgo(m.sentAt) : "draft"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes Tab */}
        {tab === "notes" && (
          <div className="card p-6 shadow-card">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-slate-400">Notes</h2>
            {lead.notes ? (
              <div className="whitespace-pre-line rounded-xl bg-ink-800/50 p-4 text-sm leading-relaxed text-slate-300">
                {lead.notes}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-lg font-extrabold text-slate-300">No notes yet</p>
                <p className="mt-1 text-sm text-slate-500">Add notes to remember important details about this lead.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
