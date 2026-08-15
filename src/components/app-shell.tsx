"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/auth-actions";

const NAV = [
  {
    section: "Workspace",
    items: [
      { href: "/app", label: "Dashboard", icon: "◧" },
      { href: "/app/campaigns", label: "Campaigns", icon: "⇶" },
      { href: "/app/leads", label: "Leads", icon: "▤" },
      { href: "/app/inbox", label: "Inbox", icon: "✉" },
      { href: "/app/accounts", label: "Accounts", icon: "◉" },
      { href: "/app/analytics", label: "Analytics", icon: "◔" },
    ],
  },
  {
    section: "Other",
    items: [{ href: "/app/settings", label: "Settings", icon: "⚙" }],
  },
];

export function AppShell({
  children,
  workspaceName,
  userName,
  userInitial,
  workspaceInitial,
}: {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userInitial: string;
  workspaceInitial: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900/90">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-white shadow-md shadow-brand-600/30">
          L
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-white">LinkReach</p>
          <p className="text-[11px] text-slate-500">Outreach automation</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-gradient-to-r from-brand-600/90 to-brand-500/70 text-white shadow-md shadow-brand-600/20"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    <span className="w-5 text-center">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="rounded-xl bg-ink-800/70 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600/25 text-sm font-extrabold text-brand-300">
              {workspaceInitial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-200">{workspaceName}</p>
              <p className="text-[11px] text-slate-500">Growth workspace</p>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl px-2 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-extrabold text-slate-300">
              {userInitial}
            </span>
            <p className="truncate text-xs font-semibold text-slate-300">{userName}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              title="Log out"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</aside>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-ink-900/80 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-extrabold text-white">
          L
        </span>
        <p className="truncate text-sm font-extrabold text-white">{workspaceName}</p>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:pl-[17rem] lg:pr-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
