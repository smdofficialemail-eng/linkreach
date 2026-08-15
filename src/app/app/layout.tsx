import { requireWorkspace } from "@/lib/app";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user } = await requireWorkspace();

  return (
    <AppShell
      workspaceName={workspace.name}
      userName={user.name ?? "User"}
      userInitial={(user.name ?? "U").charAt(0).toUpperCase()}
      workspaceInitial={workspace.name.charAt(0).toUpperCase()}
    >
      {children}
    </AppShell>
  );
}
