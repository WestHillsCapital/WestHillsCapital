/**
 * PDF audit trail — fire-and-forget event recording.
 *
 * Schema is intentionally extensible: `event_type` and `actor_type` are open
 * TEXT columns so e-sign events ('signature_requested', 'signed', 'declined')
 * and additional actors ('signer', 'notary') slot in without a migration.
 *
 * Every write is non-fatal: audit failures are logged but never propagate to
 * the caller, so a DB hiccup cannot break a PDF download or generation.
 */

import { getDb } from "../db";
import { logger } from "./logger";
import type { Request } from "express";

export type PdfAuditEventType =
  | "generated"
  | "downloaded"
  | "signature_requested"
  | "signed"
  | "declined"
  | string; // forward-compatible

export type PdfAuditActorType =
  | "staff"
  | "client"
  | "system"
  | "api"
  | "signer"
  | string; // forward-compatible

export interface PdfAuditEventParams {
  accountId:    number;
  sessionToken: string;
  eventType:    PdfAuditEventType;
  actorType:    PdfAuditActorType;
  actorEmail?:  string | null;
  actorIp?:     string | null;
  actorUa?:     string | null;
  metadata?:    Record<string, unknown>;
}

/**
 * Record a PDF lifecycle event.
 * Always resolves — never throws.
 */
export async function recordPdfAuditEvent(params: PdfAuditEventParams): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO pdf_audit_events
         (account_id, session_token, event_type, actor_type, actor_email, actor_ip, actor_ua, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.accountId,
        params.sessionToken,
        params.eventType,
        params.actorType,
        params.actorEmail   ?? null,
        params.actorIp      ?? null,
        params.actorUa      ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
  } catch (err) {
    logger.error(
      { err, sessionToken: params.sessionToken, eventType: params.eventType },
      "[PdfAudit] Failed to record audit event (non-fatal)",
    );
  }
}

/** Convenience: extract actor IP and user-agent from an Express request. */
export function actorContextFromRequest(req: Request): {
  actorIp: string | null;
  actorUa: string | null;
} {
  return {
    actorIp: req.ip ?? req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? null,
    actorUa: req.headers["user-agent"] ?? null,
  };
}
