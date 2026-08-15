import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";
import { LeadForm } from "./lead-form";

export const metadata = { title: "Add lead — LinkReach" };

export default async function NewLeadPage() {
  const { workspace } = await requireWorkspace();
  const lists = await prisma.list.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/app/leads" className="text-sm font-bold text-brand-400 hover:text-brand-300">
          ← Back to leads
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Add a lead</h1>
        <p className="mt-1 text-sm text-slate-400">Add a prospect to your outreach database.</p>
      </div>
      <LeadForm lists={lists.map((l) => ({ id: l.id, name: l.name }))} />
    </div>
  );
}
