"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  headline: z.string().nullish(),
  company: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  location: z.string().nullish(),
  email: z.string().email("Enter a valid email").or(z.literal("")).nullish(),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
  listId: z.string().nullish(),
  source: z.string().default("manual"),
});

export async function createLead(prev: unknown, formData: FormData) {
  const { workspace } = await requireWorkspace();
  const parsed = leadSchema.safeParse({
    name: formData.get("name"),
    headline: formData.get("headline"),
    company: formData.get("company"),
    linkedinUrl: formData.get("linkedinUrl"),
    location: formData.get("location"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    listId: formData.get("listId") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const listId = parsed.data.listId ?? null;
  if (listId) {
    const list = await prisma.list.findFirst({ where: { id: listId, workspaceId: workspace.id } });
    if (!list) return { error: "List not found" };
  }

  await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      name: parsed.data.name,
      headline: parsed.data.headline || null,
      company: parsed.data.company || null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      location: parsed.data.location || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      source: "manual",
      listId,
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      type: "imported",
      message: `Added ${parsed.data.name} to leads`,
    },
  });

  revalidatePath("/app/leads");
  redirect("/app/leads");
}

export async function importCsvLeads(prev: unknown, formData: FormData): Promise<{ ok: boolean; count: number; error?: string }> {
  const { workspace } = await requireWorkspace();
  const raw = String(formData.get("csv") ?? "");
  const listId = String(formData.get("listId") ?? "") || null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = lines.slice(1).map((line) => {
    // naive CSV split honoring quotes
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });

  const created = [];
  for (const cells of rows) {
    const name = cells[0];
    if (!name) continue;
    created.push(
      await prisma.lead.create({
        data: {
          workspaceId: workspace.id,
          name,
          headline: cells[2] || null,
          company: cells[3] || null,
          linkedinUrl: cells[4] || null,
          location: cells[5] || null,
          email: cells[6] || null,
          phone: cells[7] || null,
          source: "csv",
          listId,
        },
      })
    );
  }

  await prisma.activityLog.create({
    data: {
      workspaceId: workspace.id,
      type: "imported",
      message: `Imported ${created.length} leads from CSV`,
      meta: { count: created.length },
    },
  });

  revalidatePath("/app/leads");
  return { ok: true, count: created.length };
}

export async function deleteLead(leadId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.lead.deleteMany({ where: { id: leadId, workspaceId: workspace.id } });
  revalidatePath("/app/leads");
}

export async function updateLeadStatus(leadId: string, status: string) {
  const { workspace } = await requireWorkspace();
  await prisma.lead.updateMany({
    where: { id: leadId, workspaceId: workspace.id },
    data: { status },
  });
  revalidatePath("/app/leads");
}
