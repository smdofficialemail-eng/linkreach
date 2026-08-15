import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { CampaignForm } from "./campaign-form";

export const metadata = { title: "New campaign — LinkReach" };

export default async function NewCampaignPage() {
  const { workspace } = await requireWorkspace();
  const accounts = await prisma.linkedinAccount.findMany({
    where: { workspaceId: workspace.id, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/app/campaigns" className="text-sm font-bold text-brand-400 hover:text-brand-300">
          ← Back to campaigns
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">New campaign</h1>
        <p className="mt-1 text-sm text-slate-400">
          Build a sequence of connection requests, messages and follow-ups.
        </p>
      </div>
      <CampaignForm accounts={accounts.map((a) => ({ id: a.id, name: a.name, headline: a.headline }))} />
    </div>
  );
}
