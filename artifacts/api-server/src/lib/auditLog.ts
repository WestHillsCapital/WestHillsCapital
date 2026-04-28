import { getDb } from "../db";
import { logger } from "./logger";

interface AuditEntryBase {
  accountId: number;
  actorEmail?: string | null;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
}

export interface AuditLogMetadataMap {
  "team.invite":               { role: string };
  "team.remove":               { role: string };
  "team.role_change":          { from_role: string; to_role: string };
  "apikey.create":             Record<string, never>;
  "apikey.revoke":             Record<string, never>;
  "apikey.rename":             Record<string, never>;
  "branding.update_name":      { from: string; to: string };
  "branding.update_color":     { from: string; to: string };
  "branding.upload_logo":      Record<string, never>;
  "branding.remove_logo":      Record<string, never>;
  "plan.checkout_initiated":   { plan: string };
  "plan.change":               { from_plan: string; to_plan: string; status: string; event_type: string };
  "email_settings.update":     { senderName: string | null; replyTo: string | null; footerLength: number };
  "interview_defaults.update": { linkExpiryDays: number | null; reminderEnabled: boolean; reminderDays: number; defaultLocale: string };
  "settings.update_locale":    { timezone: string; dateFormat: string };
  "data.update_retention":     { submissionRetentionDays: number | null };
  "data.export_requested":     Record<string, never>;
  "data.deletion_requested":   { graceWindowDays: number };
  "data.deletion_cancelled":   Record<string, never>;
  "security.2fa_enabled":      Record<string, never>;
  "security.2fa_disabled":     Record<string, never>;
  "security.session_revoked":  Record<string, never>;
  "custom_domain.set":         Record<string, never>;
  "custom_domain.verify":      { status: string; cnames: string[] };
}

type KnownAuditAction = keyof AuditLogMetadataMap;

type AuditEntryFor<A extends KnownAuditAction> =
  AuditLogMetadataMap[A] extends Record<string, never>
    ? AuditEntryBase & { action: A; metadata?: Record<string, never> }
    : AuditEntryBase & { action: A; metadata: AuditLogMetadataMap[A] };

export type AuditEntry = { [A in KnownAuditAction]: AuditEntryFor<A> }[KnownAuditAction];

export async function insertAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO org_audit_log
         (account_id, actor_email, actor_user_id, action, resource_type, resource_id, resource_label, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.accountId,
        entry.actorEmail ?? null,
        entry.actorUserId ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.resourceLabel ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.warn({ err }, "[AuditLog] Failed to write audit entry (non-fatal)");
  }
}

export async function getActorEmail(
  accountId: number,
  clerkUserId: string | null | undefined,
): Promise<string | null> {
  if (!clerkUserId) return null;
  try {
    const { rows } = await getDb().query<{ email: string }>(
      `SELECT email FROM account_users WHERE account_id = $1 AND clerk_user_id = $2 LIMIT 1`,
      [accountId, clerkUserId],
    );
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}
