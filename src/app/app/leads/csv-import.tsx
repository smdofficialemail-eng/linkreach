"use client";

import { useActionState, useState } from "react";
import { importCsvLeads } from "./actions";

export function CsvImport({
  lists,
}: {
  lists: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(importCsvLeads, undefined);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-4 py-2">
        Import CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-white">Import leads from CSV</h2>
                <p className="text-sm text-slate-400">
                  Paste rows with a header. Columns: name, email, headline, company, LinkedIn URL, location, phone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {state?.ok ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                ✓ Imported {state.count} lead{state.count === 1 ? "" : "s"}.
              </div>
            ) : (
              <form action={action} className="space-y-4">
                {state?.error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                    {state.error}
                  </p>
                )}
                <textarea
                  name="csv"
                  rows={9}
                  required
                  placeholder={"name,email,headline,company,linkedinUrl,location,phone\nSarah Mitchell,sarah@dataflow.com,VP Marketing @ Dataflow,Dataflow,https://linkedin.com/in/sarah,San Francisco,415-555-0123"}
                  className="input font-mono text-xs"
                />
                <div>
                  <label className="label">Add to list (optional)</label>
                  <select name="listId" className="input" defaultValue="">
                    <option value="">No list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2.5">
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2">
                    Cancel
                  </button>
                  <button type="submit" disabled={pending} className="btn-primary px-4 py-2">
                    {pending ? "Importing…" : "Import"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
