import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Current session user, or null. */
export const getSession = cache(async () => {
  const session = await auth();
  return session;
});

/** The current user's first workspace (multi-workspace switching comes later). */
export async function requireWorkspace() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });
  if (!membership) redirect("/login");

  return { user: session.user, workspace: membership.workspace, role: membership.role };
}
