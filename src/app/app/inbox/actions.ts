"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/app";

export async function sendReply(conversationId: string, formData: FormData) {
  const { workspace } = await requireWorkspace();
  const body = z.string().min(1, "Message can't be empty").safeParse(formData.get("body"));
  if (!body.success) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, workspaceId: workspace.id },
  });
  if (!conversation) return;

  const now = new Date();
  await prisma.message.create({
    data: {
      conversationId,
      direction: "out",
      body: body.data,
      status: "sent",
      sentAt: now,
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now },
  });

  revalidatePath(`/app/inbox?lead=${conversation.leadId}`);
  revalidatePath("/app/inbox");
}
