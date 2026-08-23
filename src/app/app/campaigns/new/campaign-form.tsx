"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createCampaign } from "../actions";

type Step = {
  id: string;
  action: "connect" | "message" | "follow_up" | "reaction" | "wait" | "check_connection" | "check_reply";
  daysAfter: number;
  template: string;
  condition?: string;
};

const ACTIONS: { value: Step["action"]; label: string; icon: string; color: string }[] = [
  { value: "connect", label: "Connection Request", icon: "🤝", color: "from-blue-500 to-blue-600" },
  { value: "message", label: "Send Message", icon: "💬", color: "from-violet-500 to-violet-600" },
  { value: "follow_up", label: "Follow-up Message", icon: "🔄", color: "from-emerald-500 to-emerald-600" },
  { value: "wait", label: "Wait", icon: "⏱", color: "from-amber-500 to-amber-600" },
  { value: "check_connection", label: "Check Connection", icon: "🔍", color: "from-sky-500 to-sky-600" },
  { value: "check_reply", label: "Check Reply", icon: "📬", color: "from-rose-500 to-rose-600" },
  { value: "reaction", label: "React to Post", icon: "❤️", color: "from-pink-500 to-pink-600" },
];

const VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{job_title}}",
  "{{location}}",
  "{{industry}}",
];

const WIZARD_STEPS = ["Campaign Details", "Target Source", "Flow Builder"];

let _stepId = 0;
const newStepId = () => `step-${++_stepId}`;

