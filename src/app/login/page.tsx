"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/auth-actions";
import { BrandPanel } from "@/components/brand-panel";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center bg-ink-900 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-400">
              Log in to run your LinkedIn outreach.
            </p>
          </div>

          {state?.error && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {state.error}
            </p>
          )}

          <form action={action} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="input" />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="input" />
            </div>
            <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2.5">
              {pending ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New here?{" "}
            <Link href="/register" className="font-bold text-brand-400 hover:text-brand-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
