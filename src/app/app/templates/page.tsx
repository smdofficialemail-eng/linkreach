import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { createTemplate, deleteTemplate } from "./actions";

export const metadata = { title: "Templates — LinkReach" };

const CATEGORIES = [
  { value: "connection_note", label: "Connection Notes", icon: "🤝" },
  { value: "first_message", label: "First Messages", icon: "💬" },
  { value: "follow_up", label: "Follow-ups", icon: "🔄" },
  { value: "breakup", label: "Breakup Messages", icon: "👋" },
];

const VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{company}}",
  "{{job_title}}",
  "{{location}}",
  "{{industry}}",
];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { category } = await searchParams;

  const templates = await prisma.template.findMany({
    where: {
      workspaceId: workspace.id,
      ...(category ? { category } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Templates
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Reusable messages for connection requests, follow-ups, and more.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href="/app/templates"
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            !category
              ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/25"
              : "border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
          }`}
        >
          All ({templates.length})
        </a>
        {CATEGORIES.map((cat) => (
          <a
            key={cat.value}
            href={`/app/templates?category=${cat.value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              category === cat.value
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/25"
                : "border border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
            }`}
          >
            {cat.icon} {cat.label}
          </a>
        ))}
      </div>

      {/* Template Cards */}
      {templates.length === 0 ? (
        <div className="card p-16 text-center shadow-card">
          <p className="font-extrabold text-slate-300">No templates yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create templates to reuse your best outreach messages.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const catMeta = CATEGORIES.find((c) => c.value === t.category);
            return (
              <div
                key={t.id}
                className="card p-5 shadow-card transition hover:border-brand-500/30"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{catMeta?.icon ?? "📝"}</span>
                      <p className="text-sm font-extrabold text-white">
                        {t.name}
                      </p>
                    </div>
                    <span className="mt-1 inline-block rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                      {catMeta?.label ?? t.category}
                    </span>
                  </div>
                  <form action={deleteTemplate.bind(null, t.id)}>
                    <button
                      type="submit"
                      className="text-slate-600 hover:text-red-400"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </form>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300 line-clamp-4">
                  {t.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {VARIABLES.filter((v) => t.content.includes(v)).map((v) => (
                    <span
                      key={v}
                      className="rounded bg-brand-600/15 px-2 py-0.5 text-[11px] font-mono text-brand-300"
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-600">
                  Updated {t.updatedAt.toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Template Form */}
      <form action={createTemplate} className="card mt-6 space-y-4 p-6 shadow-card">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
          Create Template
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Template Name *</label>
            <input
              name="name"
              required
              placeholder="e.g. SaaS Founder Connection"
              className="input"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select name="category" className="input" defaultValue="connection_note">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Content *</label>
          <textarea
            name="content"
            required
            rows={4}
            placeholder="Hi {{first_name}}, I noticed you're working at {{company}}..."
            className="input resize-none"
          />
          <p className="mt-1 text-[11px] text-slate-600">
            Variables: {VARIABLES.join(", ")}
          </p>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-5 py-2">
            Save Template
          </button>
        </div>
      </form>
    </div>
  );
}
