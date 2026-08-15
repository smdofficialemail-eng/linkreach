"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createLead } from "../actions";

export function LeadForm({ lists }: { lists: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createLead, undefined);

  return (
    <form action={action} className="card space-y-4 p-6 shadow-card">
      {state?.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {state.error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Full name *</label>
          <input name="name" required placeholder="Sarah Mitchell" className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" placeholder="sarah@company.com" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Headline</label>
          <input name="headline" placeholder="VP Marketing @ Dataflow" className="input" />
        </div>
        <div>
          <label className="label">Company</label>
          <input name="company" placeholder="Dataflow" className="input" />
        </div>
        <div>
          <label className="label">Location</label>
          <input name="location" placeholder="San Francisco, CA" className="input" />
        </div>
        <div>
          <label className="label">LinkedIn URL</label>
          <input name="linkedinUrl" placeholder="https://linkedin.com/in/…" className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" placeholder="+1 555 000 0000" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">List</label>
          <select name="listId" className="input" defaultValue="">
            <option value="">No list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} placeholder="Anything useful for outreach…" className="input resize-y" />
        </div>
      </div>
      <div className="flex justify-end gap-2.5 pt-2">
        <Link href="/app/leads" className="btn-ghost px-4 py-2">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2">
          {pending ? "Adding…" : "Add lead"}
        </button>
      </div>
    </form>
  );
}
