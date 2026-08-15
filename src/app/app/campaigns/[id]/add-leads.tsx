"use client";

import { useActionState, useState } from "react";
import { addLeadsToCampaign } from "../actions";

export function AddLeads({
  campaignId,
  leads,
}: {
  campaignId: string;
  leads: { id: string; name: string; company: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action, pending] = useActionState(addLeadsToCampaign, undefined);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 py-2">
        + Add leads
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-ink-850 shadow-pop">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-white">Add leads</h2>
                <p className="text-sm text-slate-400">{selected.length} selected</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form action={action} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="leadIds" value={selected.join(",")} />
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {leads.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">No leads in your database yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {leads.map((lead) => (
                      <li key={lead.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={selected.includes(lead.id)}
                            onChange={() => toggle(lead.id)}
                            className="size-4 accent-brand-500"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-200">{lead.name}</span>
                            <span className="block truncate text-xs text-slate-500">{lead.company ?? "—"}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2.5 border-t border-white/8 px-5 py-4">
                {state && "ok" in state && state.ok && (
                  <p className="mr-auto self-center text-sm font-semibold text-emerald-300">
                    ✓ Added {state.added}
                  </p>
                )}
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={pending || selected.length === 0} className="btn-primary px-4 py-2">
                  {pending ? "Adding…" : `Add ${selected.length}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
