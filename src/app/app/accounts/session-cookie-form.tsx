"use client";

import { useState } from "react";
import { saveSessionCookie } from "./actions";

/**
 * SessionCookieForm — lets the user paste their LinkedIn session cookie (li_at)
 * to enable real LinkedIn profile search via the Voyager API.
 *
 * This is a safe, client-side component that sends the cookie to a server action
 * for encrypted storage.
 */
export function SessionCookieForm({ accountId, accountName, hasCookie }: {
  accountId: string;
  accountName: string;
  hasCookie: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!cookie.trim()) {
      setError("Please paste your LinkedIn session cookie");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await saveSessionCookie(accountId, cookie.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setCookie("");
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Failed to save cookie");
    }
    setSaving(false);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/8 bg-ink-800/50 p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
            🔍 Enable Real LinkedIn Search
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {hasCookie
              ? "✓ Session cookie saved — real search enabled"
              : "Paste your LinkedIn session cookie to search real profiles"}
          </p>
        </div>
        <span className="text-slate-500">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {!hasCookie && (
            <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3">
              <p className="text-xs font-bold text-sky-300">How to get your LinkedIn session cookie:</p>
              <ol className="mt-2 space-y-1 text-xs text-slate-400">
                <li>1. Open <strong>linkedin.com</strong> in your browser and log in</li>
                <li>2. Press <strong>F12</strong> to open Developer Tools</li>
                <li>3. Go to <strong>Application</strong> tab (Chrome) or <strong>Storage</strong> tab (Firefox)</li>
                <li>4. Click <strong>Cookies</strong> → <strong>linkedin.com</strong></li>
                <li>5. Find the <strong>li_at</strong> cookie and copy its value</li>
                <li>6. Paste it below</li>
              </ol>
              <p className="mt-2 text-[10px] text-slate-500">
                ⚠️ This cookie is encrypted before storage. Never share it with anyone.
              </p>
            </div>
          )}

          <div>
            <label className="label">LI_AT SESSION COOKIE</label>
            <input
              type="password"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="AQEz... (paste your li_at cookie value)"
              className="input font-mono text-xs"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {saved && <p className="text-xs text-emerald-400">✓ Session cookie saved! Real search enabled.</p>}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !cookie.trim()}
              className="btn-primary px-4 py-2 text-sm"
            >
              {saving ? "Saving…" : "Save Session Cookie"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
