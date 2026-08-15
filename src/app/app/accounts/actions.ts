"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export async function createAccount(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = z.string().min(1, "Profile name is required").safeParse(formData.get("name"));
  if (!name.success) return;

  await prisma.linkedinAccount.create({
    data: {
      workspaceId: workspace.id,
      name: name.data,
      headline: String(formData.get("headline") ?? "") || null,
      profileUrl: String(formData.get("profileUrl") ?? "") || null,
    },
  });
  revalidatePath("/app/accounts");
}

export async function toggleAccount(accountId: string) {
  const { workspace } = await requireWorkspace();
  const account = await prisma.linkedinAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id },
  });
  if (!account) return;
  await prisma.linkedinAccount.update({
    where: { id: accountId },
    data: { status: account.status === "active" ? "paused" : "active" },
  });
  revalidatePath("/app/accounts");
}

export async function deleteAccount(accountId: string) {
  const { workspace } = await requireWorkspace();
  await prisma.linkedinAccount.deleteMany({
    where: { id: accountId, workspaceId: workspace.id },
  });
  revalidatePath("/app/accounts");
}
