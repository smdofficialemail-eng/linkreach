"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLead, updateLeadStatus } from "../actions";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "saved", label: "Saved" },
  { value: "queued", label: "Queued" },
  { value: "connection_pending", label: "Connection Pending" },
  { value: "connected", label: "Connected" },
  { value: "message_pending", label: "Message Pending" },
  { value: "messaged", label: "Messaged" },
  { value: "replied", label: "Replied" },
  { value: "not_interested", label: "Not Interested" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "completed", label: "Completed" },
  { value: "booked", label: "Booked" },
  { value: "negative", label: "Negative" },
];

export function LeadActions({
  leadId,
  status,
  linkedinUrl,
}: {
  leadId: string;
  status: string;
  linkedinUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus);
      setShowStatusMenu(false);
      router.refresh();
    });
  };

  const handleDelete = async () => {
    await deleteLead(leadId);
    router.push("/app/leads");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="btn-secondary px-4 py-2 text-sm"
        >
          Status: <span className="capitalize font-bold">{status.replace(/_/g, " ")}</span> ▾
        </button>
        {showStatusMenu && (
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-white/10 bg-ink-850 p-1.5 shadow-pop">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                disabled={pending}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                  status === s.value ? "font-bold text-brand-400" : "text-slate-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LinkedIn */}
      {linkedinUrl && (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary px-4 py-2 text-sm"
        >
          LinkedIn ↗
        </a>
      )}

      {/* Delete */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
          className="btn-ghost border-rose-500/30 px-4 py-2 text-sm text-rose-300"
        >
          Delete
        </button>
        {showDeleteConfirm && (
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-rose-500/20 bg-ink-850 p-4 shadow-pop">
            <p className="text-sm font-bold text-rose-300">Delete this lead?</p>
            <p className="mt-1 text-xs text-slate-400">This cannot be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/30"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
