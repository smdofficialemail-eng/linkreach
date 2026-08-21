import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { updateWorkspace, generateCode, unpairExtension } from "./actions";

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
              <option value="server">Server automation</option>
              <option value="extension">Browser extension</option>
              <option value="api">LinkedIn API</option>
            </select>
          </div>
        </div>
        <p className="rounded-lg border border-white/8 bg-ink-800/60 px-4 py-3 text-xs leading-relaxed text-slate-400">
          <b className="text-slate-300">Simulation mode</b> runs campaigns without touching
          LinkedIn — every action is modeled and tracked.{' '}
          <b className="text-slate-300">Server automation</b> uses headless Chrome on the server
          to send real connection requests — no browser extension needed.{' '}
          <b className="text-slate-300">Browser extension</b> runs the automation in your local Chrome.
        </p>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2">
            Save settings
          </button>
        </div>
      </form>

      <div className="card mt-6 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
            Browser extension
          </h2>
          <span
            className={`chip ${
              workspace.extensionPairedAt
                ? "bg-emerald-500/15 text-emerald-300"
                : workspace.extensionCode
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-ink-700 text-slate-400"
            }`}
          >
            {workspace.extensionPairedAt
              ? `Paired · ${workspace.extensionName ?? "Browser"}`
              : workspace.extensionCode
                ? "Waiting for browser"
                : "Not paired"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Install the LinkReach extension in Chrome, then enter the code below to pair it. The
          extension executes your campaigns on LinkedIn — connection requests, messages and
          reactions — while the app tracks every action.
        </p>

        {workspace.extensionPairedAt ? (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm font-bold text-emerald-300">
              ✓ Connected to {workspace.extensionName ?? "a browser"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Paired{" "}
              {workspace.extensionPairedAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              . Your campaigns in <b className="text-slate-300">extension delivery mode</b> send
              jobs to this browser.
            </p>
            <form action={unpairExtension} className="mt-3">
              <button type="submit" className="btn-ghost border-rose-500/30 text-rose-300">
                Unpair this browser
              </button>
            </form>
          </div>
        ) : workspace.extensionCode ? (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Pairing code</p>
            <p className="mt-2 font-mono text-3xl font-extrabold tracking-[0.35em] text-white">
              {workspace.extensionCode}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Open the LinkReach extension and enter this code. It expires the moment it&apos;s
              used — codes are single-use for security.
            </p>
            <form action={generateCode} className="mt-3">
              <button type="submit" className="btn-ghost text-slate-300">
                Regenerate code
              </button>
            </form>
          </div>
        ) : (
          <form action={generateCode} className="mt-4">
            <button type="submit" className="btn-primary px-5 py-2">
              Generate pairing code
            </button>
          </form>
        )}
      </div>

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
