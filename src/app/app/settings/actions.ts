"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export async function updateWorkspace(formData: FormData) {
  const { workspace } = await requireWorkspace();
  const name = z.string().min(1, "Workspace name is required").safeParse(formData.get("name"));
  const mode = z.enum(["simulation", "extension", "api"]).safeParse(formData.get("deliveryMode"));
  if (!name.success) return;
  if (!mode.success) return;

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { name: name.data, deliveryMode: mode.data },
  });
  revalidatePath("/app/settings");
}
