import { getDb } from "../db";
import { logger } from "./logger";

export interface AuditEntry {
  accountId: number;
  actorEmail?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceLabel?: string | null;
  metadata?: Record<string, unknown>;
}

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