export function CampaignForm({
  accounts,
}: {
  accounts: { id: string; name: string; headline: string | null }[];
}) {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const [wizardStep, setWizardStep] = useState(0);

  // Step 1: Campaign details
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState("outbound");
  const [campaignKind, setCampaignKind] = useState("connections");
  const [selectedAccount, setSelectedAccount] = useState("");

  // Step 2: Target source
  const [targetSource, setTargetSource] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvData, setCsvData] = useState("");

  // Step 3: Flow
  const [flowSteps, setFlowSteps] = useState<Step[]>([
    { id: newStepId(), action: "connect", daysAfter: 0, template: "Hi {{first_name}}, I came across your profile at {{company}} and thought it would be valuable to connect." },
    { id: newStepId(), action: "wait", daysAfter: 3, template: "" },
    { id: newStepId(), action: "check_connection", daysAfter: 0, template: "" },
    { id: newStepId(), action: "message", daysAfter: 0, template: "Hi {{first_name}}, thanks for connecting! I noticed you're working in {{industry}}. Would love to exchange ideas." },
    { id: newStepId(), action: "wait", daysAfter: 4, template: "" },
    { id: newStepId(), action: "check_reply", daysAfter: 0, template: "" },
    { id: newStepId(), action: "follow_up", daysAfter: 0, template: "Hi {{first_name}}, just following up on my previous message. Any thoughts on connecting?" },
  ]);

  function addStep(afterIndex: number, type: Step["action"]) {
    const newStep: Step = {
      id: newStepId(),
      action: type,
      daysAfter: type === "wait" ? 3 : 0,
      template: type === "wait" || type === "check_connection" || type === "check_reply" ? "" : "",
    };
    setFlowSteps((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newStep);
      return next;
    });
  }

  function removeStep(id: string) {
    setFlowSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStep(id: string, patch: Partial<Step>) {
    setFlowSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function insertVariable(stepId: string, variable: string) {
    const step = flowSteps.find((s) => s.id === stepId);
    if (step) updateStep(stepId, { template: (step.template ?? "") + " " + variable });
  }

  const stepsJson = JSON.stringify(
    flowSteps.map((s, i) => ({
      action: s.action,
      position: i,
      daysAfter: s.daysAfter,
      template: s.template || null,
      variables: {},
      attachments: [],
    }))
  );

  const isStepValid = (step: number) => {
    if (step === 0) return campaignName.length > 0;
    if (step === 1) return true;
    return flowSteps.length > 0;
  };

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {state.error}
        </p>
      )}

      {/* Wizard Progress */}
      <div className="flex items-center gap-2">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i <= wizardStep && setWizardStep(i)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                i === wizardStep
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md"
                  : i < wizardStep
                    ? "bg-brand-600/15 text-brand-300"
                    : "bg-white/5 text-slate-500"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[10px] font-extrabold">
                {i < wizardStep ? "✓" : i + 1}
              </span>
              {label}
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`h-px w-8 ${i < wizardStep ? "bg-brand-500" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Campaign Details */}
      {wizardStep === 0 && (
        <section className="card space-y-5 p-6 shadow-card">
          <h2 className="text-lg font-extrabold text-white">Campaign Details</h2>
          <div>
            <label className="label">Campaign Name *</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              name="name"
              required
              placeholder="e.g. EdTech Founders — Mumbai"
              className="input"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Type</label>
              <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} name="type" className="input">
                <option value="outbound">Outbound (new leads)</option>
                <option value="inbound">Inbound (existing connections)</option>
              </select>
            </div>
            <div>
              <label className="label">Kind</label>
              <select value={campaignKind} onChange={(e) => setCampaignKind(e.target.value)} name="kind" className="input">
                <option value="connections">Connections</option>
                <option value="messages">Messages</option>
                <option value="reactions">Reactions</option>
              </select>
            </div>
            <div>
              <label className="label">LinkedIn Account</label>
              <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} name="linkedinAccountId" className="input">
                <option value="">Pick a profile</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
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
              ["aiPersonalization", "AI personalization — human-sounding first lines"],
            ].map(([name, label]) => (
              <label key={name} className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" name={name} defaultChecked className="size-4 accent-brand-500" />
                {label}
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Target Source */}
      {wizardStep === 1 && (
        <section className="card space-y-5 p-6 shadow-card">
          <h2 className="text-lg font-extrabold text-white">Target Source</h2>
          <p className="text-sm text-slate-400">Choose how you want to find leads for this campaign.</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { value: "search", label: "LinkedIn Search", icon: "🔍", desc: "Search by keywords, title, location" },
              { value: "sales_nav", label: "Sales Navigator", icon: "🧭", desc: "Import saved lead lists" },
              { value: "csv", label: "CSV Import", icon: "📄", desc: "Upload a CSV with profile URLs" },
              { value: "existing", label: "Existing Leads", icon: "👤", desc: "Use leads already in your database" },
              { value: "manual", label: "Manual URLs", icon: "🔗", desc: "Paste individual profile URLs" },
              { value: "crm", label: "CRM Import", icon: "📊", desc: "Sync from your CRM (coming soon)" },
            ].map((src) => (
              <button
                key={src.value}
                type="button"
                onClick={() => setTargetSource(src.value)}
                className={`rounded-xl border p-4 text-left transition ${
                  targetSource === src.value
                    ? "border-brand-500/50 bg-brand-600/10 ring-1 ring-brand-500/25"
                    : "border-white/8 bg-white/3 hover:border-white/15"
                }`}
              >
                <span className="text-xl">{src.icon}</span>
                <p className="mt-1.5 text-sm font-bold text-white">{src.label}</p>
                <p className="text-xs text-slate-500">{src.desc}</p>
              </button>
            ))}
          </div>

          {targetSource === "search" && (
            <div className="mt-4 rounded-xl border border-white/8 bg-ink-800/50 p-4">
              <label className="label">LinkedIn Search URL or Keywords</label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="https://www.linkedin.com/search/results/people/?keywords=... or type keywords"
                className="input"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["VP Marketing", "Startup Founder", "Head of Sales", "Product Manager", "CEO"].map((term) => (
                  <button key={term} type="button" onClick={() => setSearchQuery(term)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 transition hover:text-white">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {targetSource === "csv" && (
            <div className="mt-4 rounded-xl border border-white/8 bg-ink-800/50 p-4">
              <label className="label">Paste CSV data (URL column)</label>
              <textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={4}
                placeholder="https://linkedin.com/in/sarah-chen&#10;https://linkedin.com/in/james-rodriguez"
                className="input resize-none font-mono text-xs"
              />
            </div>
          )}
        </section>
      )}

      {/* Step 3: Flow Builder */}
      {wizardStep === 2 && (
        <section className="card space-y-5 p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-white">Flow Builder</h2>
              <p className="text-sm text-slate-400">Design the outreach sequence for each lead.</p>
            </div>
          </div>

          {/* Visual Flow */}
          <div className="space-y-0">
            {/* Start Node */}
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-emerald-500/15 px-5 py-2 text-sm font-bold text-emerald-300">
                🚀 Campaign Start
              </div>
            </div>
            <div className="mx-auto h-6 w-px bg-gradient-to-b from-emerald-500/30 to-brand-500/30" />

            {flowSteps.map((step, i) => {
              const actionMeta = ACTIONS.find((a) => a.value === step.action);
              const isWait = step.action === "wait";
              const isCheck = step.action.startsWith("check_");

              return (
                <div key={step.id}>
                  <div className={`relative rounded-xl border p-4 transition hover:border-brand-500/30 ${
                    isCheck ? "border-sky-500/30 bg-sky-500/5" : isWait ? "border-amber-500/30 bg-amber-500/5" : "border-white/8 bg-ink-800/50"
                  }`}>
                    <div className="flex items-start gap-3">
                      {/* Step number */}
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${actionMeta?.color ?? "from-slate-500 to-slate-600"} text-sm font-extrabold text-white`}>
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {actionMeta?.icon} {actionMeta?.label}
                          </span>
                          {(isWait || isCheck) && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-400">
                              {isWait ? "for" : ""}
                              <input
                                type="number"
                                min={0}
                                value={step.daysAfter}
                                onChange={(e) => updateStep(step.id, { daysAfter: Number(e.target.value) || 0 })}
                                className="input w-16 py-1 text-center text-xs"
                              />
                              {isWait ? "days" : ""}
                            </label>
                          )}
                        </div>

                        {/* Template editor for message/follow_up */}
                        {(step.action === "message" || step.action === "follow_up" || step.action === "connect") && (
                          <div className="mt-2">
                            <div className="mb-1.5 flex flex-wrap gap-1">
                              {VARIABLES.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVariable(step.id, v)}
                                  className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-brand-300 transition hover:bg-brand-600/20"
                                >
                                  {v}
                                </button>
                              ))}
                              <span className="ml-2 text-[10px] text-slate-600">
                                {step.template.length}/300 chars
                              </span>
                            </div>
                            <textarea
                              value={step.template}
                              onChange={(e) => updateStep(step.id, { template: e.target.value })}
                              rows={3}
                              placeholder={
                                step.action === "connect"
                                  ? "Connection request note (optional)..."
                                  : "Write your message..."
                              }
                              className="input resize-y font-mono text-xs"
                            />
                          </div>
                        )}

                        {/* Condition display for check steps */}
                        {isCheck && (
                          <div className="mt-2 rounded-lg bg-white/5 p-3 text-xs text-slate-400">
                            {step.action === "check_connection"
                              ? "→ If accepted: continue to next step"
                              : "→ If replied: STOP campaign | If no reply: continue"}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                          title="Remove step"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Connector + Add Step Button */}
                  <div className="flex items-center justify-center">
                    <div className="h-4 w-px bg-gradient-to-b from-white/10 to-white/10" />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-white/5" />
                    <div className="flex gap-1">
                      {ACTIONS.filter((a) => !["wait", "check_connection", "check_reply"].includes(a.value))
                        .slice(0, 3)
                        .map((a) => (
                          <button
                            key={a.value}
                            type="button"
                            onClick={() => addStep(i, a.value)}
                            className="rounded-full border border-dashed border-white/10 px-2.5 py-1 text-[10px] text-slate-500 transition hover:border-brand-400 hover:text-brand-300"
                            title={`Add ${a.label} after step ${i + 1}`}
                          >
                            + {a.icon}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => addStep(i, "wait")}
                        className="rounded-full border border-dashed border-white/10 px-2.5 py-1 text-[10px] text-slate-500 transition hover:border-amber-400 hover:text-amber-300"
                        title="Add Wait"
                      >
                        + ⏱
                      </button>
                    </div>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                </div>
              );
            })}

            {/* End Node */}
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-slate-500/15 px-5 py-2 text-sm font-bold text-slate-400">
                🏁 End
              </div>
            </div>
          </div>

          {/* Quick templates */}
          <div className="rounded-xl border border-white/8 bg-ink-800/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick Templates</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFlowSteps([
                  { id: newStepId(), action: "connect", daysAfter: 0, template: "Hi {{first_name}}, I noticed you're at {{company}}. Would love to connect!" },
                  { id: newStepId(), action: "wait", daysAfter: 3, template: "" },
                  { id: newStepId(), action: "check_connection", daysAfter: 0, template: "" },
                  { id: newStepId(), action: "message", daysAfter: 0, template: "Thanks for connecting, {{first_name}}! How's everything at {{company}}?" },
                ])}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand-400 hover:text-white"
              >
                Simple Connect + Message
              </button>
              <button
                type="button"
                onClick={() => setFlowSteps([
                  { id: newStepId(), action: "connect", daysAfter: 0, template: "Hi {{first_name}}, saw your work at {{company}} in {{industry}}. Let's connect!" },
                  { id: newStepId(), action: "wait", daysAfter: 5, template: "" },
                  { id: newStepId(), action: "check_connection", daysAfter: 0, template: "" },
                  { id: newStepId(), action: "message", daysAfter: 0, template: "Hi {{first_name}}, thanks for accepting! I'm curious how {{company}} approaches growth in {{industry}}." },
                  { id: newStepId(), action: "wait", daysAfter: 4, template: "" },
                  { id: newStepId(), action: "check_reply", daysAfter: 0, template: "" },
                  { id: newStepId(), action: "follow_up", daysAfter: 0, template: "Hey {{first_name}}, just bumping this up — would love to chat if you're open to it." },
                ])}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand-400 hover:text-white"
              >
                3-Touch Sequence
              </button>
            </div>
          </div>
        </section>
      )}

      <input type="hidden" name="steps" value={stepsJson} />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {wizardStep > 0 && (
            <button
              type="button"
              onClick={() => setWizardStep((s) => s - 1)}
              className="btn-ghost px-4 py-2"
            >
              ← Previous
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/app/campaigns" className="btn-ghost px-4 py-2">
            Cancel
          </Link>
          {wizardStep < 2 ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => s + 1)}
              disabled={!isStepValid(wizardStep)}
              className="btn-primary px-5 py-2"
            >
              Next Step →
            </button>
          ) : (
            <button type="submit" disabled={pending} className="btn-primary px-6 py-2.5">
              {pending ? "Creating…" : "🚀 Create & Launch Campaign"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
