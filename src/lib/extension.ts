import crypto from "crypto";

/**
 * Helpers shared by the extension API routes and the app.
 * The browser extension pairs to a workspace with a short-lived code,
 * then authenticates with an HMAC-signed workspace token.
 */

export function generatePairingCode(): string {
  // 8 chars from a human-friendly alphabet (no 0/O/1/I/L)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export function signWorkspaceToken(workspaceId: string): string {
  const secret = process.env.AUTH_SECRET ?? "linkreach-dev-secret";
  const sig = crypto.createHmac("sha256", secret).update(workspaceId).digest("hex");
  return `${workspaceId}.${sig}`;
}

export function verifyWorkspaceToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [workspaceId, sig] = parts;
  const expected = crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "linkreach-dev-secret")
    .update(workspaceId)
    .digest("hex");
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return workspaceId;
}

const VARIABLE_FNS: Record<string, (lead: Record<string, unknown>) => string> = {
  first_name: (l) => String(l.name ?? "").split(" ")[0] ?? "",
  last_name: (l) => String(l.name ?? "").split(" ").slice(1).join(" ") ?? "",
  full_name: (l) => String(l.name ?? ""),
  company: (l) => String(l.company ?? ""),
  headline: (l) => String(l.headline ?? ""),
  location: (l) => String(l.location ?? ""),
  email: (l) => String(l.email ?? ""),
  phone: (l) => String(l.phone ?? ""),
  linkedin_url: (l) => String(l.linkedinUrl ?? ""),
};

/** Fill {variable} placeholders in a template from a lead's fields. */
export function resolveTemplate(template: string | null | undefined, lead: Record<string, unknown>): string {
  if (!template) return "";
  return template.replace(/\{([a-z_]+)\}/g, (match, name: string) => {
    const fn = VARIABLE_FNS[name];
    return fn ? fn(lead) : match;
  });
}
