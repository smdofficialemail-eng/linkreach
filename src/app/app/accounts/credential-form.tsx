"use client";

import { useRef, useState } from "react";
import { saveLinkedinCredentials } from "./actions";

/**
 * LinkedInCredentialForm — collects LinkedIn email/password for server-side automation.
 * The password is encrypted server-side before storage (never stored in plaintext).
 */
export function LinkedInCredentialForm({
  accountId,
  accountName,
  hasCredentials,
}: {
  accountId: string;
  accountName: string;
  hasCredentials: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (hasCredentials) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <p className="text-xs font-bold text-emerald-300">✓ Server-side automation enabled</p>
        <p className="mt-1 text-xs text-slate-400">
          LinkedIn credentials stored securely (encrypted). The worker will use this profile
          to execute campaign actions via headless Chrome.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setSaving(true);
        setResult(null);
        try {
          const email = String(formData.get("linkedinLogin") || "");
          const password = String(formData.get("linkedinPassword") || "");
          const res = await saveLinkedinCredentials(accountId, email, password);
          setResult(res);
          if (res?.ok) formRef.current?.reset();
        } catch (err) {
          setResult({ error: String(err) });
        } finally {
          setSaving(false);
        }
      }}
      className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
        Enable server-side automation
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Enter {accountName}&apos;s LinkedIn login to let the server execute campaigns
        via headless Chrome. Passwords are encrypted (AES-256-GCM) and never stored in
        plaintext.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs">LinkedIn email</label>
          <input
            name="linkedinLogin"
            type="email"
            required
            placeholder="you@linkedin.com"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="label text-xs">LinkedIn password</label>
          <input
            name="linkedinPassword"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            className="input text-sm"
          />
        </div>
      </div>

      {result?.error && (
        <p className="mt-2 text-xs text-red-400">{result.error}</p>
      )}
      {result?.ok && (
        <p className="mt-2 text-xs text-emerald-400">✓ Credentials saved. Start the worker to begin automation.</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-slate-500">
          Credentials are encrypted with your AUTH_SECRET before storage.
        </p>
        <button type="submit" disabled={saving} className="btn-primary px-4 py-1.5 text-xs">
          {saving ? "Saving..." : "Save credentials"}
        </button>
      </div>
    </form>
  );
}
