import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signWorkspaceToken } from "@/lib/extension";

/**
 * POST /api/extension/pair
 * Body: { code: "ABCD1234", browser: "Chrome — MacBook" }
 * Exchanges a workspace pairing code for a signed token the extension stores.
 */
export async function POST(req: NextRequest) {
  let body: { code?: string; browser?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Pairing code is required" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({ where: { extensionCode: code } });
  if (!workspace) {
    return NextResponse.json({ error: "Invalid pairing code" }, { status: 404 });
  }

  // A code is single-use by design: pairing invalidates it so a leaked
  // code can't be reused. Re-pairing generates a fresh code.
  const browser = String(body.browser ?? "Browser").slice(0, 80);
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      extensionCode: null,
      extensionName: browser,
      extensionPairedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    token: signWorkspaceToken(workspace.id),
    workspaceName: workspace.name,
  });
}
