import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { updateWorkspace } from "./actions";

export const metadata = { title: "Settings — LinkReach" };

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Workspace details and delivery mode.</p>
      </div>

      <form action={updateWorkspace} className="card space-y-4 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Workspace</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Workspace name</label>
            <input name="name" defaultValue={workspace.name} className="input" />
          </div>
          <div>
            <label className="label">Delivery mode</label>
            <select name="deliveryMode" className="input" defaultValue={workspace.deliveryMode}>
              <option value="simulation">Simulation (demo)</option>
              <option value="extension">Browser extension</option>
              <option value="api">LinkedIn API</option>
            </select>
          </div>
        </div>
        <p className="rounded-lg border border-white/8 bg-ink-800/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
          <b className="text-slate-300">Simulation mode</b> runs campaigns without touching
          LinkedIn — every action is modeled and tracked. Plug in a delivery provider
          (browser extension or LinkedIn API) to go live.
        </p>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2">
            Save settings
          </button>
        </div>
      </form>

      <div className="card mt-6 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Team ({memberships.length})</h2>
        <ul className="mt-3 divide-y divide-white/5">
          {memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-ink-700 text-xs font-extrabold text-slate-300">
                  {m.user.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-200">{m.user.name}</p>
                  <p className="text-xs text-slate-500">{m.user.email}</p>
                </div>
              </div>
              <span className="chip bg-brand-600/15 capitalize text-brand-300">{m.role}</span>
            </li>
          ))}
        </ul>
        {user?.name && (
          <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">
            Signed in as {user.name}
          </p>
        )}
      </div>
    </div>
  );
}
