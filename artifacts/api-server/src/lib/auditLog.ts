import { getDb } from "../db";
import { logger } from "./logger";

interface AuditEntryBase {
  accountId: number;
  actorEmail?: string | null;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
  /** Caller IP address — stored for SOC 2 CC7.2 access-event traceability. */
  ip?: string | null;
}

export interface AuditLogMetadataMap {
  // ── Team ──────────────────────────────────────────────────────────────────
  "team.invite":               { role: string };
  "team.remove":               { role: string };
  "team.role_change":          { from_role: string; to_role: string };
  // ── API Keys ───────────────────────────────────────────────────────────────
  "apikey.create":             Record<string, never>;
  "apikey.revoke":             Record<string, never>;
  "apikey.rename":             Record<string, never>;
  // ── Branding ──────────────────────────────────────────────────────────────
  "branding.update_name":      { from: string; to: string };
  "branding.update_color":     { from: string; to: string };
  "branding.upload_logo":      Record<string, never>;
  "branding.remove_logo":      Record<string, never>;
  "branding.upload_form_logo": Record<string, never>;
  "branding.remove_form_logo": Record<string, never>;
  // ── Billing ───────────────────────────────────────────────────────────────
  "plan.checkout_initiated":   { plan: string; interval: string; extra_seats: string; extra_submission_packs: string };
  "plan.change":               { from_plan: string; to_plan: string; status: string; event_type: string };
  // ── Settings ──────────────────────────────────────────────────────────────
  "email_settings.update":     { senderName: string | null; replyTo: string | null; footerLength: number };
  "interview_defaults.update": { linkExpiryDays: number | null; reminderEnabled: boolean; reminderDays: number; defaultLocale: string };
  "settings.update_locale":    { timezone: string; dateFormat: string };
  // ── Data & Retention ──────────────────────────────────────────────────────
  "data.update_retention":     { submissionRetentionDays: number | null };
  "data.export_requested":     Record<string, never>;
  "data.deletion_requested":   { graceWindowDays: number; stripeCancelled?: boolean };
  "data.deletion_cancelled":   Record<string, never>;
  // ── Security ──────────────────────────────────────────────────────────────
  "security.2fa_enabled":             Record<string, never>;
  "security.2fa_disabled":            Record<string, never>;
  "security.session_revoked":         Record<string, never>;
  "security.trusted_device_revoked":  Record<string, never>;
  // ── Custom Domain ─────────────────────────────────────────────────────────
  "custom_domain.set":         Record<string, never>;
  "custom_domain.verify":      { status: string; cnames: string[] };
  // ── Authentication (CC6.1 / CC7.2) ────────────────────────────────────────
  "auth.login":                { method: string };
  "auth.login_failed":         { reason?: string };
  // ── Integrations (CC9.2) ──────────────────────────────────────────────────
  "integration.connect":       { provider: string };
  "integration.disconnect":    { provider: string };
  // ── Field Library (CC6.1) ─────────────────────────────────────────────────
  "field.create":              { fieldType: string };
  "field.update":              { fieldType: string };
  "field.delete":              Record<string, never>;
}

type KnownAuditAction = keyof AuditLogMetadataMap;

type AuditEntryFor<A extends KnownAuditAction> =
  AuditLogMetadataMap[A] extends Record<string, never>
    ? AuditEntryBase & { action: A; metadata?: Record<string, never> }
    : AuditEntryBase & { action: A; metadata: AuditLogMetadataMap[A] };

export type AuditEntry = { [A in KnownAuditAction]: AuditEntryFor<A> }[KnownAuditAction];

export interface AuditLogOptions {
  /**
   * When true, a DB write failure causes the function to re-throw instead of
   * swallowing the error. Use for security-sensitive events (API key
   * create/revoke, session revocation, 2FA changes) where a missing audit
   * record would violate SOC 2 CC7.2 audit trail integrity requirements.
   * The calling route's outer try/catch will then return a 500 to the client
   * rather than silently completing without a record.
   */
  critical?: boolean;
}

export async function insertAuditLog(entry: AuditEntry, options?: AuditLogOptions): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO org_audit_log
         (account_id, actor_email, actor_user_id, action, resource_type, resource_id, resource_label, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.accountId,
        entry.actorEmail ?? null,
        entry.actorUserId ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.resourceLabel ?? null,
        JSON.stringify(entry.metadata ?? {}),
        entry.ip ?? null,
      ],
    );
  } catch (err) {
    if (options?.critical) {
      logger.error({ err, action: entry.action }, "[AuditLog] Failed to write critical audit entry — aborting request");
      throw err;
    }
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

/** Extract the caller IP from a request, preferring x-forwarded-for (Railway/proxy). */
export function extractIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(",")[0]?.trim() ?? null;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
