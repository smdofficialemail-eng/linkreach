import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { timeAgo } from "@/lib/format";
import { sendReply } from "./actions";

export const metadata = { title: "Inbox — LinkReach" };

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { lead } = await searchParams;

  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: {
      lead: { select: { id: true, name: true, company: true, headline: true } },
      account: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const active =
    lead && conversations.some((c) => c.leadId === lead)
      ? conversations.find((c) => c.leadId === lead)!
      : conversations[0] ?? null;

  const thread = active
    ? await prisma.message.findMany({
        where: { conversationId: active.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Inbox</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every conversation across every profile, in one place.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Conversation list */}
        <div className="card overflow-hidden shadow-card lg:col-span-2">
          <div className="border-b border-white/8 px-5 py-3.5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Conversations ({conversations.length})
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No conversations yet — replies will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/inbox?lead=${c.leadId}`}
                      className={`flex items-center gap-3 px-4 py-3.5 transition ${
                        active?.id === c.id ? "bg-brand-600/15" : "hover:bg-white/4"
                      }`}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-700 text-sm font-extrabold text-slate-300">
                        {c.lead.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-slate-100">{c.lead.name}</p>
                          {c.lastMessageAt && (
                            <span className="shrink-0 text-[11px] text-slate-600">{timeAgo(c.lastMessageAt)}</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {c.messages[0]?.body ?? "—"}
                        </p>
                        {c.account && <p className="mt-0.5 text-[11px] text-slate-600">via {c.account.name}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="card flex min-h-[60vh] flex-col overflow-hidden shadow-card lg:col-span-3">
          {!active ? (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <p className="text-lg font-extrabold text-slate-300">No conversation selected</p>
                <p className="mt-1 text-sm text-slate-500">
                  Accepted connections and replies land here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
                <span className="grid size-10 place-items-center rounded-full bg-brand-600/25 text-sm font-extrabold text-brand-300">
                  {active.lead.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-white">{active.lead.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {active.lead.company ?? ""}
                    {active.account ? ` · via ${active.account.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.direction === "in"
                          ? "rounded-tl-sm border border-white/8 bg-ink-800 text-slate-200"
                          : "rounded-tr-sm bg-gradient-to-r from-brand-600 to-brand-500 text-white"
                      }`}
                    >
                      {m.body}
                      <p className={`mt-1 text-[10px] ${m.direction === "in" ? "text-slate-600" : "text-white/60"}`}>
                        {m.sentAt ? timeAgo(m.sentAt) : "draft"}
                      </p>
                    </div>
                  </div>
                ))}
                {thread.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">Start the conversation.</p>
                )}
              </div>

              <form action={sendReply.bind(null, active.id)} className="border-t border-white/8 p-4">
                <div className="flex gap-2.5">
                  <input
                    name="body"
                    required
                    placeholder={`Reply to ${active.lead.name.split(" ")[0]}…`}
                    className="input flex-1"
                  />
                  <button type="submit" className="btn-primary px-4 py-2">
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
