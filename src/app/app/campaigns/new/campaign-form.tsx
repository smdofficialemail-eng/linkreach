"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createCampaign } from "../actions";

type Step = {
  action: "connect" | "message" | "follow_up" | "reaction";
  daysAfter: number;
  template: string;
};

const ACTIONS: { value: Step["action"]; label: string; icon: string }[] = [
  { value: "connect", label: "Connection request", icon: "＋" },
  { value: "message", label: "Message", icon: "✉" },
  { value: "follow_up", label: "Follow-up", icon: "⇄" },
  { value: "reaction", label: "Reaction", icon: "♡" },
];

const VARIABLE_HINTS = ["{{first_name}}", "{{company}}", "{{headline}}"];

const emptyStep = (): Step => ({ action: "message", daysAfter: 1, template: "" });

export function CampaignForm({
  accounts,
}: {
  accounts: { id: string; name: string; headline: string | null }[];
}) {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const [steps, setSteps] = useState<Step[]>([
    { action: "connect", daysAfter: 0, template: "Hi {first_name}, I noticed {company} is growing fast. I'd love to connect and share an idea that could help your sales team. Thanks!" },
    { action: "message", daysAfter: 1, template: "Thanks for connecting, {first_name}! Curious — how is {company} handling outbound prospecting right now?" },
  ]);

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function insertVariable(i: number, variable: string) {
    updateStep(i, { template: (steps[i]?.template ?? "") + " " + variable });
  }

  const stepsJson = JSON.stringify(
    steps.map((s) => ({
      action: s.action,
      daysAfter: s.daysAfter,
      template: s.template,
      variables: {},
    }))
  );

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {state.error}
        </p>
      )}

      {/* Details */}
      <section className="card space-y-4 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Campaign details</h2>
        <div>
          <label className="label">Campaign name *</label>
          <input name="name" required placeholder="e.g. Q3 SDR Outreach — Connections" className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="outbound">
              <option value="outbound">Outbound (new leads)</option>
              <option value="inbound">Inbound (existing connections)</option>
            </select>
          </div>
          <div>
            <label className="label">Campaign kind</label>
            <select name="kind" className="input" defaultValue="connections">
              <option value="connections">Connections</option>
              <option value="messages">Messages</option>
              <option value="reactions">Reactions</option>
            </select>
          </div>
          <div>
            <label className="label">LinkedIn account</label>
            <select name="linkedinAccountId" className="input" defaultValue="">
              <option value="">Pick a profile</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="card space-y-4 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Safety & delivery</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Daily limit</label>
            <input name="dailyLimit" type="number" min={1} max={200} defaultValue={30} className="input" />
          </div>
          <div>
            <label className="label">Min delay (min)</label>
            <input name="minDelayMin" type="number" min={1} max={60} defaultValue={4} className="input" />
          </div>
          <div>
            <label className="label">Max delay (min)</label>
            <input name="maxDelayMin" type="number" min={1} max={60} defaultValue={9} className="input" />
          </div>
        </div>
        <div className="space-y-2">
          {[
            ["smartTimezone", "Smart timezones — send during the lead's working hours"],
            ["autoTranslate", "Auto-translate messages to the lead's language"],
            ["aiPersonalization", "AI personalization — human-sounding first lines"],
          ].map(([name, label]) => (
            <label key={name} className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" name={name} defaultChecked className="size-4 accent-brand-500" />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="card space-y-4 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Sequence</h2>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, emptyStep()])}
            className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-brand-500/50 hover:text-brand-300"
          >
            + Add step
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-ink-800/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600/20 text-xs font-extrabold text-brand-300">
                  {i + 1}
                </span>
                <select
                  value={step.action}
                  onChange={(e) => updateStep(i, { action: e.target.value as Step["action"] })}
                  className="input w-auto"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.icon} {a.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  after
                  <input
                    type="number"
                    min={0}
                    value={step.daysAfter}
                    onChange={(e) => updateStep(i, { daysAfter: Number(e.target.value) || 0 })}
                    className="input w-16 text-center"
                  />
                  days
                </label>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    className="ml-auto grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                    aria-label="Remove step"
                  >
                    ✕
                  </button>
                )}
              </div>
              {(step.action === "message" || step.action === "follow_up") && (
                <div className="mt-3">
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {VARIABLE_HINTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVariable(i, v)}
                        className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-brand-300 transition hover:bg-brand-600/20"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={step.template}
                    onChange={(e) => updateStep(i, { template: e.target.value })}
                    rows={3}
                    placeholder="Write the message… variables personalize each lead."
                    className="input resize-y font-mono text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <input type="hidden" name="steps" value={stepsJson} />

      <div className="flex items-center justify-end gap-3">
        <Link href="/app/campaigns" className="btn-ghost px-4 py-2">
          Cancel
        </Link>
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2">
          {pending ? "Creating…" : "Create campaign"}
        </button>
      </div>
    </form>
  );
}
