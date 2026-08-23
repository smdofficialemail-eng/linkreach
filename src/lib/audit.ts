/**
 * Audit logging — records all sensitive operations for compliance and security.
 *
 * Every action that modifies data, accesses credentials, or performs outreach
 * is logged with timestamps, user context, and metadata.
 */

import { prisma } from "./db";

export type AuditEventType =
  | "auth.login"
  | "auth.login_failed"
  | "auth.register"
  | "auth.logout"
  | "linkedin.oauth_connected"
  | "linkedin.session_saved"
  | "linkedin.session_expired"
  | "linkedin.credentials_saved"
  | "campaign.created"
  | "campaign.launched"
  | "campaign.paused"
  | "campaign.deleted"
  | "outreach.search"
  | "outreach.connection_sent"
  | "outreach.message_sent"
  | "outreach.bulk_action"
  | "lead.created"
  | "lead.deleted"
  | "lead.status_changed"
  | "template.created"
  | "template.deleted"
  | "blacklist.added"
  | "blacklist.removed"
  | "settings.changed"
  | "member.invited"
  | "member.removed"
  | "job.processed"
  | "job.failed"
  | "security.csrf_blocked"
  | "security.rate_limited"
  | "security.unauthorized_access";

interface AuditLogOptions {
  workspaceId?: string;
  userId?: string;
  eventType: AuditEventType;
  message: string;
  metadata?: Record<string, unknown>;
  severity?: "info" | "warning" | "critical";
  ipAddress?: string;
}

/**
 * Create an immutable audit log entry.
 */
export async function auditLog(options: AuditLogOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: options.workspaceId || "system",
        type: options.severity || "info",
        message: `[${options.eventType}] ${options.message}${options.userId ? ` (user: ${options.userId})` : ""}`,
        meta: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
      },
    });
  } catch (error) {
    // Never let audit logging failures crash the app
    console.error("[Audit] Failed to write audit log:", error);
  }
}

/**
 * Log authentication events.
 */
export async function auditAuth(
  eventType: "auth.login" | "auth.login_failed" | "auth.register" | "auth.logout",
  userId: string,
  email: string,
  ipAddress?: string
) {
  const severityMap: Record<string, "info" | "warning" | "critical"> = {
    "auth.login": "info",
    "auth.login_failed": "warning",
    "auth.register": "info",
    "auth.logout": "info",
  };

  await auditLog({
    eventType,
    message: `${eventType.replace("auth.", "")} for ${email}`,
    userId,
    severity: severityMap[eventType],
    ipAddress,
    metadata: { email },
  });
}

/**
 * Log credential access events.
 */
export async function auditCredentialAccess(
  workspaceId: string,
  userId: string,
  action: "save" | "access" | "expire",
  accountName: string,
  credentialType: "oauth" | "session_cookie" | "password"
) {
  await auditLog({
    workspaceId,
    userId,
    eventType: action === "save" ? "linkedin.session_saved" : "linkedin.session_expired",
    message: `LinkedIn ${credentialType} ${action}ed for "${accountName}"`,
    severity: action === "expire" ? "warning" : "info",
    metadata: { accountName, credentialType, action },
  });
}

/**
 * Log outreach actions.
 */
export async function auditOutreach(
  workspaceId: string,
  eventType: AuditEventType,
  message: string,
  metadata?: Record<string, unknown>
) {
  await auditLog({
    workspaceId,
    eventType,
    message,
    severity: "info",
    metadata,
  });
}

/**
 * Log security events.
 */
export async function auditSecurity(
  eventType: "security.csrf_blocked" | "security.rate_limited" | "security.unauthorized_access",
  details: string,
  ipAddress?: string,
  workspaceId?: string
) {
  await auditLog({
    workspaceId,
    eventType,
    message: details,
    severity: "critical",
    ipAddress,
  });
}
