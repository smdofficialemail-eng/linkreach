import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { addBlacklistEntry, removeBlacklistEntry } from "./actions";

export const metadata = { title: "Blacklist — LinkReach" };

const REASONS = [
  { value: "manual", label: "Manual blacklist" },
  { value: "already_contacted", label: "Already contacted" },
  { value: "competitor", label: "Competitor" },
  { value: "existing_client", label: "Existing client" },
  { value: "not_relevant", label: "Not relevant" },
  { value: "do_not_contact", label: "Do not contact" },
];

export default async function BlacklistPage() {
  const { workspace } = await requireWorkspace();

  const entries = await prisma.blacklistEntry.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { linkedinProfile: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Blacklist
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage profiles that should never receive outreach. Blacklisted
          profiles are checked before every action.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {REASONS.slice(0, 3).map((r) => (
          <div key={r.value} className="card p-4 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {r.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {entries.filter((e) => e.reason === r.value).length}
            </p>
          </div>
        ))}
      </div>

      {/* Add Entry Form */}
      <form
        action={addBlacklistEntry}
        className="card mb-6 space-y-4 p-6 shadow-card"
      >
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
          Add to Blacklist
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Name or Profile URL *</label>
            <input
              name="identifier"
              required
              placeholder="LinkedIn URL or name"
              className="input"
            />
          </div>
          <div>
            <label className="label">Reason</label>
            <select name="reason" className="input" defaultValue="manual">
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              name="notes"
              placeholder="Optional notes..."
              className="input"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2">
            Add to Blacklist
          </button>
        </div>
      </form>

      {/* Entries Table */}
      {entries.length === 0 ? (
        <div className="card p-16 text-center shadow-card">
          <p className="font-extrabold text-slate-300">Blacklist is empty</p>
          <p className="mt-1 text-sm text-slate-500">
            Add profiles above to prevent outreach to specific people.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Profile</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Notes</th>
                  <th className="px-5 py-3.5">Added</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition hover:bg-white/3"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-100">
                        {entry.name ??
                          entry.linkedinProfile?.fullName ??
                          entry.profileUrl ??
                          "Unknown"}
                      </p>
                      {(entry.linkedinProfile?.headline || entry.profileUrl) && (
                        <p className="truncate text-xs text-slate-500">
                          {entry.linkedinProfile?.headline ??
                            entry.profileUrl}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="chip bg-red-500/15 text-red-300">
                        {REASONS.find((r) => r.value === entry.reason)?.label ??
                          entry.reason}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {entry.notes ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {entry.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <form action={removeBlacklistEntry.bind(null, entry.id)}>
                        <button
                          type="submit"
                          className="text-xs font-bold text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
