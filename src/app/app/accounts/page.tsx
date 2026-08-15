import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { createAccount, toggleAccount, deleteAccount } from "./actions";

export const metadata = { title: "Accounts — LinkReach" };

export default async function AccountsPage() {
  const { workspace } = await requireWorkspace();
  const accounts = await prisma.linkedinAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { campaigns: true, conversations: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">LinkedIn accounts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Connect the profiles that run your outreach. In simulation mode, no real
          LinkedIn actions are performed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((a) => (
          <div key={a.id} className="card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-ink-600 to-ink-700 text-lg font-extrabold text-slate-200">
                  {a.name.charAt(0)}
                </span>
                <div>
                  <p className="font-extrabold text-white">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.headline ?? "—"}</p>
                </div>
              </div>
              <span className={`chip ${a.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}>
                {a.status}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {a._count.campaigns} campaigns · {a._count.conversations} conversations · limit {a.dailyLimit}/day
              </p>
              <div className="flex gap-2">
                <form action={toggleAccount.bind(null, a.id)}>
                  <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
                    {a.status === "active" ? "Pause" : "Activate"}
                  </button>
                </form>
                <form action={deleteAccount.bind(null, a.id)}>
                  <button type="submit" className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Connect form */}
      <form action={createAccount} className="card mt-6 space-y-4 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Connect a profile</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Profile name *</label>
            <input name="name" required placeholder="Daniel Chen" className="input" />
          </div>
          <div>
            <label className="label">Headline</label>
            <input name="headline" placeholder="Founder @ Acme Growth" className="input" />
          </div>
          <div>
            <label className="label">LinkedIn URL</label>
            <input name="profileUrl" placeholder="https://linkedin.com/in/…" className="input" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2">
            + Connect profile
          </button>
        </div>
      </form>
    </div>
  );
}
