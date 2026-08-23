"use server";

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export async function createTemplate(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = formData.get("name") as string;
  const content = formData.get("content") as string;
  const category = (formData.get("category") as string) || "connection_note";

  if (!name || !content) return;

  await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name,
      content,
      category,
    },
  });
}

export async function deleteTemplate(id: string) {
  const { workspace } = await requireWorkspace();

  await prisma.template.deleteMany({
    where: { id, workspaceId: workspace.id },
  });
}
