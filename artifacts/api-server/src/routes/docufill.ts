import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { PDFDocument as PdfLibDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import PDFDocument from "pdfkit";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import {
  buildDocuFillFallbackSummaryRows,
  buildDocuFillPacketSummary,
  fieldAnswerValue,
  formatDocuFillMappedValue,
  hydratePackageFields,
  parseDocuFillFields as parseFields,
  type DocuFillFieldCondition,
  type DocuFillFieldItem,
} from "../lib/docufill-redaction";
import { saveDocuFillPacketToDrive } from "../lib/google-drive";
import { uploadSessionPdfToAccountDrive } from "../lib/google-drive-account";
import { upsertHubSpotContact, extractHubSpotProperties } from "../lib/hubspot-account";
import {
  sendInterviewLinkEmail,
  sendDocupleteStaffSubmissionEmail,
  sendDocupleteClientConfirmationEmail,
  getOrgEmailSettings,
} from "../lib/email";
import { getUserEmailsToNotify, sendInAppNotifications } from "../lib/notificationPrefs";
import { requireAdminRole, requireRole } from "../middleware/requireRole";
import { requireWithinPlanLimits, recordSubmissionEvent, recordPdfGenerationEvent } from "../middleware/requireWithinPlanLimits";
import { recordPdfAuditEvent, actorContextFromRequest } from "../lib/pdf-audit";
import {
  getOrCreateAccountDek,
  encryptAnswers,
  decryptAnswers,
  isEncryptionEnabled,
} from "../lib/encryption";
const requireMemberRole = requireRole("member");

const router: IRouter = Router();
export const publicDocufillRouter: IRouter = Router();

/**
 * API-key-authenticated public developer router.
 * Mounted at /api/v1/packages — requires requireApiKeyAuth + requireAccountId
 * upstream in index.ts.
 */
export const apiKeyDocufillRouter: IRouter = Router();

apiKeyDocufillRouter.get("/:id/webhook-deliveries", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid package id" }); return; }
    const accountId = acctId(req);

    const rawLimit  = parseInt(String(req.query["limit"]  ?? "50"), 10);
    const rawOffset = parseInt(String(req.query["offset"] ?? "0"),  10);
    const limit     = Number.isFinite(rawLimit)  && rawLimit  > 0 ? Math.min(rawLimit, 200) : 50;
    const offset    = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const db = getDb();
    const { rows: owned } = await db.query(
      `SELECT id FROM docufill_packages WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
    if (!owned[0]) { res.status(404).json({ error: "Package not found" }); return; }

    const [{ rows }, { rows: countRows }] = await Promise.all([
      db.query(
        `SELECT id, event_type, attempt_number, http_status, response_body, duration_ms, created_at,
                (payload_json IS NOT NULL) AS has_payload
           FROM webhook_deliveries
          WHERE package_id = $1 AND account_id = $2
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4`,
        [id, accountId, limit, offset],
      ),
      db.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM webhook_deliveries WHERE package_id = $1 AND account_id = $2`,
        [id, accountId],
      ),
    ]);

    res.json({
      deliveries: rows,
      total:  parseInt(countRows[0]?.total ?? "0", 10),
      limit,
      offset,
    });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to fetch webhook deliveries (API key)");
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});
const MAX_PACKAGE_PDF_BYTES = 100 * 1024 * 1024;
const TRANSACTION_SCOPES = new Set(["ira_transfer", "ira_contribution", "ira_distribution", "cash_purchase", "storage_change", "beneficiary_update", "liquidation", "buy_sell_direction", "address_change"]);

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type QueryClient = Pool | PoolClient;
type PackageRow = Record<string, unknown> & { documents?: unknown; fields?: unknown };

class PdfUploadError extends Error {}

type PackageInput = {
  name?: string;
  groupId?: number | null;
  groupIds?: (number | null)[] | null;
  custodianId?: number | null;
  depositoryId?: number | null;
  transactionScope?: string;
  description?: string;
  status?: string;
  documents?: JsonValue;
  fields?: JsonValue;
  mappings?: JsonValue;
  recipients?: JsonValue;
  enableInterview?: boolean;
  enableCsv?: boolean;
  enableCustomerLink?: boolean;
  webhookEnabled?: boolean;
  webhookUrl?: string | null;
  tags?: unknown;
  notifyStaffOnSubmit?: boolean;
  notifyClientOnSubmit?: boolean;
  enableEmbed?: boolean;
  enableGdrive?: boolean;
  enableHubspot?: boolean;
};

type DocItem = {
  id: string;
  title: string;
  pages: number;
  fileName?: string;
  byteSize?: number;
  contentType?: string;
  pdfStored?: boolean;
  pageSizes?: Array<{ width: number; height: number }>;
  uploadedAt?: string;
  updatedAt?: string;
};

type FieldItem = DocuFillFieldItem;

type MappingItem = {
  fieldId?: string;
  documentId?: string;
  page?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  format?: string;
};

type StoredDocumentRow = {
  package_id?: number;
  document_id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  page_count: number;
  page_sizes?: Array<{ width: number; height: number }>;
  pdf_data?: Buffer;
  created_at?: Date | string;
  updated_at?: Date | string;
};

type EntityInput = {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  active?: boolean;
  kind?: string;
};

type TransactionTypeInput = {
  scope?: string;
  label?: string;
  active?: boolean;
  sortOrder?: number;
};

type FieldLibraryInput = {
  id?: string;
  label?: string;
  category?: string;
  type?: string;
  source?: string;
  options?: unknown;
  sensitive?: boolean;
  required?: boolean;
  validationType?: string;
  validationPattern?: string;
  validationMessage?: string;
  active?: boolean;
  sortOrder?: number;
};

type SessionInput = {
  packageId?: number;
  groupId?: number | string | null;
  custodianId?: number | string | null;
  depositoryId?: number | string | null;
  transactionScope?: string | null;
  dealId?: number | null;
  source?: string;
  prefill?: JsonValue;
  testMode?: boolean;
  // Per-session overrides for org interview defaults (Task #285)
  linkExpiryDays?: number | null;
  locale?: string;
  reminderEnabled?: boolean;
  reminderDays?: number;
};

type AnswersInput = {
  answers?: JsonValue;
  status?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTransactionScope(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";
  if (TRANSACTION_SCOPES.has(text)) return text;
  const lower = text.toLowerCase();
  if (lower.includes("contribution")) return "ira_contribution";
  if (lower.includes("distribution")) return "ira_distribution";
  if (lower.includes("cash")) return "cash_purchase";
  if (lower.includes("storage")) return "storage_change";
  if (lower.includes("beneficiary")) return "beneficiary_update";
  if (lower.includes("liquidation")) return "liquidation";
  if (lower.includes("buy") || lower.includes("sell") || lower.includes("direction")) return "buy_sell_direction";
  if (lower.includes("address")) return "address_change";
  if (lower.includes("transfer") || lower.includes("rollover") || lower.includes("ira")) return "ira_transfer";
  if (/^[a-z0-9_]{2,48}$/.test(text)) return text;
  return "";
}

function transactionScopeFromLabel(value: unknown): string {
  const text = cleanText(value).toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return slug || "transaction_type";
}

function fieldLibraryIdFromLabel(value: unknown): string {
  const text = cleanText(value).toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  return slug || `field_${randomBytes(5).toString("hex")}`;
}

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function jsonParam(value: unknown): string {
  if (value === undefined || value === null) return "[]";
  return JSON.stringify(value);
}

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createSessionToken(): string {
  return `df_${randomBytes(32).toString("base64url")}`;
}

function createDocumentId(): string {
  return `doc_${randomBytes(12).toString("base64url")}`;
}

// Assertive account-id accessor — requireAccountId middleware guarantees this is set.
function acctId(req: Request): number {
  const id = req.internalAccountId;
  if (id === undefined || id === null) {
    throw new Error("BUG: acctId() called without resolved account");
  }
  return id;
}

// Strip server-internal fields before returning a session on the public endpoint.
// webhook config, drive references, and internal FK ids are not needed by clients.
function publicSessionView(session: Record<string, unknown>): Record<string, unknown> {
  const {
    webhook_url: _wu,
    webhook_enabled: _we,
    webhook_secret: _ws,  // never expose signing secret to public callers
    generated_pdf_drive_id: _di,
    deal_id: _dl,
    custodian_id: _ci,
    depository_id: _dp,
    group_id: _gi,
    account_id: _ai,
    ...rest
  } = session;
  return rest;
}

// Guard for routes that mutate global tables (field library, transaction types).
// Writes are restricted to internal admin auth; product API keys receive 403.
// requireInternalAuth sets req.internalEmail; requireProductAuth does not.
function isInternalUser(req: Request, res: Response): boolean {
  if (!req.internalEmail) {
    res.status(403).json({ error: "This operation requires internal admin access." });
    return false;
  }
  return true;
}

function parseDocuments(value: unknown): DocItem[] {
  return Array.isArray(value) ? value.filter((item): item is DocItem => {
    return Boolean(item && typeof item === "object" && typeof (item as DocItem).id === "string");
  }) : [];
}

function parseMappings(value: unknown): MappingItem[] {
  return Array.isArray(value) ? value.filter((item): item is MappingItem => {
    return Boolean(item && typeof item === "object");
  }) : [];
}

function parseOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 50);
}

function parseWebhookUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const u = new URL(text);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function buildWebhookPayload(session: Record<string, unknown>): Record<string, unknown> {
  const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
  const fields = Array.isArray(session.fields) ? session.fields as Array<Record<string, unknown>> : [];
  const sensitiveIds = new Set(fields.filter((f) => f.sensitive === true).map((f) => String(f.id ?? "")));
  const redactedAnswers: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(answers)) {
    redactedAnswers[k] = sensitiveIds.has(k) ? "[redacted]" : v;
  }
  return {
    event: "interview.submitted",
    package_id: session.package_id ?? null,
    package_name: session.package_name ?? null,
    token: session.token ?? null,
    submitted_at: new Date().toISOString(),
    answers: redactedAnswers,
  };
}

/** Compute HMAC-SHA256 signature for an outgoing webhook body. */
function signWebhookPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Probe a webhook URL to verify it is reachable and returns 2xx.
 * This is a lightweight pre-save check — no DB side effects.
 *
 * When a `webhookSecret` is supplied the probe payload is signed with
 * `X-Docuplete-Signature` (same header/algorithm as live deliveries)
 * so that webhook servers enforcing signature verification are not
 * incorrectly treated as broken.
 *
 * Returns `{ ok: true }` on success or `{ ok: false, reason: string }` on failure.
 */
async function probeWebhookUrl(
  url: string,
  webhookSecret?: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const probe: Record<string, unknown> = {
    event: "interview.probe",
    message: "Connectivity check — this is not a real submission.",
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(probe);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookSecret) {
    headers["X-Docuplete-Signature"] = signWebhookPayload(webhookSecret, body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: `Webhook URL responded with HTTP ${res.status}. Expected a 2xx response.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Could not reach webhook URL: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Delays (ms) between delivery attempts: 1 s, 4 s, 16 s (exponential backoff). */
const WEBHOOK_RETRY_DELAYS_MS = [1_000, 4_000, 16_000];

/**
 * Execute one HTTP delivery attempt, log the result to webhook_deliveries,
 * and return `true` if the server responded 2xx.
 */
async function doWebhookDelivery(
  db: Pool,
  packageId: number,
  accountId: number,
  webhookUrl: string,
  webhookSecret: string | null,
  body: string,
  attempt: number,
  eventType: string,
  payloadHash: string,
): Promise<boolean> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookSecret) {
    headers["X-Docuplete-Signature"] = signWebhookPayload(webhookSecret, body);
  }
  const start = Date.now();
  let httpStatus: number | null = null;
  let responseSnippet = "";
  let ok = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(webhookUrl, { method: "POST", headers, body, signal: controller.signal });
    httpStatus = res.status;
    responseSnippet = (await res.text().catch(() => "")).slice(0, 1024);
    ok = res.ok;
    if (!ok) logger.warn({ status: res.status, webhookUrl, attempt }, "[DocuFill] Webhook non-2xx");
  } catch (err) {
    responseSnippet = (err instanceof Error ? err.message : String(err)).slice(0, 1024);
    logger.error({ err, webhookUrl, attempt }, "[DocuFill] Webhook request failed");
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - start;
  db.query(
    `INSERT INTO webhook_deliveries
       (package_id, account_id, event_type, payload_hash, attempt_number, http_status, response_body, duration_ms, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [packageId, accountId, eventType, payloadHash, attempt, httpStatus, responseSnippet, durationMs, body],
  ).catch((e) => {
    // Postgres FK violation (23503) on the package_id column means the package
    // was deleted before the retry row could be inserted — this happens in tests
    // when cleanup runs while a scheduled retry is still pending. Suppress it.
    if (e?.code === "23503" && e?.constraint === "webhook_deliveries_package_id_fkey") return;
    logger.error({ e }, "[DocuFill] Failed to log webhook delivery");
  });
  return ok;
}

/**
 * Attempt to deliver a webhook and schedule retries on failure.
 * Retries use exponential backoff defined by WEBHOOK_RETRY_DELAYS_MS (1 s, 4 s, 16 s).
 * Every attempt — including final failures — is recorded in webhook_deliveries.
 */
async function retryWebhookDelivery(
  db: Pool,
  packageId: number,
  accountId: number,
  webhookUrl: string,
  secret: string | null,
  bodyStr: string,
  attempt: number,
  eventType: string,
  payloadHash: string,
): Promise<void> {
  const success = await doWebhookDelivery(
    db, packageId, accountId, webhookUrl, secret, bodyStr, attempt, eventType, payloadHash,
  );
  if (!success) {
    if (attempt <= WEBHOOK_RETRY_DELAYS_MS.length) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempt - 1];
      logger.warn({ packageId, attempt, nextDelayMs: delay }, "[DocuFill] Webhook failed — scheduling retry");
      setTimeout(
        () => void retryWebhookDelivery(db, packageId, accountId, webhookUrl, secret, bodyStr, attempt + 1, eventType, payloadHash),
        delay,
      ).unref();
    } else {
      logger.error({ packageId, webhookUrl, totalAttempts: attempt }, "[DocuFill] Webhook delivery failed after all retries — giving up");
    }
  }
}

/**
 * Fire a signed webhook and retry up to 3 times on failure.
 * Retries use exponential backoff: 1 s, 4 s, 16 s.
 * Every attempt is recorded in webhook_deliveries.
 *
 * The signing secret is fetched directly from the DB here so that
 * no caller ever needs to handle the secret material.
 */
function fireWebhookAsync(
  db: Pool,
  packageId: number,
  accountId: number,
  webhookUrl: string,
  payload: Record<string, unknown>,
  eventType = "interview.submitted",
): void {
  const bodyStr = JSON.stringify(payload);
  const payloadHash = createHash("sha256").update(bodyStr).digest("hex").slice(0, 16);

  setImmediate(async () => {
    // Fetch the signing secret here — keeps secret material out of session/request context.
    // Fail-closed: if the lookup fails or the secret is missing, record a failed attempt
    // and do not send an unsigned delivery.
    let secret: string | null = null;
    try {
      const { rows } = await db.query<{ webhook_secret: string }>(
        `SELECT webhook_secret FROM docufill_packages WHERE id = $1 AND account_id = $2`,
        [packageId, accountId],
      );
      secret = rows[0]?.webhook_secret ?? null;
      if (!secret) throw new Error("webhook_secret is missing or null");
    } catch (err) {
      logger.error({ err, packageId, accountId }, "[DocuFill] Cannot fetch webhook_secret — aborting delivery");
      db.query(
        `INSERT INTO webhook_deliveries
           (package_id, account_id, event_type, payload_hash, attempt_number, http_status, response_body, duration_ms, payload_json)
         VALUES ($1, $2, $3, $4, 1, NULL, $5, 0, $6)`,
        [packageId, accountId, eventType, payloadHash, "Secret unavailable — delivery aborted", bodyStr],
      ).catch((e) => {
        if (e?.code === "23503" && e?.constraint === "webhook_deliveries_package_id_fkey") return;
        logger.error({ e }, "[DocuFill] Failed to log aborted delivery");
      });
      return;
    }
    void retryWebhookDelivery(db, packageId, accountId, webhookUrl, secret, bodyStr, 1, eventType, payloadHash);
  });
}

// ── Task #195: fire submission notification emails ────────────────────────────
async function fireSubmissionEmailsAsync(
  session: Record<string, unknown>,
  pdfBuffer: Buffer,
  token: string,
  db: QueryClient,
): Promise<void> {
  const orgName       = typeof session.org_name       === "string" ? session.org_name       : "Docuplete";
  const orgBrandColor = typeof session.org_brand_color === "string" ? session.org_brand_color : null;
  const orgLogoUrl    = typeof session.org_logo_url    === "string" ? session.org_logo_url    : null;
  const packageName   = typeof session.package_name   === "string" ? session.package_name   : "Document Package";
  const accountId     = typeof session.package_account_id === "number" ? session.package_account_id : null;

  const origin = process.env.APP_ORIGIN
    ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");

  const prefill       = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
  const firstName     = cleanText(prefill.firstName);
  const lastName      = cleanText(prefill.lastName);
  const clientName    = [firstName, lastName].filter(Boolean).join(" ") || null;
  const clientEmail   = cleanText(prefill.email) || (typeof session.link_email_recipient === "string" ? session.link_email_recipient : null);

  const pdfFilename   = `${(packageName).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "docuplete"}-packet.pdf`;
  const logoFullUrl   = orgLogoUrl ? `${origin}${orgLogoUrl}` : null;
  const submittedAt   = new Date().toISOString();

  // Fetch org email customization settings once for all outbound emails
  const emailSettings = accountId ? await getOrgEmailSettings(accountId) : null;

  // Staff notification — email and in-app, gated on per-user preferences
  if (session.notify_staff_on_submit === true && accountId) {
    try {
      const [staffEmails] = await Promise.all([
        getUserEmailsToNotify(accountId, "submission_received"),
        sendInAppNotifications(
          accountId,
          "submission_received",
          `New submission: ${packageName}`,
          `${clientName ?? clientEmail ?? "A client"} submitted "${packageName}".`,
        ),
      ]);
      if (staffEmails.length) {
        const appUrl = `${origin}/internal/docufill?session=${token}`;
        await sendDocupleteStaffSubmissionEmail({
          staffEmails,
          sessionToken: token,
          packageName,
          orgName,
          orgBrandColor,
          clientName,
          clientEmail,
          submittedAt,
          appUrl,
          pdfBuffer:     pdfBuffer.length <= 5 * 1024 * 1024 ? pdfBuffer : null,
          pdfFilename,
          emailSettings,
        });
        logger.info({ staffEmails, token }, "[DocuFill] Staff submission emails sent");
      }
    } catch (err) {
      logger.error({ err, token }, "[DocuFill] Failed to send staff submission email");
    }
  }

  // Client confirmation
  if (session.notify_client_on_submit === true && clientEmail) {
    try {
      await sendDocupleteClientConfirmationEmail({
        clientEmail,
        clientName,
        packageName,
        orgName,
        orgLogoUrl:    logoFullUrl,
        orgBrandColor,
        emailSettings,
      });
      logger.info({ clientEmail, token }, "[DocuFill] Client confirmation email sent");
    } catch (err) {
      logger.error({ err, token }, "[DocuFill] Failed to send client confirmation email");
    }
  }
}

function normalizeFieldType(value: unknown): string {
  const text = cleanText(value);
  return ["text", "date", "radio", "checkbox", "dropdown"].includes(text) ? text : "text";
}

function normalizeValidationType(value: unknown): string {
  const text = cleanText(value);
  const valid = new Set(["none", "string", "name", "number", "currency", "email", "phone", "date", "time", "zip", "zip4", "ssn", "percent", "custom"]);
  return valid.has(text) ? text : "none";
}

function normalizeSortOrder(value: unknown): number {
  const order = Number(value ?? 100);
  return Number.isFinite(order) ? Math.trunc(order) : 100;
}

/** Parse the canonical groupIds list from a request body, falling back to the legacy single groupId. */
function parseGroupIds(groupIds: unknown, groupId: unknown): number[] {
  if (Array.isArray(groupIds)) {
    const ids = groupIds.map((v) => parseId(v)).filter((v): v is number => v !== null);
    return [...new Set(ids)];
  }
  const single = parseId(groupId);
  return single ? [single] : [];
}

/**
 * Validates that all groupIds are active groups belonging to `accountId`, and that
 * there is at most one group per category (kind). Returns an error message on failure.
 */
async function validateGroupIds(client: QueryClient, groupIds: number[], accountId: number): Promise<string | null> {
  if (groupIds.length === 0) return null;
  const { rows } = await client.query<{ id: number; kind: string }>(
    `SELECT id, kind FROM docufill_groups WHERE id = ANY($1) AND account_id = $2`,
    [groupIds, accountId],
  );
  if (rows.length !== groupIds.length) {
    const foundIds = new Set(rows.map((r) => r.id));
    const bad = groupIds.filter((id) => !foundIds.has(id));
    return `Invalid or inaccessible group id(s): ${bad.join(", ")}`;
  }
  const kindCounts = new Map<string, number[]>();
  for (const row of rows) {
    const kind = row.kind ?? "general";
    const existing = kindCounts.get(kind) ?? [];
    existing.push(row.id);
    kindCounts.set(kind, existing);
  }
  for (const [kind, ids] of kindCounts) {
    if (ids.length > 1) {
      return `A package may have at most one group per category. Multiple groups found for category "${kind}": ids ${ids.join(", ")}`;
    }
  }
  return null;
}

/** Replace all junction rows for a package with the given group ids (within a transaction). */
async function syncPackageGroups(client: QueryClient, packageId: number, groupIds: number[]): Promise<void> {
  await client.query(`DELETE FROM docufill_package_groups WHERE package_id = $1`, [packageId]);
  if (groupIds.length > 0) {
    const values = groupIds.map((gid, i) => `($1, $${i + 2})`).join(", ");
    await client.query(
      `INSERT INTO docufill_package_groups (package_id, group_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [packageId, ...groupIds],
    );
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

function fieldLibrarySelectSql(): string {
  return `SELECT id, label, category, field_type AS type, source, options, sensitive, required,
                 validation_type AS "validationType", validation_pattern AS "validationPattern",
                 validation_message AS "validationMessage", active, sort_order AS "sortOrder"
            FROM docufill_fields`;
}

async function getFieldLibrary(client: QueryClient = getDb(), accountId?: number) {
  const filter = accountId !== undefined && accountId !== null
    ? `WHERE (account_id IS NULL OR account_id = $1)`
    : `WHERE account_id IS NULL`;
  const params = accountId !== undefined && accountId !== null ? [accountId] : [];
  const { rows } = await client.query(
    `${fieldLibrarySelectSql()} ${filter} ORDER BY active DESC, sort_order ASC, label ASC`,
    params,
  );
  return rows as Array<Record<string, unknown> & { id: string }>;
}

function safePdfFilename(value: unknown): string {
  const fallback = "document.pdf";
  const raw = cleanText(value);
  const withoutPath = raw.split(/[\\/]/).pop() ?? fallback;
  const cleaned = withoutPath.replace(/[^\w.\- ()]+/g, "_").replace(/_+/g, "_").slice(0, 160);
  const filename = cleaned || fallback;
  return /\.pdf$/i.test(filename) ? filename : `${filename}.pdf`;
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.pdf$/i, "").trim() || "Document";
}

/** Count pages by scanning raw PDF bytes for Page dictionary objects.
 *  Used as a fallback when pdf-lib cannot fully parse the document
 *  (e.g. encrypted PDFs, non-standard XRef tables, PDF 2.0 features). */
function countPdfPagesFromBytes(buffer: Buffer): number {
  // /Type /Page (leaf pages only, not /Pages nodes) is the most reliable
  // raw count that doesn't require a full parse.
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? Math.max(matches.length, 1) : 1;
}

async function getPdfMetadata(buffer: Buffer): Promise<{ pageCount: number; pageSizes: Array<{ width: number; height: number }> }> {
  // First attempt: full parse with pdf-lib (gives accurate page sizes).
  // throwOnInvalidObject:false makes pdf-lib tolerant of minor structural
  // issues that would otherwise cause it to throw.
  try {
    const pdf = await PdfLibDocument.load(buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
    const pages = pdf.getPages();
    const pageSizes = pages.map((page) => {
      const { width, height } = page.getSize();
      return { width, height };
    });
    return { pageCount: Math.max(pdf.getPageCount(), 1), pageSizes };
  } catch {
    // Second attempt: raw-byte page count — works for encrypted, linearised,
    // and non-standard PDFs that pdf-lib cannot fully load.
    logger.warn("[DocuFill] pdf-lib could not parse uploaded PDF — falling back to raw page count");
    const pageCount = countPdfPagesFromBytes(buffer);
    return { pageCount, pageSizes: [] };
  }
}

function mergeStoredDocumentMetadata(documents: DocItem[], rows: StoredDocumentRow[]): DocItem[] {
  const byId = new Map(rows.map((row) => [row.document_id, row]));
  const merged = documents.map((doc) => {
    const row = byId.get(doc.id);
    if (!row) {
      return doc.pdfStored ? { ...doc, pdfStored: false } : doc;
    }
    byId.delete(doc.id);
    return {
      ...doc,
      pages: row.page_count,
      fileName: row.filename,
      byteSize: row.byte_size,
      contentType: row.content_type || "application/pdf",
      pdfStored: true,
      pageSizes: Array.isArray(row.page_sizes) ? row.page_sizes : [],
      uploadedAt: doc.uploadedAt ?? new Date(row.created_at ?? row.updated_at ?? Date.now()).toISOString(),
      updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()).toISOString(),
    };
  });
  byId.forEach((row) => {
    merged.push({
      id: row.document_id,
      title: titleFromFilename(row.filename),
      pages: row.page_count,
      fileName: row.filename,
      byteSize: row.byte_size,
      contentType: row.content_type || "application/pdf",
      pdfStored: true,
      pageSizes: Array.isArray(row.page_sizes) ? row.page_sizes : [],
      uploadedAt: new Date(row.created_at ?? row.updated_at ?? Date.now()).toISOString(),
      updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()).toISOString(),
    });
  });
  return merged;
}

async function hydrateStoredDocumentMetadata(packages: PackageRow[], client: QueryClient = getDb()): Promise<PackageRow[]> {
  const ids = packages.map((pkg) => Number(pkg.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return packages;
  const { rows } = await client.query(
    `SELECT package_id, document_id, filename, content_type, byte_size, page_count, page_sizes, created_at, updated_at
       FROM docufill_package_documents
      WHERE package_id = ANY($1::int[])`,
    [ids],
  );
  const byPackageId = new Map<number, StoredDocumentRow[]>();
  (rows as StoredDocumentRow[]).forEach((row) => {
    const packageRows = byPackageId.get(Number(row.package_id)) ?? [];
    packageRows.push(row);
    byPackageId.set(Number(row.package_id), packageRows);
  });
  return packages.map((pkg) => {
    const packageRows = byPackageId.get(Number(pkg.id)) ?? [];
    return { ...pkg, documents: mergeStoredDocumentMetadata(parseDocuments(pkg.documents), packageRows) };
  });
}

async function hydratePackages(packages: PackageRow[], client: QueryClient = getDb(), fieldLibrary?: Array<Record<string, unknown> & { id: string }>, accountId?: number): Promise<PackageRow[]> {
  const library = fieldLibrary ?? await getFieldLibrary(client, accountId);
  const withDocuments = await hydrateStoredDocumentMetadata(packages, client);
  return withDocuments.map((pkg) => ({ ...pkg, fields: hydratePackageFields(pkg.fields, library) }));
}

/** Strip the webhook signing secret before sending a package to any client endpoint.
 *  The secret is only returned by the dedicated GET /packages/:id/webhook-secret
 *  endpoint which is guarded with requireAdminRole. */
function sanitizePackageForClient(pkg: PackageRow): Omit<PackageRow, "webhook_secret"> {
  const { webhook_secret: _dropped, ...rest } = pkg as PackageRow & { webhook_secret?: string };
  return rest;
}

async function readPdfBody(req: Request): Promise<Buffer> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new PdfUploadError("Only PDF uploads are supported");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  const maxSize = MAX_PACKAGE_PDF_BYTES;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxSize) {
      throw new PdfUploadError("PDF must be 100 MB or smaller");
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  if (body.length < 5 || body.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new PdfUploadError("Uploaded file is not a valid PDF");
  }
  return body;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

/**
 * Stamps a subtle audit footer on every page of a pdf-lib PDFDocument.
 *
 * The footer renders in light gray at 7pt so it is present for audit purposes
 * but does not interfere with document content. Designed to sit below the
 * natural content area — most legal-size and letter-size PDFs leave at least
 * 18pt of bottom margin.
 *
 * The stamp intentionally excludes client PII so the footer remains safe
 * whether the PDF is shared internally or with a third-party e-sign provider.
 * E-sign completion certificates will augment this trail, not replace it.
 */
async function stampPdfAuditFooter(
  doc: PdfLibDocument,
  sessionToken: string,
  generatedAt: Date,
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const gray = rgb(0.55, 0.55, 0.55);
  const size = 7;
  const paddingBottom = 10;

  const isoDate = generatedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const stamp = `Generated by Docuplete  ·  ${sessionToken}  ·  ${isoDate}`;

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(stamp, size);
    const x = (width - textWidth) / 2; // horizontally centred
    const y = paddingBottom;
    page.drawText(stamp, { x: Math.max(x, 18), y, size, font, color: gray, opacity: 0.7 });
  }
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, maxWidth = 180, align: "left" | "center" | "right" = "left") {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);
  lines.forEach((textLine, index) => {
    const lineWidth = font.widthOfTextAtSize(textLine, size);
    const offset = align === "center" ? Math.max(0, (maxWidth - lineWidth) / 2) : align === "right" ? Math.max(0, maxWidth - lineWidth) : 0;
    page.drawText(textLine, { x: x + offset, y: y - index * (size + 2), size, font, color: rgb(0, 0, 0) });
  });
}

async function getPackage(packageId: number, client: QueryClient = getDb(), hydrate = true, accountId?: number): Promise<PackageRow | undefined> {
  const params: unknown[] = [packageId];
  const accountFilter = accountId != null
    ? (params.push(accountId), `AND p.account_id = $${params.length}`)
    : "";
  const [{ rows }, junctionRows] = await Promise.all([
    client.query(
      `SELECT p.*, c.name AS custodian_name, d.name AS depository_name, g.name AS group_name
         FROM docufill_packages p
         LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
         LEFT JOIN docufill_depositories d ON d.id = p.depository_id
         LEFT JOIN docufill_groups g ON g.id = p.group_id
        WHERE p.id = $1 ${accountFilter}`,
      params,
    ),
    client.query(
      `SELECT array_agg(group_id ORDER BY group_id) AS group_ids FROM docufill_package_groups WHERE package_id=$1`,
      [packageId],
    ),
  ]);
  const pkg = rows[0] as PackageRow | undefined;
  if (!pkg) return undefined;
  const junctionGroupIds: number[] = (junctionRows.rows[0] as { group_ids: number[] | null })?.group_ids ?? [];
  const group_ids = junctionGroupIds.length > 0 ? junctionGroupIds : (pkg.group_id ? [Number(pkg.group_id)] : []);
  const withGroupIds = { ...pkg, group_ids };
  if (!hydrate) return withGroupIds;
  return (await hydratePackages([withGroupIds], client, undefined, accountId))[0];
}

async function getSession(token: string, client: QueryClient = getDb(), accountId?: number): Promise<Record<string, unknown> | undefined> {
  const params: unknown[] = [token];
  const accountFilter = accountId != null
    ? (params.push(accountId), `AND s.account_id = $${params.length}`)
    : "";
  const { rows } = await client.query(
    `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
            p.transaction_scope, p.custodian_id, p.depository_id, p.group_id,
            p.webhook_enabled, p.webhook_url,
            p.notify_staff_on_submit, p.notify_client_on_submit,
            p.enable_embed, p.embed_key,
            p.enable_gdrive, p.enable_hubspot,
            p.account_id AS package_account_id,
            c.name AS custodian_name, d.name AS depository_name, g.name AS group_name,
            a.name AS org_name,
            CASE WHEN a.logo_url IS NOT NULL THEN '/api/storage/org-logo/' || a.id::text ELSE NULL END AS org_logo_url,
            a.brand_color AS org_brand_color,
            a.gdrive_access_token, a.gdrive_refresh_token, a.gdrive_folder_id,
            a.hubspot_access_token, a.hubspot_refresh_token
       FROM docufill_interview_sessions s
       JOIN docufill_packages p ON p.id = s.package_id
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
       LEFT JOIN docufill_groups g ON g.id = p.group_id
       LEFT JOIN accounts a ON a.id = p.account_id
      WHERE s.token = $1 ${accountFilter}
        AND s.expires_at > NOW()`,
    params,
  );
  const session = rows[0] as Record<string, unknown> | undefined;
  if (!session) return undefined;
  const hydratedPackage = (await hydratePackages([{ id: session.package_id, documents: session.documents, fields: session.fields }], client))[0];
  const result: Record<string, unknown> = { ...session, documents: hydratedPackage.documents, fields: hydratedPackage.fields };
  if (isEncryptionEnabled() && result.answers_ciphertext) {
    try {
      const dek = await getOrCreateAccountDek(result.account_id as number, getDb());
      result.answers = decryptAnswers(result.answers_ciphertext as string, dek);
    } catch (err) {
      logger.warn({ err }, "[Encryption] Failed to decrypt session answers — returning plaintext fallback");
    }
  }
  delete result.answers_ciphertext;
  return result;
}

function fieldInInterview(field: DocuFillFieldItem): boolean {
  if (field.interviewMode) return field.interviewMode !== "omitted";
  return field.interviewVisible !== false;
}

function fieldIsRequired(field: DocuFillFieldItem): boolean {
  if (field.interviewMode) return field.interviewMode === "required";
  return field.required === true && field.interviewVisible !== false;
}

function evaluateFieldCondition(
  condition: DocuFillFieldCondition | null | undefined,
  answers: Record<string, unknown>,
): boolean {
  if (!condition || !condition.fieldId) return true;
  const triggerValue = String(answers[condition.fieldId] ?? "").trim();
  switch (condition.operator) {
    case "equals":          return triggerValue.toLowerCase() === (condition.value ?? "").toLowerCase();
    case "not_equals":      return triggerValue.toLowerCase() !== (condition.value ?? "").toLowerCase();
    case "is_answered":     return triggerValue !== "";
    case "is_not_answered": return triggerValue === "";
    default:                return true;
  }
}

function validateSessionAnswers(session: Record<string, unknown>): { valid: boolean; missingFields: string[]; errors: string[] } {
  const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
  const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
  const fields = parseFields(session.fields);
  const missingFields: string[] = [];
  const errors: string[] = [];
  fields.filter((f) => fieldInInterview(f) && f.interviewMode !== "readonly" && evaluateFieldCondition(f.condition, answers) && evaluateFieldCondition(f.condition2, answers)).forEach((field) => {
    const value = fieldAnswerValue(field, answers, prefill).trim();
    const fieldLabel = field.name ?? field.label ?? field.id;
    if (fieldIsRequired(field) && !value) {
      missingFields.push(fieldLabel);
      return;
    }
    if (!value) return;
    const vt = field.validationType ?? "none";
    if (vt === "name" && !/^[a-z ,.'-]+$/i.test(value)) errors.push(field.validationMessage || `${fieldLabel} must be a valid name.`);
    if (vt === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(field.validationMessage || `${fieldLabel} must be a valid email address.`);
    if (vt === "phone" && value.replace(/\D+/g, "").length < 10) errors.push(field.validationMessage || `${fieldLabel} must be a valid phone number.`);
    if (vt === "number" && Number.isNaN(Number(value.replace(/,/g, "")))) errors.push(field.validationMessage || `${fieldLabel} must be a number.`);
    if (vt === "currency" && Number.isNaN(Number(value.replace(/[$,]/g, "")))) errors.push(field.validationMessage || `${fieldLabel} must be a currency amount.`);
    if (vt === "percent" && (Number.isNaN(Number(value.replace(/%/g, ""))) || Number(value.replace(/%/g, "")) < 0 || Number(value.replace(/%/g, "")) > 100)) errors.push(field.validationMessage || `${fieldLabel} must be a percent between 0 and 100.`);
    if (vt === "date" && Number.isNaN(new Date(value).getTime())) errors.push(field.validationMessage || `${fieldLabel} must be a valid date.`);
    if (vt === "time" && !/^([01]?\d|2[0-3]):[0-5]\d(\s?(AM|PM))?$/i.test(value)) errors.push(field.validationMessage || `${fieldLabel} must be a valid time (e.g. 2:30 PM).`);
    if (vt === "zip" && !/^\d{5}$/.test(value.replace(/\s/g, ""))) errors.push(field.validationMessage || `${fieldLabel} must be a 5-digit ZIP code.`);
    if (vt === "zip4" && !/^\d{5}-\d{4}$/.test(value.replace(/\s/g, ""))) errors.push(field.validationMessage || `${fieldLabel} must be ZIP+4 format (12345-6789).`);
    if (vt === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(value)) errors.push(field.validationMessage || `${fieldLabel} must be a valid SSN format.`);
    if (vt === "custom" && field.validationPattern) {
      try {
        if (!new RegExp(field.validationPattern).test(value)) errors.push(field.validationMessage || `${fieldLabel} is not in the expected format.`);
      } catch {
        errors.push(`${fieldLabel} has an invalid validation pattern.`);
      }
    }
  });
  return { valid: missingFields.length === 0 && errors.length === 0, missingFields, errors };
}

async function buildPacketPdfBuffer(session: Record<string, unknown>, client: QueryClient = getDb()): Promise<Buffer> {
  const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
  const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
  const fields = parseFields(session.fields);
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const packageId = Number(session.package_id);
  const storedDocuments = parseDocuments(session.documents).filter((sourceDoc) => sourceDoc.pdfStored);
  const storedRowsResult = Number.isInteger(packageId) && storedDocuments.length > 0
    ? await client.query(
      `SELECT document_id, filename, content_type, byte_size, page_count, pdf_data, created_at, updated_at
         FROM docufill_package_documents
        WHERE package_id=$1 AND document_id = ANY($2::text[])`,
      [packageId, storedDocuments.map((doc) => doc.id)],
    )
    : { rows: [] };
  const storedRows = storedRowsResult.rows as StoredDocumentRow[];
  if (storedRows.length > 0) {
    const mappingsByDocument = new Map<string, MappingItem[]>();
    parseMappings(session.mappings).forEach((mapping) => {
      if (!mapping.documentId) return;
      const documentMappings = mappingsByDocument.get(mapping.documentId) ?? [];
      documentMappings.push(mapping);
      mappingsByDocument.set(mapping.documentId, documentMappings);
    });
    const merged = await PdfLibDocument.create();
    const font = await merged.embedFont(StandardFonts.Helvetica);
    const storedRowById = new Map(storedRows.map((row) => [row.document_id, row]));
    for (const sourceDoc of storedDocuments) {
      const row = storedRowById.get(sourceDoc.id);
      if (!row?.pdf_data) continue;
      const sourcePdf = await PdfLibDocument.load(row.pdf_data, { ignoreEncryption: true });
      const copiedPages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => merged.addPage(page));
      const documentMappings = mappingsByDocument.get(sourceDoc.id) ?? [];
      documentMappings.forEach((mapping) => {
        const field = mapping.fieldId ? fieldsById.get(mapping.fieldId) : undefined;
        if (!field) return;
        if (!evaluateFieldCondition(field.condition, answers) || !evaluateFieldCondition(field.condition2, answers)) return;
        const value = fieldAnswerValue(field, answers, prefill);
        const mappedValue = formatDocuFillMappedValue(value, mapping);
        if (!mappedValue) return;
        const pageIndex = Math.max(Number(mapping.page ?? 1) - 1, 0);
        const page = merged.getPages()[merged.getPageCount() - copiedPages.length + pageIndex];
        if (!page) return;
        const { width, height } = page.getSize();
        const x = Math.max(0, Math.min(width - 12, (Number(mapping.x ?? 0) / 100) * width));
        const yTop = height - (Number(mapping.y ?? 0) / 100) * height;
        const fontSize = clampNumber(mapping.fontSize, 11, 5, 24);
        const boxHeight = Math.max(fontSize + 2, (clampNumber(mapping.h, 10, 1, 100) / 100) * height);
        const maxWidth = Math.max(18, (clampNumber(mapping.w, 26, 2, 100) / 100) * width);
        const align = mapping.align === "center" || mapping.align === "right" ? mapping.align : "left";
        // yDraw is the pdf-lib baseline y for the first line of printed text.
        // pdf-lib uses a bottom-left origin; yTop is the top edge of the mapping box.
        // The mapper uses CSS flex justify-end + paddingBottom:2px, so the visible text
        // bottom sits ~2px above the box edge, with the baseline ~fontSize*0.2 above that.
        //
        // Two alignment modes:
        //   • Default: baseline at box bottom, regardless of box height.
        //       Formula: yTop - boxHeight + fontSize*0.2 + 2
        //       Multiline values wrap downward from this baseline via drawWrappedText.
        //   • Checkbox (format === "checkbox-yes"): "X" vertically centred.
        //       Formula: yTop - boxHeight/2 - fontSize*0.35
        const isCheckboxFormat = mapping.format === "checkbox-yes" || String(mapping.format ?? "").startsWith("checkbox-option:");
        const rawYDraw = isCheckboxFormat
          ? yTop - boxHeight / 2 - fontSize * 0.35
          : yTop - boxHeight + fontSize * 0.2 + 2;
        const yDraw = Math.max(fontSize + 2, Math.min(height - 2, rawYDraw));
        drawWrappedText(page, mappedValue, x, yDraw, fontSize, font, maxWidth, align);
      });
    }
    const sessionToken = typeof session.token === "string" ? session.token : "";
    await stampPdfAuditFooter(merged, sessionToken, new Date());
    return Buffer.from(await merged.save());
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 54 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text("Docuplete Packet", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Package: ${String(session.package_name ?? "")}`);
    doc.text(`Custodian: ${String(session.custodian_name ?? "")}`);
    doc.text(`Depository: ${String(session.depository_name ?? "")}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.fontSize(14).text("Known Deal Data");
    const fallbackRows = buildDocuFillFallbackSummaryRows(session);
    fallbackRows.prefillRows.forEach((row) => {
      doc.fontSize(10).text(`${row.label}: ${row.displayValue}`);
    });
    doc.moveDown();
    doc.fontSize(14).text("Interview Answers");
    fallbackRows.answerRows.forEach((row) => {
      doc.fontSize(10).text(`${row.label}: ${row.displayValue}`);
    });
    doc.moveDown();
    doc.fontSize(14).fillColor("#000000").text("Stored Source PDFs");
    parseDocuments(session.documents).filter((sourceDoc) => sourceDoc.pdfStored).forEach((sourceDoc) => {
      doc.fontSize(10).text(`${sourceDoc.title} — ${sourceDoc.pages} page(s), ${sourceDoc.fileName ?? "stored PDF"}`);
    });
    doc.end();
  });
}

async function upsertPackageDocument(params: {
  packageId: number;
  accountId: number;
  documentId?: string | null;
  title?: string | null;
  filename: string;
  pdf: Buffer;
}) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await getPackage(params.packageId, client, true, params.accountId);
    if (!existing) {
      await client.query("ROLLBACK");
      return null;
    }
    const documentId = cleanText(params.documentId) || createDocumentId();
    const filename = safePdfFilename(params.filename);
    const title = cleanText(params.title) || titleFromFilename(filename);
    const { pageCount, pageSizes } = await getPdfMetadata(params.pdf);
    const updatedAt = new Date().toISOString();
    const storage = await client.query(
      `SELECT COALESCE(SUM(byte_size), 0)::bigint AS total_bytes
         FROM docufill_package_documents
        WHERE package_id=$1 AND document_id <> $2`,
      [params.packageId, documentId],
    );
    const existingBytes = Number(storage.rows[0]?.total_bytes ?? 0);
    if (existingBytes + params.pdf.length > MAX_PACKAGE_PDF_BYTES) {
      throw new PdfUploadError("Package PDF storage is limited to 100 MB");
    }
    await client.query(
      `INSERT INTO docufill_package_documents
         (package_id, document_id, filename, content_type, byte_size, page_count, page_sizes, pdf_data)
       VALUES ($1,$2,$3,'application/pdf',$4,$5,$6::jsonb,$7)
       ON CONFLICT (package_id, document_id) DO UPDATE SET
         filename=EXCLUDED.filename,
         content_type=EXCLUDED.content_type,
         byte_size=EXCLUDED.byte_size,
         page_count=EXCLUDED.page_count,
         page_sizes=EXCLUDED.page_sizes,
         pdf_data=EXCLUDED.pdf_data,
         updated_at=NOW()`,
      [params.packageId, documentId, filename, params.pdf.length, pageCount, JSON.stringify(pageSizes), params.pdf],
    );
    const documents = parseDocuments(existing.documents);
    const priorDoc = documents.find((item) => item.id === documentId);
    const doc: DocItem = {
      id: documentId,
      title,
      pages: pageCount,
      fileName: filename,
      byteSize: params.pdf.length,
      contentType: "application/pdf",
      pdfStored: true,
      pageSizes,
      uploadedAt: priorDoc?.uploadedAt ?? updatedAt,
      updatedAt,
    };
    const existingIndex = documents.findIndex((item) => item.id === documentId);
    const nextDocuments = existingIndex >= 0
      ? documents.map((item) => item.id === documentId ? { ...item, ...doc } : item)
      : [...documents, doc];
    await client.query(
      `UPDATE docufill_packages
          SET documents=$1::jsonb, version=version+1, updated_at=NOW()
        WHERE id=$2 AND account_id=$3`,
      [JSON.stringify(nextDocuments), params.packageId, params.accountId],
    );
    await client.query("COMMIT");
    return getPackage(params.packageId, getDb(), true, params.accountId);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

router.get("/bootstrap", async (req, res) => {
  try {
    const accountId = acctId(req);
    const db = getDb();
    const [groups, transactionTypes, fieldLibrary, packages, packageGroupRows] = await Promise.all([
      db.query("SELECT * FROM docufill_groups WHERE account_id = $1 ORDER BY active DESC, sort_order ASC, name ASC", [accountId]),
      db.query("SELECT * FROM docufill_transaction_types ORDER BY active DESC, sort_order ASC, label ASC"),
      getFieldLibrary(db, accountId),
      db.query(`SELECT p.*, g.name AS group_name
                  FROM docufill_packages p
                  LEFT JOIN docufill_groups g ON g.id = p.group_id
                 WHERE p.account_id = $1
                 ORDER BY p.updated_at DESC, p.name ASC`, [accountId]),
      db.query(`SELECT pg.package_id, array_agg(pg.group_id ORDER BY pg.group_id) AS group_ids
                  FROM docufill_package_groups pg
                  JOIN docufill_packages p ON p.id = pg.package_id
                 WHERE p.account_id = $1
                 GROUP BY pg.package_id`, [accountId]),
    ]);
    const groupIdsMap = new Map<number, number[]>();
    for (const row of packageGroupRows.rows as Array<{ package_id: number; group_ids: number[] }>) {
      groupIdsMap.set(row.package_id, row.group_ids);
    }
    const packagesWithGroupIds = (packages.rows as PackageRow[]).map((pkg) => ({
      ...pkg,
      group_ids: groupIdsMap.get(pkg.id as number) ?? (pkg.group_id ? [pkg.group_id as number] : []),
    }));
    const hydratedPackages = await hydratePackages(packagesWithGroupIds as PackageRow[], db, fieldLibrary);
    res.json({ groups: groups.rows, transactionTypes: transactionTypes.rows, fieldLibrary, packages: hydratedPackages.map(sanitizePackageForClient) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load bootstrap data");
    res.status(500).json({ error: "Failed to load Docuplete data" });
  }
});

router.get("/field-library", async (req, res) => {
  try {
    const accountId = req.internalAccountId ?? undefined;
    res.json({ fieldLibrary: await getFieldLibrary(getDb(), accountId) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load field library");
    res.status(500).json({ error: "Failed to load field library" });
  }
});

router.post("/field-library", requireAdminRole, async (req, res) => {
  const body = req.body as FieldLibraryInput;
  const label = cleanText(body.label);
  try {
    if (!label) {
      res.status(400).json({ error: "Field label is required" });
      return;
    }
    const requestedId = cleanText(body.id);
    let id = requestedId || fieldLibraryIdFromLabel(label);
    const db = getDb();
    const accountId = acctId(req);
    // Label uniqueness is per-account scope (includes global NULL fields visible to the account).
    const { rows: labelDuplicateRows } = await db.query(
      `SELECT id, label
         FROM docufill_fields
        WHERE lower(label) = lower($1)
          AND (account_id IS NULL OR account_id = $2)
        LIMIT 1`,
      [label, accountId],
    );
    if (labelDuplicateRows[0]) {
      res.status(409).json({
        error: "A field with that label already exists",
        fieldId: labelDuplicateRows[0].id,
      });
      return;
    }
    const { rows: idDuplicateRows } = await db.query(
      `SELECT id
         FROM docufill_fields
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    if (idDuplicateRows[0] && requestedId) {
      res.status(409).json({ error: "A field with that id already exists", fieldId: id });
      return;
    }
    if (idDuplicateRows[0]) {
      for (let suffix = 2; suffix < 1000; suffix += 1) {
        const candidateId = `${id}_${suffix}`;
        const { rows: candidateRows } = await db.query(
          `SELECT id
             FROM docufill_fields
            WHERE id = $1
            LIMIT 1`,
          [candidateId],
        );
        if (!candidateRows[0]) {
          id = candidateId;
          break;
        }
      }
    }
    const { rows } = await db.query(
      `WITH inserted AS (
         INSERT INTO docufill_fields
           (id, label, category, field_type, source, options, sensitive, required,
            validation_type, validation_pattern, validation_message, active, sort_order, account_id)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING
         RETURNING id
       )
       ${fieldLibrarySelectSql()} WHERE id = (SELECT id FROM inserted)`,
      [
        id,
        label,
        cleanText(body.category) || "General",
        normalizeFieldType(body.type),
        cleanText(body.source) || "interview",
        JSON.stringify(parseOptions(body.options)),
        body.sensitive === true,
        body.required === true,
        normalizeValidationType(body.validationType),
        nullableText(body.validationPattern),
        nullableText(body.validationMessage),
        body.active !== false,
        normalizeSortOrder(body.sortOrder),
        accountId,
      ],
    );
    if (!rows[0]) {
      // ON CONFLICT (id) DO NOTHING silently skipped the insert — another row
      // with this id already exists (race condition). Return it as a 201 so
      // the caller can link to it without surfacing an error.
      const { rows: existingRows } = await db.query(
        `${fieldLibrarySelectSql()} WHERE id = $1`,
        [id],
      );
      if (existingRows[0]) {
        res.status(201).json({ field: existingRows[0] });
        return;
      }
      res.status(409).json({ error: "A field with that id already exists", fieldId: id });
      return;
    }
    res.status(201).json({ field: rows[0] });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const accountId = acctId(req);
      const { rows: existingRows } = await getDb().query(
        `SELECT id FROM docufill_fields WHERE lower(label) = lower($1) AND (account_id IS NULL OR account_id = $2) LIMIT 1`,
        [label, accountId],
      ).catch(() => ({ rows: [] as { id: string }[] }));
      res.status(409).json({ error: "A field with that label already exists", fieldId: existingRows[0]?.id ?? null });
      return;
    }
    logger.error({ err }, "[DocuFill] Failed to create field library item");
    res.status(500).json({ error: "Failed to create field library item" });
  }
});

router.patch("/field-library/:id", requireAdminRole, async (req, res) => {
  try {
    const id = cleanText(req.params.id);
    const body = req.body as FieldLibraryInput;
    const label = cleanText(body.label);
    if (!id || !label) {
      res.status(400).json({ error: "Field label is required" });
      return;
    }
    const db = getDb();
    const accountId = acctId(req);
    // Scope label uniqueness to the requesting account (excluding the field being updated).
    const { rows: duplicateRows } = await db.query(
      `SELECT id
         FROM docufill_fields
        WHERE lower(label) = lower($1) AND id <> $2
          AND (account_id IS NULL OR account_id = $3)
        LIMIT 1`,
      [label, id, accountId],
    );
    if (duplicateRows[0]) {
      res.status(409).json({ error: "A field with that label already exists", fieldId: duplicateRows[0].id });
      return;
    }
    const { rows } = await db.query(
      `UPDATE docufill_fields SET
          label=$1, category=$2, field_type=$3, source=$4, options=$5::jsonb,
          sensitive=$6, required=$7, validation_type=$8, validation_pattern=$9,
          validation_message=$10, active=$11, sort_order=$12, updated_at=NOW()
        WHERE id=$13 AND account_id = $14
        RETURNING id, label, category, field_type AS type, source, options, sensitive, required,
                  validation_type AS "validationType", validation_pattern AS "validationPattern",
                  validation_message AS "validationMessage", active, sort_order AS "sortOrder"`,
      [
        label,
        cleanText(body.category) || "General",
        normalizeFieldType(body.type),
        cleanText(body.source) || "interview",
        JSON.stringify(parseOptions(body.options)),
        body.sensitive === true,
        body.required === true,
        normalizeValidationType(body.validationType),
        nullableText(body.validationPattern),
        nullableText(body.validationMessage),
        body.active !== false,
        normalizeSortOrder(body.sortOrder),
        id,
        accountId,
      ],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Field library item not found" });
      return;
    }
    res.json({ field: rows[0] });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A field with that label already exists" });
      return;
    }
    logger.error({ err }, "[DocuFill] Failed to update field library item");
    res.status(500).json({ error: "Failed to update field library item" });
  }
});

router.delete("/field-library/:id", requireAdminRole, async (req, res) => {
  try {
    const id = cleanText(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid field id" });
      return;
    }
    const db = getDb();
    const accountId = acctId(req);
    // Only allow deletion of fields owned by the requesting account.
    await db.query(`DELETE FROM docufill_fields WHERE id = $1 AND account_id = $2`, [id, accountId]);
    res.json({ deletedFieldId: id });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to delete field library item");
    res.status(500).json({ error: "Failed to delete field library item" });
  }
});

router.post("/groups", requireAdminRole, async (req, res) => {
  try {
    const body = req.body as EntityInput;
    const count = (await getDb().query("SELECT COUNT(*) FROM docufill_groups WHERE account_id=$1", [acctId(req)])).rows[0]?.count ?? 0;
    const name = cleanText(body.name) || `New Group ${Number(count) + 1}`;
    const accountId = acctId(req);
    const kind = nullableText(body.kind) ?? "general";
    const { rows } = await getDb().query(
      `INSERT INTO docufill_groups (name, kind, phone, email, notes, active, sort_order, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, kind, nullableText(body.phone), nullableText(body.email), nullableText(body.notes), body.active !== false, 100, accountId],
    );
    res.status(201).json({ group: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create group");
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.patch("/groups/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid group id" });
      return;
    }
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Group name is required" });
      return;
    }
    const accountId = acctId(req);
    const kind = nullableText(body.kind) ?? "general";
    const { rows } = await getDb().query(
      `UPDATE docufill_groups SET name=$1, kind=$2, phone=$3, email=$4, notes=$5, active=$6, updated_at=NOW()
        WHERE id=$7 AND account_id=$8 RETURNING *`,
      [name, kind, nullableText(body.phone), nullableText(body.email), nullableText(body.notes), body.active !== false, id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    res.json({ group: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update group");
    res.status(500).json({ error: "Failed to update group" });
  }
});

router.delete("/groups/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid group id" });
      return;
    }
    const accountId = acctId(req);
    await getDb().query(`DELETE FROM docufill_groups WHERE id=$1 AND account_id=$2`, [id, accountId]);
    res.json({ deletedGroupId: id });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to delete group");
    res.status(500).json({ error: "Failed to delete group" });
  }
});

router.post("/transaction-types", requireAdminRole, async (req, res) => {
  try {
    const body = req.body as TransactionTypeInput;
    const label = cleanText(body.label);
    if (!label) {
      res.status(400).json({ error: "Transaction type label is required" });
      return;
    }
    const scope = cleanText(body.scope) || transactionScopeFromLabel(label);
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_transaction_types (scope, label, active, sort_order)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [scope, label, body.active !== false, Number(body.sortOrder ?? 100)],
    );
    res.status(201).json({ transactionType: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create transaction type");
    res.status(500).json({ error: "Failed to create transaction type" });
  }
});

router.patch("/transaction-types/:scope", requireAdminRole, async (req, res) => {
  try {
    const scope = cleanText(req.params.scope);
    const body = req.body as TransactionTypeInput;
    const label = cleanText(body.label);
    if (!scope || !label) {
      res.status(400).json({ error: "Transaction type label is required" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE docufill_transaction_types SET
          label=$1, active=$2, sort_order=$3, updated_at=NOW()
        WHERE scope=$4
        RETURNING *`,
      [label, body.active !== false, Number(body.sortOrder ?? 100), scope],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Transaction type not found" });
      return;
    }
    res.json({ transactionType: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update transaction type");
    res.status(500).json({ error: "Failed to update transaction type" });
  }
});

router.delete("/transaction-types/:scope", requireAdminRole, async (req, res) => {
  try {
    const scope = cleanText(req.params.scope);
    if (!scope) {
      res.status(400).json({ error: "Scope is required" });
      return;
    }
    const db = getDb();
    const { rowCount } = await db.query(
      `DELETE FROM docufill_transaction_types WHERE scope=$1`,
      [scope],
    );
    if (!rowCount) {
      res.status(404).json({ error: "Transaction type not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to delete transaction type");
    res.status(500).json({ error: "Failed to delete transaction type" });
  }
});

router.post("/custodians", requireAdminRole, async (req, res) => {
  try {
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Custodian name is required" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_custodians (name, contact_name, email, phone, notes, active, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, accountId],
    );
    res.status(201).json({ custodian: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create custodian");
    res.status(500).json({ error: "Failed to create custodian" });
  }
});

router.patch("/custodians/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid custodian id" });
      return;
    }
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Custodian name is required" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE docufill_custodians SET
          name=$1, contact_name=$2, email=$3, phone=$4, notes=$5,
          active=$6, updated_at=NOW()
        WHERE id=$7 AND account_id=$8
        RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Custodian not found" });
      return;
    }
    res.json({ custodian: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update custodian");
    res.status(500).json({ error: "Failed to update custodian" });
  }
});

router.post("/depositories", requireAdminRole, async (req, res) => {
  try {
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Depository name is required" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_depositories (name, contact_name, email, phone, notes, active, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, accountId],
    );
    res.status(201).json({ depository: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create depository");
    res.status(500).json({ error: "Failed to create depository" });
  }
});

router.patch("/depositories/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid depository id" });
      return;
    }
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Depository name is required" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE docufill_depositories SET
          name=$1, contact_name=$2, email=$3, phone=$4, notes=$5,
          active=$6, updated_at=NOW()
        WHERE id=$7 AND account_id=$8
        RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Depository not found" });
      return;
    }
    res.json({ depository: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update depository");
    res.status(500).json({ error: "Failed to update depository" });
  }
});

/**
 * @openapi
 * /product/docufill/packages:
 *   get:
 *     tags:
 *       - Product Portal — Docuplete Packages
 *     summary: List packages
 *     description: Returns all Docuplete packages configured for the authenticated account, ordered by most-recently updated first.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of packages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [packages]
 *               properties:
 *                 packages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DocuFillPackage'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// ── SDK: list packages ────────────────────────────────────────────────────────
router.get("/packages", requireMemberRole, async (req, res) => {
  try {
    const db = getDb();
    const accountId = acctId(req);
    const [{ rows }, junctionResult] = await Promise.all([
      db.query(
        `SELECT p.*, g.name AS group_name
           FROM docufill_packages p
           LEFT JOIN docufill_groups g ON g.id = p.group_id
          WHERE p.account_id = $1
          ORDER BY p.updated_at DESC, p.name ASC`,
        [accountId],
      ),
      db.query(
        `SELECT pg.package_id, array_agg(pg.group_id ORDER BY pg.group_id) AS group_ids
           FROM docufill_package_groups pg
           JOIN docufill_packages p ON p.id = pg.package_id
          WHERE p.account_id = $1
          GROUP BY pg.package_id`,
        [accountId],
      ),
    ]);
    const junctionMap = new Map<number, number[]>();
    for (const row of junctionResult.rows as Array<{ package_id: number; group_ids: number[] }>) {
      junctionMap.set(row.package_id, row.group_ids);
    }
    const rowsWithGroupIds = (rows as PackageRow[]).map((pkg) => {
      const junctionIds = junctionMap.get(pkg.id as number) ?? [];
      return { ...pkg, group_ids: junctionIds.length > 0 ? junctionIds : (pkg.group_id ? [Number(pkg.group_id)] : []) };
    });
    const hydrated = await hydratePackages(rowsWithGroupIds, db, undefined, accountId);
    res.json({ packages: hydrated.map(sanitizePackageForClient) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to list packages");
    res.status(500).json({ error: "Failed to list packages" });
  }
});

/**
 * @openapi
 * /product/docufill/packages/{id}:
 *   get:
 *     tags:
 *       - Product Portal — Docuplete Packages
 *     summary: Get a package
 *     description: Returns a single Docuplete package by its numeric ID. The package must belong to the authenticated account.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric package ID
 *     responses:
 *       200:
 *         description: Package found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [package]
 *               properties:
 *                 package:
 *                   $ref: '#/components/schemas/DocuFillPackage'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// ── SDK: get single package ───────────────────────────────────────────────────
router.get("/packages/:id", requireMemberRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const pkg = await getPackage(id, getDb(), true, acctId(req));
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.json({ package: sanitizePackageForClient(pkg) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to get package");
    res.status(500).json({ error: "Failed to get package" });
  }
});

router.post("/packages", requireAdminRole, requireWithinPlanLimits("package"), async (req, res) => {
  try {
    const body = req.body as PackageInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Package name is required" });
      return;
    }
    const accountId = acctId(req);

    // Generate the webhook secret before probing so the probe can be signed.
    // The same secret is persisted only if the probe succeeds (or no URL is given).
    // This mirrors live delivery semantics — signed probes prevent false failures
    // on webhook endpoints that enforce HMAC signature verification.
    const webhookSecret = randomBytes(32).toString("hex");

    // Validate webhook URL reachability when one is supplied at creation time.
    if (body.webhookUrl !== undefined && body.webhookUrl) {
      const probeUrl = parseWebhookUrl(body.webhookUrl);
      if (!probeUrl) {
        res.status(422).json({ error: "Invalid webhook URL: must be a valid http or https URL." });
        return;
      }
      const probe = await probeWebhookUrl(probeUrl, webhookSecret);
      if (!probe.ok) {
        res.status(422).json({ error: probe.reason });
        return;
      }
    }

    const db = getDb();
    const incomingGroupIds = parseGroupIds(body.groupIds, body.groupId);
    const groupValidationError = await validateGroupIds(db, incomingGroupIds, accountId);
    if (groupValidationError) { res.status(400).json({ error: groupValidationError }); return; }
    const primaryGroupId = incomingGroupIds[0] ?? null;
    const { rows } = await db.query(
      `INSERT INTO docufill_packages
         (name, group_id, custodian_id, depository_id, transaction_scope, description, status, documents, fields, mappings, recipients, account_id, tags, webhook_enabled, webhook_url, webhook_secret)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14,$15,$16)
       RETURNING *`,
      [
        name,
        primaryGroupId,
        body.custodianId ?? null,
        body.depositoryId ?? null,
        normalizeTransactionScope(body.transactionScope),
        nullableText(body.description),
        cleanText(body.status) || "draft",
        jsonParam(body.documents),
        jsonParam(body.fields),
        jsonParam(body.mappings),
        jsonParam(body.recipients),
        accountId,
        JSON.stringify(parseTags(body.tags)),
        body.webhookEnabled === true,
        parseWebhookUrl(body.webhookUrl),
        webhookSecret,
      ],
    );
    const newPkgId = (rows[0] as PackageRow).id as number;
    if (incomingGroupIds.length > 0) {
      await syncPackageGroups(db, newPkgId, incomingGroupIds);
    }
    const hydrated = await hydratePackages(rows as PackageRow[], db, undefined, accountId);
    const withGroupIds: PackageRow = { ...hydrated[0], group_ids: incomingGroupIds };
    res.status(201).json({ package: sanitizePackageForClient(withGroupIds) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create package");
    res.status(500).json({ error: "Failed to create package" });
  }
});

router.patch("/packages/:id", async (req, res) => {
  try {
    const db = getDb();
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const body = req.body as PackageInput;
    const accountId = acctId(req);
    const existing = await getPackage(id, db, false, accountId);
    if (!existing) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if ((req.productUserRole ?? "member") !== "admin" && req.internalEmail === undefined) {
      res.status(403).json({ error: "You don't have permission to perform this action. Admin access is required." });
      return;
    }
    const groupIdsProvided = body.groupIds !== undefined || body.groupId !== undefined;
    const incomingGroupIds = groupIdsProvided ? parseGroupIds(body.groupIds, body.groupId) : null;
    if (incomingGroupIds !== null) {
      const groupValidationError = await validateGroupIds(db, incomingGroupIds, acctId(req));
      if (groupValidationError) { res.status(400).json({ error: groupValidationError }); return; }
    }
    const primaryGroupId = incomingGroupIds !== null
      ? (incomingGroupIds[0] ?? null)
      : (existing.group_id as number | null ?? null);
    const name = cleanText(body.name) || String(existing.name ?? "");

    // Validate reachability when the caller is explicitly setting a new webhook URL.
    // The probe is signed with the package's existing webhook_secret so that
    // endpoints enforcing signature verification are not incorrectly rejected.
    if (body.webhookUrl !== undefined && body.webhookUrl) {
      const probeUrl = parseWebhookUrl(body.webhookUrl);
      if (!probeUrl) {
        res.status(422).json({ error: "Invalid webhook URL: must be a valid http or https URL." });
        return;
      }
      const existingSecret = typeof existing.webhook_secret === "string" ? existing.webhook_secret : null;
      const probe = await probeWebhookUrl(probeUrl, existingSecret);
      if (!probe.ok) {
        res.status(422).json({ error: probe.reason });
        return;
      }
    }

    const incomingDocuments = body.documents === undefined ? null : parseDocuments(body.documents);
    const removedStoredDocumentIds = incomingDocuments
      ? parseDocuments(existing.documents)
        .filter((doc) => doc.pdfStored && !incomingDocuments.some((incoming) => incoming.id === doc.id))
        .map((doc) => doc.id)
      : [];
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (removedStoredDocumentIds.length > 0) {
        await client.query(
          `DELETE FROM docufill_package_documents
            WHERE package_id=$1 AND document_id = ANY($2::text[])`,
          [id, removedStoredDocumentIds],
        );
      }
      let nextDocumentsJson = body.documents === undefined ? JSON.stringify(existing.documents ?? []) : jsonParam(body.documents);
      if (incomingDocuments) {
        const storedMetadata = await client.query(
          `SELECT package_id, document_id, filename, content_type, byte_size, page_count, page_sizes, created_at, updated_at
             FROM docufill_package_documents
            WHERE package_id=$1 AND document_id = ANY($2::text[])`,
          [id, incomingDocuments.map((doc) => doc.id)],
        );
        nextDocumentsJson = JSON.stringify(mergeStoredDocumentMetadata(incomingDocuments, storedMetadata.rows as StoredDocumentRow[]));
      }
      const { rows } = await client.query(
      `UPDATE docufill_packages SET
          name=$1, group_id=$2, custodian_id=$3, depository_id=$4, transaction_scope=$5,
          description=$6, status=$7, documents=$8::jsonb, fields=$9::jsonb,
          mappings=$10::jsonb, recipients=$11::jsonb, enable_interview=$12, enable_csv=$13,
          enable_customer_link=$14, tags=$15::jsonb, webhook_enabled=$16, webhook_url=$17,
          notify_staff_on_submit=$18, notify_client_on_submit=$19,
          enable_embed=$20, embed_key=COALESCE($21, embed_key),
          enable_gdrive=$22,
          enable_hubspot=$23,
          version=version+1, updated_at=NOW()
        WHERE id=$24 AND account_id=$25
        RETURNING *`,
      [
        name,
        primaryGroupId,
        body.custodianId === undefined ? existing.custodian_id : body.custodianId,
        body.depositoryId === undefined ? existing.depository_id : body.depositoryId,
        body.transactionScope === undefined ? existing.transaction_scope : normalizeTransactionScope(body.transactionScope),
        body.description === undefined ? existing.description : nullableText(body.description),
        body.status === undefined ? existing.status : cleanText(body.status),
        nextDocumentsJson,
        body.fields === undefined ? JSON.stringify(existing.fields ?? []) : jsonParam(body.fields),
        body.mappings === undefined ? JSON.stringify(existing.mappings ?? []) : jsonParam(body.mappings),
        body.recipients === undefined ? JSON.stringify(existing.recipients ?? []) : jsonParam(body.recipients),
        body.enableInterview === undefined ? (existing.enable_interview ?? true) : Boolean(body.enableInterview),
        body.enableCsv === undefined ? (existing.enable_csv ?? true) : Boolean(body.enableCsv),
        body.enableCustomerLink === undefined ? (existing.enable_customer_link ?? false) : Boolean(body.enableCustomerLink),
        body.tags === undefined ? JSON.stringify(Array.isArray(existing.tags) ? existing.tags : []) : JSON.stringify(parseTags(body.tags)),
        body.webhookEnabled === undefined ? (existing.webhook_enabled ?? false) : Boolean(body.webhookEnabled),
        body.webhookUrl === undefined ? (existing.webhook_url ?? null) : parseWebhookUrl(body.webhookUrl),
        body.notifyStaffOnSubmit === undefined ? (existing.notify_staff_on_submit ?? false) : Boolean(body.notifyStaffOnSubmit),
        body.notifyClientOnSubmit === undefined ? (existing.notify_client_on_submit ?? false) : Boolean(body.notifyClientOnSubmit),
        // $20 enable_embed, $21 embed_key (COALESCE so null preserves existing)
        body.enableEmbed === undefined ? (existing.enable_embed ?? false) : Boolean(body.enableEmbed),
        (() => {
          const willEnable = body.enableEmbed === undefined ? Boolean(existing.enable_embed) : Boolean(body.enableEmbed);
          if (willEnable && !existing.embed_key) return `emb_${randomBytes(16).toString("base64url")}`;
          return null; // null → COALESCE keeps existing key
        })(),
        // $22 enable_gdrive, $23 enable_hubspot
        body.enableGdrive === undefined ? (existing.enable_gdrive ?? false) : Boolean(body.enableGdrive),
        body.enableHubspot === undefined ? (existing.enable_hubspot ?? false) : Boolean(body.enableHubspot),
        id,
        accountId,
      ],
      );
      if (incomingGroupIds !== null) {
        await syncPackageGroups(client, id, incomingGroupIds);
      }
      await client.query("COMMIT");
      const hydrated = await hydratePackages(rows as PackageRow[], client, undefined, accountId);
      // Fetch the up-to-date group_ids from the junction table to return to the client
      const { rows: pgRows } = await client.query(
        `SELECT array_agg(group_id ORDER BY group_id) AS group_ids FROM docufill_package_groups WHERE package_id=$1`,
        [id],
      );
      const junctionGroupIds: number[] = (pgRows[0] as { group_ids: number[] | null })?.group_ids ?? [];
      const patchedRow = hydrated[0] as PackageRow;
      const finalGroupIds = junctionGroupIds.length > 0 ? junctionGroupIds : (patchedRow.group_id ? [Number(patchedRow.group_id)] : []);
      res.json({ package: sanitizePackageForClient({ ...patchedRow, group_ids: finalGroupIds }) });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update package");
    res.status(500).json({ error: "Failed to update package" });
  }
});

router.post("/packages/:id/test-webhook", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid package id" }); return; }
    const accountId = acctId(req);
    const db = getDb();
    const pkg = await getPackage(id, db, false, accountId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    if ((req.productUserRole ?? "member") !== "admin" && req.internalEmail === undefined) {
      res.status(403).json({ error: "You don't have permission to perform this action. Admin access is required." });
      return;
    }
    const webhookUrl = parseWebhookUrl(pkg.webhook_url);
    if (!webhookUrl) {
      res.status(400).json({ error: "No valid webhook URL is configured for this package." });
      return;
    }
    const webhookSecret = typeof pkg.webhook_secret === "string" ? pkg.webhook_secret : null;
    const samplePayload: Record<string, unknown> = {
      event: "interview.test",
      package_id: id,
      package_name: pkg.name ?? null,
      token: "test-" + Date.now().toString(36),
      submitted_at: new Date().toISOString(),
      answers: { example_field: "example value" },
    };
    const body = JSON.stringify(samplePayload);
    const payloadHash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const ok = await doWebhookDelivery(
      db, id, accountId, webhookUrl, webhookSecret, body, 1, "interview.test", payloadHash,
    );
    if (!ok) {
      res.status(502).json({ error: "Webhook did not return a 2xx status. Check the delivery log." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to send test webhook");
    res.status(500).json({ error: "Failed to send test webhook" });
  }
});

/** GET /packages/:id/webhook-secret — admin-only; returns the HMAC signing secret for the package. */
router.get("/packages/:id/webhook-secret", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid package id" }); return; }
    const accountId = acctId(req);
    const { rows } = await getDb().query<{ webhook_secret: string | null }>(
      `SELECT webhook_secret FROM docufill_packages WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
    if (!rows.length) { res.status(404).json({ error: "Package not found" }); return; }
    res.json({ webhook_secret: rows[0].webhook_secret });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to fetch webhook secret");
    res.status(500).json({ error: "Failed to fetch webhook secret" });
  }
});

router.get("/packages/:id/webhook-deliveries", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid package id" }); return; }
    const accountId = acctId(req);
    const db = getDb();
    const { rows: owned } = await db.query(
      `SELECT id FROM docufill_packages WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
    if (!owned[0]) { res.status(404).json({ error: "Package not found" }); return; }
    const { rows } = await db.query(
      `SELECT id, event_type, attempt_number, http_status, response_body, duration_ms, created_at,
              (payload_json IS NOT NULL) AS has_payload
         FROM webhook_deliveries
        WHERE package_id = $1 AND account_id = $2
        ORDER BY created_at DESC
        LIMIT 50`,
      [id, accountId],
    );
    res.json({ deliveries: rows });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to fetch webhook deliveries");
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});

// ── Task #217: manual retry of a failed webhook delivery ─────────────────────
router.post("/packages/:id/webhook-deliveries/:deliveryId/retry", requireAdminRole, async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    const deliveryId = parseId(req.params.deliveryId);
    if (!packageId || !deliveryId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();

    // Fetch the original delivery, scoped to this package + account.
    const { rows: deliveryRows } = await db.query<{
      id: number;
      payload_json: string | null;
      payload_hash: string;
      event_type: string;
      http_status: number | null;
    }>(
      `SELECT wd.id, wd.payload_json, wd.payload_hash, wd.event_type, wd.http_status
         FROM webhook_deliveries wd
         JOIN docufill_packages dp ON dp.id = wd.package_id
        WHERE wd.id = $1 AND wd.package_id = $2 AND dp.account_id = $3`,
      [deliveryId, packageId, accountId],
    );
    const delivery = deliveryRows[0];
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    if (delivery.http_status !== null && delivery.http_status >= 200 && delivery.http_status < 300) {
      res.status(409).json({ error: "This delivery already succeeded. Only failed deliveries can be retried." });
      return;
    }
    if (!delivery.payload_json) {
      res.status(409).json({
        error: "Original payload not stored for this delivery. Only deliveries recorded after the retry feature was enabled can be replayed.",
      });
      return;
    }

    // Fetch the package's webhook URL and signing secret.
    const { rows: pkgRows } = await db.query<{
      webhook_url: string | null;
      webhook_secret: string;
    }>(
      `SELECT webhook_url, webhook_secret FROM docufill_packages WHERE id = $1 AND account_id = $2`,
      [packageId, accountId],
    );
    const pkg = pkgRows[0];
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if (!pkg.webhook_url) {
      res.status(409).json({ error: "Package has no webhook URL configured" });
      return;
    }

    // Re-deliver synchronously with attempt_number = 1 so the log shows it as
    // a fresh manual attempt. The same payload_hash preserves idempotency.
    await doWebhookDelivery(
      db, packageId, accountId, pkg.webhook_url, pkg.webhook_secret,
      delivery.payload_json, 1, delivery.event_type, delivery.payload_hash,
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to retry webhook delivery");
    res.status(500).json({ error: "Failed to retry delivery" });
  }
});

router.delete("/packages/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows: owned } = await db.query(
      `SELECT id FROM docufill_packages WHERE id=$1 AND account_id=$2`,
      [id, accountId],
    );
    if (!owned[0]) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if ((req.productUserRole ?? "member") !== "admin" && req.internalEmail === undefined) {
      res.status(403).json({ error: "You don't have permission to perform this action. Admin access is required." });
      return;
    }
    await db.query(`DELETE FROM docufill_packages WHERE id=$1 AND account_id=$2`, [id, accountId]);
    res.json({ deletedPackageId: id });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to delete package");
    res.status(500).json({ error: "Failed to delete package" });
  }
});

router.post("/packages/:id/documents", requireAdminRole, async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const pdf = await readPdfBody(req);
    const pkg = await upsertPackageDocument({
      packageId,
      accountId: acctId(req),
      title: String(req.headers["x-document-title"] ?? ""),
      filename: String(req.headers["x-file-name"] ?? req.headers["x-document-title"] ?? "document.pdf"),
      pdf,
    });
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.status(201).json({ package: sanitizePackageForClient(pkg) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to upload package PDF");
    res.status(err instanceof PdfUploadError ? 400 : 500).json({ error: err instanceof Error ? err.message : "Failed to upload package PDF" });
  }
});

router.put("/packages/:id/documents/:documentId/pdf", async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const requestAccountId = acctId(req);
    const pdf = await readPdfBody(req);
    const existing = await getPackage(packageId, getDb(), true, requestAccountId);
    if (!existing) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if ((req.productUserRole ?? "member") !== "admin" && req.internalEmail === undefined) {
      res.status(403).json({ error: "You don't have permission to perform this action. Admin access is required." });
      return;
    }
    const existingDoc = parseDocuments(existing?.documents).find((doc) => doc.id === req.params.documentId);
    if (!existingDoc) {
      res.status(404).json({ error: "Package document not found" });
      return;
    }
    const pkg = await upsertPackageDocument({
      packageId,
      accountId: requestAccountId,
      documentId: req.params.documentId,
      title: String(req.headers["x-document-title"] ?? existingDoc?.title ?? ""),
      filename: String(req.headers["x-file-name"] ?? existingDoc?.fileName ?? existingDoc?.title ?? "document.pdf"),
      pdf,
    });
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.json({ package: sanitizePackageForClient(pkg) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to replace package PDF");
    res.status(err instanceof PdfUploadError ? 400 : 500).json({ error: err instanceof Error ? err.message : "Failed to replace package PDF" });
  }
});

router.get("/packages/:id/documents/:documentId.pdf", async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `SELECT d.filename, d.content_type, d.byte_size, d.pdf_data
         FROM docufill_package_documents d
         JOIN docufill_packages p ON p.id = d.package_id
        WHERE d.package_id=$1 AND d.document_id=$2 AND p.account_id=$3`,
      [packageId, req.params.documentId, acctId(req)],
    );
    const row = rows[0] as { filename: string; content_type: string; byte_size: number; pdf_data: Buffer } | undefined;
    if (!row) {
      res.status(404).json({ error: "Package document PDF not found" });
      return;
    }
    res.setHeader("Content-Type", row.content_type || "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(row.byte_size));
    res.setHeader("Content-Disposition", `inline; filename="${safePdfFilename(row.filename)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(row.pdf_data);
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load package PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to load package PDF" });
  }
});

router.delete("/packages/:id/documents/:documentId", async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const requestAccountId = acctId(req);
    const existing = await getPackage(packageId, getDb(), true, requestAccountId);
    if (!existing) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if ((req.productUserRole ?? "member") !== "admin" && req.internalEmail === undefined) {
      res.status(403).json({ error: "You don't have permission to perform this action. Admin access is required." });
      return;
    }
    const documents = parseDocuments(existing.documents).filter((doc) => doc.id !== req.params.documentId);
    const mappings = Array.isArray(existing.mappings)
      ? existing.mappings.filter((mapping: unknown) => {
        return !(mapping && typeof mapping === "object" && (mapping as Record<string, unknown>).documentId === req.params.documentId);
      })
      : [];
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM docufill_package_documents WHERE package_id=$1 AND document_id=$2", [packageId, req.params.documentId]);
      await client.query(
        `UPDATE docufill_packages
            SET documents=$1::jsonb, mappings=$2::jsonb, version=version+1, updated_at=NOW()
          WHERE id=$3 AND account_id=$4`,
        [JSON.stringify(documents), JSON.stringify(mappings), packageId, requestAccountId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const pkg = await getPackage(packageId, getDb(), true, requestAccountId);
    res.json({ package: pkg ? sanitizePackageForClient(pkg) : null });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to remove package document");
    res.status(500).json({ error: "Failed to remove package document" });
  }
});

router.post("/csv-batch", requireMemberRole, async (req, res) => {
  try {
    const body = req.body as { packageId?: unknown; rows?: unknown };
    const packageId = parseId(body.packageId);
    if (!packageId) {
      res.status(400).json({ error: "packageId is required" });
      return;
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      res.status(400).json({ error: "rows array is required and must not be empty" });
      return;
    }
    const db = getDb();
    const pkg = await getPackage(packageId, db, true, acctId(req));
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    const fields = parseFields(pkg.fields);
    const interviewFields = fields.filter(fieldInInterview);
    const fieldLookup = new Map<string, string>();
    interviewFields.forEach((field) => {
      if (field.name) fieldLookup.set(field.name.toLowerCase().trim(), field.id);
    });
    const sampleRow = body.rows[0] as Record<string, string>;
    const matchingColumns = Object.keys(sampleRow).filter((col) => {
      const normalized = col.toLowerCase().trim();
      return normalized !== "__package_id__" && normalized !== "__package_name__" && fieldLookup.has(normalized);
    });
    if (matchingColumns.length === 0) {
      res.status(400).json({ error: "No CSV columns match any field names in this package" });
      return;
    }
    const rootFolderId = process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID ?? null;
    const packageName = String(pkg.name ?? "Docuplete");
    const transactionScope = pkg.transaction_scope ?? "";
    const packageVersion = Number(pkg.version ?? 1);
    type BatchResult = { rowIndex: number; token: string | null; status: "generated" | "error"; pdfUrl?: string; error?: string };
    const results: BatchResult[] = [];
    const csvBatchDek = isEncryptionEnabled()
      ? await getOrCreateAccountDek(acctId(req), db)
      : null;
    for (let i = 0; i < body.rows.length; i++) {
      const row = body.rows[i] as Record<string, string>;
      let insertedToken: string | null = null;
      try {
        const answers: Record<string, string> = {};
        for (const [col, val] of Object.entries(row)) {
          const normalized = col.toLowerCase().trim();
          if (normalized === "__package_id__" || normalized === "__package_name__") continue;
          const fieldId = fieldLookup.get(normalized);
          if (!fieldId) continue;
          answers[fieldId] = String(val ?? "");
        }
        const token = createSessionToken();
        const csvCiphertext = csvBatchDek ? encryptAnswers(answers, csvBatchDek) : null;
        await db.query(
          `INSERT INTO docufill_interview_sessions
             (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers, answers_ciphertext, expires_at, account_id)
           VALUES ($1,$2,$3,$4,NULL,'csv_batch','draft',false,'{}'::jsonb,$5::jsonb,$6,NOW() + INTERVAL '90 days',$7)`,
          [token, packageId, packageVersion, transactionScope, csvBatchDek ? jsonParam({}) : jsonParam(answers), csvCiphertext, acctId(req)],
        );
        insertedToken = token;
        const session: Record<string, unknown> = {
          token,
          package_id: packageId,
          package_name: packageName,
          documents: pkg.documents,
          fields: pkg.fields,
          mappings: pkg.mappings,
          prefill: {},
          answers,
        };
        const validation = validateSessionAnswers(session);
        if (!validation.valid) {
          const messages = [...validation.missingFields.map((f) => `Missing required: ${f}`), ...validation.errors];
          results.push({ rowIndex: i, token: null, status: "error", error: messages.join("; ") });
          await db.query(`DELETE FROM docufill_interview_sessions WHERE token=$1`, [token]);
          insertedToken = null;
          continue;
        }
        const pdfBuffer = await buildPacketPdfBuffer(session, db);
        const generatedAt = new Date().toISOString();
        let driveResult: { fileId: string; webViewLink: string } | null = null;
        if (rootFolderId) {
          try {
            driveResult = await saveDocuFillPacketToDrive(pdfBuffer, {
              dealId: null,
              firstName: "",
              lastName: "",
              packageName,
              generatedAt,
            }, rootFolderId);
          } catch (driveErr) {
            logger.error({ driveErr, token }, "[DocuFill] Batch: Drive save failed for row");
          }
        }
        const generated = buildDocuFillPacketSummary(session);
        await db.query(
          `UPDATE docufill_interview_sessions
              SET status='generated',
                  generated_packet=$1::jsonb,
                  generated_pdf_drive_id=$2,
                  generated_pdf_url=$3,
                  generated_pdf_saved_at=CASE WHEN $3::text IS NULL THEN generated_pdf_saved_at ELSE NOW() END,
                  updated_at=NOW()
            WHERE token=$4
              AND package_id=$5`,
          [JSON.stringify(generated), driveResult?.fileId ?? null, driveResult?.webViewLink ?? null, token, packageId],
        );
        insertedToken = null;
        results.push({ rowIndex: i, token, status: "generated", pdfUrl: `/api/internal/docufill/sessions/${token}/packet.pdf` });
      } catch (err) {
        logger.error({ err, rowIndex: i }, "[DocuFill] Batch row processing failed");
        if (insertedToken) {
          await db.query(`DELETE FROM docufill_interview_sessions WHERE token=$1`, [insertedToken]).catch(() => {});
        }
        results.push({ rowIndex: i, token: null, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    res.json({ results });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to process CSV batch");
    res.status(500).json({ error: "Failed to process CSV batch" });
  }
});

/**
 * @openapi
 * /product/docufill/sessions:
 *   get:
 *     tags:
 *       - Product Portal — Docuplete Sessions
 *     summary: List sessions
 *     description: |
 *       Returns a paginated list of interview sessions for the authenticated account.
 *       Filter by package, status, or both. Results are ordered newest-first.
 *
 *       When `dealId` is supplied instead, returns the single most-recent session
 *       for that deal (legacy behavior used by the internal portal).
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: packageId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter sessions to a specific package ID
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [draft, in_progress, generated]
 *         description: Filter sessions by status
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Maximum number of sessions to return
 *       - name: offset
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of sessions to skip (for pagination)
 *       - name: updatedAfter
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: |
 *           ISO-8601 timestamp. When provided, only sessions updated after this
 *           timestamp are returned. Useful for polling integrations (e.g. Zapier).
 *       - name: cursorId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: |
 *           Tie-breaker for the `updatedAfter` cursor. When both `updatedAfter` and
 *           `cursorId` are supplied the backend filters using a PostgreSQL tuple
 *           comparison `(updated_at, id) > (updatedAfter, cursorId)`, preventing
 *           missed sessions when multiple rows share the same `updated_at` timestamp.
 *           Results are ordered `updated_at DESC, id DESC` in all cases.
 *     responses:
 *       200:
 *         description: Paginated session list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [sessions, total]
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DocuFillSessionListItem'
 *                 total:
 *                   type: integer
 *                   description: Total number of sessions matching the filters (before pagination)
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/sessions", async (req, res) => {
  try {
    const dealId = req.query.dealId ? Number(req.query.dealId) : null;

    // Legacy single-session lookup by dealId (internal/frontend use)
    if (dealId && !isNaN(dealId)) {
      const db = getDb();
      const { rows } = await db.query(
        `SELECT s.token
           FROM docufill_interview_sessions s
          WHERE s.deal_id = $1
            AND s.account_id = $2
          ORDER BY s.created_at DESC
          LIMIT 1`,
        [dealId, acctId(req)],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "No session found for this deal" });
        return;
      }
      const session = await getSession(String(rows[0].token), db, acctId(req));
      if (!session) {
        res.status(404).json({ error: "Session record not found" });
        return;
      }
      res.json({ session, token: String(rows[0].token) });
      return;
    }

    // SDK: list sessions with optional packageId / status / pagination filters
    const packageId    = req.query.packageId ? Number(req.query.packageId) : null;
    const status       = typeof req.query.status === "string" ? req.query.status : null;
    const updatedAfter = typeof req.query.updatedAfter === "string" ? req.query.updatedAfter : null;
    const limit        = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset       = Math.max(Number(req.query.offset ?? 0), 0);

    const validStatuses = ["draft", "in_progress", "generated"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
      return;
    }
    let updatedAfterDate: Date | null = null;
    if (updatedAfter) {
      updatedAfterDate = new Date(updatedAfter);
      if (isNaN(updatedAfterDate.getTime())) {
        res.status(400).json({ error: "updatedAfter must be a valid ISO-8601 timestamp" });
        return;
      }
    }
    const cursorId = typeof req.query.cursorId === "string" ? parseId(req.query.cursorId) : null;

    const db = getDb();
    const params: (number | string | null | Date)[] = [acctId(req)];
    const conditions: string[] = ["s.account_id = $1"];

    if (packageId) {
      params.push(packageId);
      conditions.push(`s.package_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (updatedAfterDate && cursorId) {
      // Composite cursor: fetch sessions newer than (updatedAfter, cursorId)
      // using lexicographic row comparison. With ORDER BY updated_at DESC, id DESC,
      // this reliably paginates without missing sessions at timestamp boundaries.
      params.push(updatedAfterDate, cursorId);
      const tsIdx = params.length - 1;
      const idIdx = params.length;
      conditions.push(`(s.updated_at, s.id) > ($${tsIdx}, $${idIdx})`);
    } else if (updatedAfterDate) {
      params.push(updatedAfterDate);
      conditions.push(`s.updated_at > $${params.length}`);
    }

    const where = conditions.join(" AND ");

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM docufill_interview_sessions s WHERE ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    params.push(limit, offset);
    const { rows: rawListRows } = await db.query(
      `SELECT s.token, s.id, s.package_id, s.status,
              s.created_at, s.updated_at, s.expires_at,
              s.answers, s.answers_ciphertext, s.prefill, s.generated_pdf_url,
              p.name AS package_name
         FROM docufill_interview_sessions s
         JOIN docufill_packages p ON p.id = s.package_id
        WHERE ${where}
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    let listRows: Record<string, unknown>[] = rawListRows as Record<string, unknown>[];
    if (isEncryptionEnabled() && listRows.some((r) => r.answers_ciphertext)) {
      try {
        const listDek = await getOrCreateAccountDek(acctId(req), db);
        listRows = listRows.map((row) => {
          const r = { ...row };
          if (r.answers_ciphertext) {
            try { r.answers = decryptAnswers(r.answers_ciphertext as string, listDek); } catch { /* keep plaintext fallback */ }
          }
          delete r.answers_ciphertext;
          return r;
        });
      } catch { /* non-fatal — return with plaintext fallback */ }
    } else {
      listRows = listRows.map((row) => { const r = { ...row }; delete r.answers_ciphertext; return r; });
    }

    res.json({ sessions: listRows, total });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to list sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

/**
 * @openapi
 * /internal/docufill/sessions:
 *   post:
 *     tags:
 *       - Internal — Docuplete Sessions
 *     summary: Create an interview session (internal)
 *     description: |
 *       Creates a new Docuplete interview session for the specified package.
 *       Returns the session record and a bearer token used to load and submit
 *       the public-facing interview form. Sessions expire after **90 days**.
 *
 *       Pass `testMode: true` to create a test session without requiring the
 *       package to be active (requires an authenticated admin account).
 *     security:
 *       - internalAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: integer
 *                 description: ID of an active Docuplete package
 *                 example: 7
 *               dealId:
 *                 type: integer
 *                 nullable: true
 *                 description: Optional deal ID to associate with this session
 *               custodianId:
 *                 type: integer
 *                 nullable: true
 *                 description: Override the package's default custodian
 *               depositoryId:
 *                 type: integer
 *                 nullable: true
 *                 description: Override the package's default depository
 *               transactionScope:
 *                 type: string
 *                 nullable: true
 *                 description: Override the package's transaction scope
 *               source:
 *                 type: string
 *                 default: deal_builder
 *                 description: Free-text label for how this session was created
 *               prefill:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Initial field values to pre-populate in the interview
 *               testMode:
 *                 type: boolean
 *                 default: false
 *                 description: Create a non-production test session (admin only)
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/DocuFillSession'
 *                 token:
 *                   type: string
 *                   description: Bearer token passed to the public interview form
 *       400:
 *         description: Invalid packageId, scope mismatch, or package not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * /product/docufill/sessions:
 *   post:
 *     tags:
 *       - Product Portal — Docuplete Sessions
 *     summary: Create an interview session
 *     description: |
 *       Creates a new Docuplete interview session for the specified package.
 *       Returns the session record and a bearer token used to load and submit
 *       the public-facing interview form. Sessions expire after **90 days**.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: integer
 *                 description: ID of an active Docuplete package
 *                 example: 7
 *               dealId:
 *                 type: integer
 *                 nullable: true
 *               custodianId:
 *                 type: integer
 *                 nullable: true
 *               depositoryId:
 *                 type: integer
 *                 nullable: true
 *               transactionScope:
 *                 type: string
 *                 nullable: true
 *               source:
 *                 type: string
 *               prefill:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Initial field values to pre-populate in the interview form
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - session
 *                 - token
 *                 - interviewUrl
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/DocuFillSession'
 *                 token:
 *                   type: string
 *                   description: Bearer token passed to the public interview form
 *                 interviewUrl:
 *                   type: string
 *                   format: uri
 *                   description: Full URL to the public-facing interview form for this session
 *                   example: https://app.docuplete.com/docufill/public/df_abc123
 *       400:
 *         description: Invalid packageId or package not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Package not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/sessions", requireMemberRole, requireWithinPlanLimits("submission"), async (req, res) => {
  try {
    const body = req.body as SessionInput;
    const packageId = parseId(body.packageId);
    if (!packageId) {
      res.status(400).json({ error: "Package id is required" });
      return;
    }
    const accountId = acctId(req);
    const pkg = await getPackage(packageId, getDb(), true, accountId);
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    const testMode = body.testMode === true;
    if (testMode && !req.internalEmail) {
      res.status(403).json({ error: "Test mode sessions require an authenticated admin account" });
      return;
    }
    if (!testMode && String(pkg.status ?? "") !== "active") {
      res.status(400).json({ error: "Package must be active before launching an interview" });
      return;
    }
    const prefill = getRecord(body.prefill);
    const requestedGroupId = parseId(body.groupId) ?? parseId(prefill.groupId);
    const requestedCustodianId = parseId(body.custodianId) ?? parseId(prefill.custodianId);
    const requestedDepositoryId = parseId(body.depositoryId) ?? parseId(prefill.depositoryId);
    const pkgGroupIds = Array.isArray(pkg.group_ids) ? (pkg.group_ids as number[]) : (pkg.group_id ? [Number(pkg.group_id)] : []);
    if (requestedGroupId && pkgGroupIds.length > 0 && !pkgGroupIds.includes(requestedGroupId)) {
      res.status(400).json({ error: "Selected package does not match the selected group" });
      return;
    }
    if (requestedCustodianId && pkg.custodian_id && requestedCustodianId !== Number(pkg.custodian_id)) {
      res.status(400).json({ error: "Selected package does not match the selected custodian" });
      return;
    }
    if (requestedDepositoryId && pkg.depository_id && requestedDepositoryId !== Number(pkg.depository_id)) {
      res.status(400).json({ error: "Selected package does not match the selected depository" });
      return;
    }
    const requestedScope = normalizeTransactionScope(body.transactionScope ?? pkg.transaction_scope);
    if (requestedScope !== normalizeTransactionScope(pkg.transaction_scope)) {
      res.status(400).json({ error: "Selected package does not match the selected transaction type" });
      return;
    }
    const token = createSessionToken();
    const db = getDb();

    // Fetch org-level interview defaults and apply them (non-fatal).
    // Per-session overrides from request body take precedence.
    const NEVER_EXPIRES = new Date("9999-12-31T23:59:59Z");
    let orgExpiryDays: number | null = 90; // safe finite default until org row is read
    let orgReminderEnabled = false;
    let orgReminderDays = 2;
    let orgLocale = "en";
    try {
      const { rows: defaultRows } = await db.query(
        `SELECT interview_link_expiry_days, interview_reminder_enabled,
                interview_reminder_days, interview_default_locale
           FROM accounts WHERE id = $1`,
        [accountId],
      );
      if (defaultRows[0]) {
        const d = defaultRows[0] as Record<string, unknown>;
        orgExpiryDays      = typeof d.interview_link_expiry_days  === "number" ? d.interview_link_expiry_days  : null;
        orgReminderEnabled = Boolean(d.interview_reminder_enabled);
        orgReminderDays    = typeof d.interview_reminder_days     === "number" ? d.interview_reminder_days     : 2;
        orgLocale          = typeof d.interview_default_locale    === "string" ? d.interview_default_locale    : "en";
      }
    } catch (defErr) {
      logger.warn({ defErr }, "[DocuFill] Could not fetch interview defaults; using built-in defaults");
    }

    // Validate and apply per-session overrides: request body takes precedence over org defaults.
    // orgExpiryDays = null means "never expires" (admin explicitly chose this);
    // a number means that many days; 90 is the column default for new orgs.
    const SESSION_ALLOWED_LOCALES = new Set(["en","es","fr","de","pt","zh","ja","ko","ar"]);

    if ("linkExpiryDays" in body && body.linkExpiryDays !== null) {
      const days = Number(body.linkExpiryDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        res.status(400).json({ error: "linkExpiryDays must be null or an integer between 1 and 3650" });
        return;
      }
    }
    if ("locale" in body && typeof body.locale === "string" && !SESSION_ALLOWED_LOCALES.has(body.locale)) {
      res.status(400).json({ error: "locale must be one of: en, es, fr, de, pt, zh, ja, ko, ar" });
      return;
    }
    if ("reminderDays" in body && body.reminderDays !== undefined) {
      const rd = Number(body.reminderDays);
      if (!Number.isInteger(rd) || rd < 1 || rd > 90) {
        res.status(400).json({ error: "reminderDays must be an integer between 1 and 90" });
        return;
      }
    }

    const effectiveExpiryDays: number | null = "linkExpiryDays" in body
      ? (body.linkExpiryDays === null ? null : Number(body.linkExpiryDays))
      : orgExpiryDays;
    const effectiveLocale: string = (typeof body.locale === "string" && body.locale) ? body.locale : orgLocale;
    const effectiveReminderEnabled: boolean = typeof body.reminderEnabled === "boolean" ? body.reminderEnabled : orgReminderEnabled;
    const effectiveReminderDays: number = (typeof body.reminderDays === "number" && body.reminderDays >= 1) ? Math.min(body.reminderDays, 90) : orgReminderDays;

    // null = "never expires" → use far-future sentinel so existing NOT NULL constraint is satisfied
    const finalExpiresAt: Date = effectiveExpiryDays === null
      ? NEVER_EXPIRES
      : new Date(Date.now() + effectiveExpiryDays * 86400000);

    const { rows } = await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers,
          expires_at, account_id, locale, reminder_enabled, reminder_days)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8::jsonb,'{}'::jsonb,
               $10,$9,$11,$12,$13)
       RETURNING *`,
      [
        token, packageId, pkg.version ?? 1, requestedScope,
        body.dealId ?? null, cleanText(body.source) || "deal_builder", testMode,
        jsonParam(body.prefill ?? {}), accountId,
        finalExpiresAt,
        effectiveLocale, effectiveReminderEnabled, effectiveReminderDays,
      ],
    );
    // Record submission usage event (fire-and-forget, non-fatal; test sessions skipped)
    if (!testMode) {
      void recordSubmissionEvent(acctId(req));
    }
    const appOrigin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");
    // Use custom domain when active
    let interviewOrigin = appOrigin;
    try {
      const domainRow = await db.query<{ custom_domain: string | null; custom_domain_status: string }>(
        `SELECT custom_domain, custom_domain_status FROM accounts WHERE id = $1`,
        [accountId],
      );
      const dr = domainRow.rows[0];
      if (dr?.custom_domain && dr.custom_domain_status === "active") {
        interviewOrigin = `https://${dr.custom_domain}`;
      }
    } catch { /* non-fatal — fall back to default origin */ }
    const interviewUrl = `${interviewOrigin}/docufill/public/${token}`;
    res.status(201).json({ session: rows[0], token, interviewUrl });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create interview session");
    res.status(500).json({ error: "Failed to create interview session" });
  }
});

/**
 * @openapi
 * /product/docufill/sessions/{token}:
 *   get:
 *     tags:
 *       - Product Portal — Docuplete Sessions
 *     summary: Get a session
 *     description: Returns the full interview session by its opaque token. Includes answers, fields, documents, prefill data, and package metadata.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Opaque session token (e.g. `df_abc123`) returned when the session was created
 *     responses:
 *       200:
 *         description: Session data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [session]
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/DocuFillSession'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/sessions/:token", async (req, res) => {
  try {
    const param = req.params.token;
    let session: Record<string, unknown> | undefined;
    const numericId = /^\d+$/.test(param) ? Number(param) : null;
    if (numericId) {
      // Support lookup by numeric session ID (for Zapier and other integrations)
      const db = getDb();
      const { rows } = await db.query<{ token: string }>(
        `SELECT token FROM docufill_interview_sessions
          WHERE id = $1 AND account_id = $2 AND expires_at > NOW()`,
        [numericId, acctId(req)],
      );
      if (rows[0]) session = await getSession(rows[0].token, db, acctId(req));
    } else {
      session = await getSession(param, getDb(), acctId(req));
    }
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load interview session");
    res.status(500).json({ error: "Failed to load interview session" });
  }
});

router.patch("/sessions/:token", requireMemberRole, async (req, res) => {
  try {
    const body = req.body as AnswersInput;
    const db = getDb();
    const accountId = acctId(req);
    const inputAnswers: Record<string, unknown> = getRecord(body.answers);
    let answersParam: string = jsonParam(inputAnswers);
    let ciphertextParam: string | null = null;
    if (isEncryptionEnabled()) {
      const dek = await getOrCreateAccountDek(accountId, db);
      ciphertextParam = encryptAnswers(inputAnswers, dek);
      answersParam = jsonParam({});
    }
    const { rows } = await db.query(
      `UPDATE docufill_interview_sessions SET
          answers=$1::jsonb, answers_ciphertext=$5, status=COALESCE($2, status), updated_at=NOW()
        WHERE token=$3
          AND expires_at > NOW()
          AND account_id = $4
        RETURNING id`,
      [answersParam, body.status ?? null, req.params.token, accountId, ciphertextParam],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const session = await getSession(String(req.params.token), db, accountId);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to save interview answers");
    res.status(500).json({ error: "Failed to save interview answers" });
  }
});

// ── Task #194: Send interview link by email ───────────────────────────────────
router.post("/sessions/:token/send-link", requireMemberRole, async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(String(req.params.token), db, acctId(req));
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }

    const body = req.body as { recipientEmail?: string; recipientName?: string; customMessage?: string };
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
    const recipientName  = typeof body.recipientName  === "string" ? body.recipientName.trim()  : "";

    if (!recipientEmail) {
      res.status(400).json({ error: "recipientEmail is required" });
      return;
    }

    const appOrigin2 = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");
    let interviewOrigin2 = appOrigin2;
    try {
      const dr2 = await db.query<{ custom_domain: string | null; custom_domain_status: string }>(
        `SELECT custom_domain, custom_domain_status FROM accounts WHERE id = $1`,
        [acctId(req)],
      );
      const r2 = dr2.rows[0];
      if (r2?.custom_domain && r2.custom_domain_status === "active") {
        interviewOrigin2 = `https://${r2.custom_domain}`;
      }
    } catch { /* non-fatal */ }
    const interviewUrl = `${interviewOrigin2}/docufill/public/${req.params.token}`;

    const orgLogoUrl    = typeof session.org_logo_url === "string" ? session.org_logo_url : null;
    const orgBrandColor = typeof session.org_brand_color === "string" ? session.org_brand_color : null;
    const orgName       = typeof session.org_name === "string" && session.org_name ? session.org_name : "Docuplete";

    const emailSettings = await getOrgEmailSettings(acctId(req));
    await sendInterviewLinkEmail({
      recipientEmail,
      recipientName,
      interviewUrl,
      orgName,
      orgLogoUrl:    orgLogoUrl ? `${interviewOrigin2}${orgLogoUrl}` : null,
      orgBrandColor,
      customMessage: typeof body.customMessage === "string" ? body.customMessage.trim() || null : null,
      emailSettings,
    });

    await db.query(
      `UPDATE docufill_interview_sessions
          SET link_emailed_at=NOW(), link_email_recipient=$1, updated_at=NOW()
        WHERE token=$2
          AND package_id IN (SELECT id FROM docufill_packages WHERE account_id = $3)`,
      [recipientEmail, req.params.token, acctId(req)],
    );

    res.json({ ok: true, sentTo: recipientEmail });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to send interview link email");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send email" });
  }
});

router.post("/sessions/:token/generate", requireMemberRole, async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(String(req.params.token), db, acctId(req));
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const validation = validateSessionAnswers(session);
    if (!validation.valid) {
      res.status(400).json({ error: "Packet is missing required or valid fields", ...validation });
      return;
    }
    const generated = buildDocuFillPacketSummary(session);
    const pdfBuffer = await buildPacketPdfBuffer(session, db);
    const generatedAt = new Date().toISOString();
    let driveResult: { fileId: string; webViewLink: string } | null = null;
    let driveWarning: string | null = null;
    const rootFolderId = process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID;
    if (rootFolderId) {
      try {
        const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
        driveResult = await saveDocuFillPacketToDrive(pdfBuffer, {
          dealId: Number(session.deal_id) || null,
          firstName: cleanText(prefill.firstName),
          lastName: cleanText(prefill.lastName),
          packageName: String(session.package_name ?? "Docuplete"),
          generatedAt,
        }, rootFolderId);
      } catch (err) {
        driveWarning = err instanceof Error ? err.message : "Could not save packet to Google Drive";
        logger.error({ err, token: req.params.token }, "[DocuFill] Failed to save packet to Drive");
      }
    }
    // Per-account Google Drive upload (enable_gdrive channel)
    if (!driveResult && session.enable_gdrive === true) {
      const accessToken = typeof session.gdrive_access_token === "string" ? session.gdrive_access_token : null;
      const refreshToken = typeof session.gdrive_refresh_token === "string" ? session.gdrive_refresh_token : null;
      const folderId = typeof session.gdrive_folder_id === "string" ? session.gdrive_folder_id : null;
      if (accessToken && refreshToken && folderId) {
        try {
          const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
          driveResult = await uploadSessionPdfToAccountDrive(
            { accessToken, refreshToken },
            folderId,
            pdfBuffer,
            {
              firstName: cleanText(prefill.firstName),
              lastName: cleanText(prefill.lastName),
              packageName: String(session.package_name ?? "Docuplete"),
              generatedAt,
            },
          );
        } catch (err) {
          driveWarning = err instanceof Error ? err.message : "Could not save packet to Google Drive";
          logger.error({ err, token: req.params.token }, "[DocuFill] Per-account Drive upload failed");
        }
      }
    }
    // ── HubSpot contact upsert ───────────────────────────────────────────────
    let hubspotWarning: string | undefined;
    if (session.enable_hubspot === true) {
      const hsAccessToken  = typeof session.hubspot_access_token  === "string" ? session.hubspot_access_token  : null;
      const hsRefreshToken = typeof session.hubspot_refresh_token === "string" ? session.hubspot_refresh_token : null;
      if (hsAccessToken && hsRefreshToken) {
        try {
          const prefill  = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
          const fields   = Array.isArray(session.fields) ? (session.fields as Array<{ id: string; label: string; type?: string }>) : [];
          const answers  = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
          const props    = extractHubSpotProperties(prefill, fields, answers);
          const result   = await upsertHubSpotContact(hsAccessToken, hsRefreshToken, props);
          if (result.newAccessToken) {
            await db.query(`UPDATE accounts SET hubspot_access_token=$1 WHERE id=$2`, [result.newAccessToken, acctId(req)]);
          }
          logger.info({ contactId: result.contactId, created: result.created }, "[DocuFill] HubSpot contact upserted");
        } catch (err) {
          hubspotWarning = err instanceof Error ? err.message : "Could not sync contact to HubSpot";
          logger.error({ err, token: req.params.token }, "[DocuFill] HubSpot upsert failed");
        }
      }
    }
    await db.query(
      `UPDATE docufill_interview_sessions
          SET status='generated',
              generated_packet=$1::jsonb,
              generated_pdf_drive_id=$2,
              generated_pdf_url=$3,
              generated_pdf_saved_at=CASE WHEN $3::text IS NULL THEN generated_pdf_saved_at ELSE NOW() END,
              updated_at=NOW()
        WHERE token=$4
          AND account_id = $5`,
      [JSON.stringify(generated), driveResult?.fileId ?? null, driveResult?.webViewLink ?? null, req.params.token, acctId(req)],
    );
    const allWarnings = [...(driveWarning ? [driveWarning] : []), ...(hubspotWarning ? [hubspotWarning] : [])];
    res.json({
      packet: generated,
      downloadUrl: `/api/internal/docufill/sessions/${req.params.token}/packet.pdf`,
      drive: driveResult ? { fileId: driveResult.fileId, url: driveResult.webViewLink } : null,
      warnings: allWarnings,
    });
    // Audit trail — non-blocking
    const { actorIp, actorUa } = actorContextFromRequest(req);
    recordPdfAuditEvent({
      accountId:    acctId(req),
      sessionToken: String(req.params.token),
      eventType:    "generated",
      actorType:    req.internalEmail ? "staff" : "api",
      actorEmail:   req.internalEmail ?? null,
      actorIp,
      actorUa,
      metadata: {
        packageId:   session.package_id,
        packageName: session.package_name,
        driveFileId: driveResult?.fileId ?? null,
      },
    }).catch(() => {});
    const webhookUrl = typeof session.webhook_url === "string" ? session.webhook_url : null;
    if (session.webhook_enabled === true && webhookUrl) {
      fireWebhookAsync(
        db,
        typeof session.package_id === "number" ? session.package_id : Number(session.package_id),
        typeof session.package_account_id === "number" ? session.package_account_id : Number(session.package_account_id),
        webhookUrl,
        buildWebhookPayload(session),
      );
    }
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to generate packet");
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

router.get("/sessions/:token/packet.pdf", async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(req.params.token, db, acctId(req));
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const output = await buildPacketPdfBuffer(session, db);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=docufill-${req.params.token}.pdf`);
    res.setHeader("Content-Length", String(output.length));
    res.end(output);
    // Audit trail — non-blocking
    const { actorIp: dlIp, actorUa: dlUa } = actorContextFromRequest(req);
    recordPdfAuditEvent({
      accountId:    acctId(req),
      sessionToken: req.params.token,
      eventType:    "downloaded",
      actorType:    req.internalEmail ? "staff" : "api",
      actorEmail:   req.internalEmail ?? null,
      actorIp:      dlIp,
      actorUa:      dlUa,
    }).catch(() => {});
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to download packet PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to download packet" });
  }
});

/**
 * @openapi
 * /docufill/public/sessions/{token}:
 *   get:
 *     tags:
 *       - Docuplete — Public (no auth)
 *     summary: Load an interview session
 *     description: |
 *       Returns the full session object including package metadata, document list,
 *       field definitions, prefill data, and saved answers. No authentication required.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Opaque session token returned when the session was created
 *     responses:
 *       200:
 *         description: Session data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/DocuFillSession'
 *       404:
 *         description: Session not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
publicDocufillRouter.get("/sessions/:token", async (req, res) => {
  try {
    const session = await getSession(req.params.token);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session: publicSessionView(session) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load public interview session");
    res.status(500).json({ error: "Failed to load interview session" });
  }
});

/**
 * @openapi
 * /docufill/public/sessions/{token}:
 *   patch:
 *     tags:
 *       - Docuplete — Public (no auth)
 *     summary: Save interview answers
 *     description: |
 *       Persists a partial or complete answers object for the session. Optionally
 *       updates the session status (e.g. `in_progress`). The session must not have expired.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Map of fieldId → value pairs
 *               status:
 *                 type: string
 *                 enum: [draft, in_progress]
 *                 description: Optional status update
 *     responses:
 *       200:
 *         description: Updated session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/DocuFillSession'
 *       404:
 *         description: Session not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
publicDocufillRouter.patch("/sessions/:token", async (req, res) => {
  try {
    const body = req.body as AnswersInput;
    const db = getDb();
    const { rows: metaRows } = await db.query<{ account_id: number }>(
      `SELECT account_id FROM docufill_interview_sessions WHERE token=$1 AND expires_at > NOW()`,
      [req.params.token],
    );
    if (!metaRows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const accountId = metaRows[0].account_id;
    const inputAnswers: Record<string, unknown> = getRecord(body.answers);
    let answersParam: string = jsonParam(inputAnswers);
    let ciphertextParam: string | null = null;
    if (isEncryptionEnabled()) {
      const dek = await getOrCreateAccountDek(accountId, db);
      ciphertextParam = encryptAnswers(inputAnswers, dek);
      answersParam = jsonParam({});
    }
    const { rows } = await db.query(
      `UPDATE docufill_interview_sessions SET
          answers=$1::jsonb, answers_ciphertext=$4, status=COALESCE($2, status), updated_at=NOW()
        WHERE token=$3
          AND expires_at > NOW()
        RETURNING id`,
      [answersParam, body.status ?? null, req.params.token, ciphertextParam],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const session = await getSession(req.params.token, db);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to save public interview answers");
    res.status(500).json({ error: "Failed to save interview answers" });
  }
});

/**
 * @openapi
 * /docufill/public/sessions/{token}/generate:
 *   post:
 *     tags:
 *       - Docuplete — Public (no auth)
 *     summary: Generate the document packet
 *     description: |
 *       Validates the saved answers, renders each document as a filled PDF,
 *       bundles them into a single packet PDF, and (when configured) uploads
 *       the packet to Google Drive. Returns a download URL for the packet.
 *
 *       The session status is set to `generated`. The session must not have expired.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Packet generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 packet:
 *                   type: object
 *                   description: Summary of generated documents
 *                 downloadUrl:
 *                   type: string
 *                   example: '/api/v1/docufill/public/sessions/df_abc123/packet.pdf'
 *                 drive:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     fileId:
 *                       type: string
 *                     url:
 *                       type: string
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Validation failed — required fields are missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Session not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
publicDocufillRouter.post("/sessions/:token/generate", async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(req.params.token, db);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const validation = validateSessionAnswers(session);
    if (!validation.valid) {
      res.status(400).json({ error: "Packet is missing required or valid fields", ...validation });
      return;
    }
    const generated = buildDocuFillPacketSummary(session);
    const pdfBuffer = await buildPacketPdfBuffer(session, db);
    const generatedAt = new Date().toISOString();
    let driveResult: { fileId: string; webViewLink: string } | null = null;
    let driveWarning: string | null = null;
    const rootFolderId = process.env.GOOGLE_DRIVE_DEALS_FOLDER_ID;
    if (rootFolderId) {
      try {
        const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
        driveResult = await saveDocuFillPacketToDrive(pdfBuffer, {
          dealId: Number(session.deal_id) || null,
          firstName: cleanText(prefill.firstName),
          lastName: cleanText(prefill.lastName),
          packageName: String(session.package_name ?? "Docuplete"),
          generatedAt,
        }, rootFolderId);
      } catch (err) {
        driveWarning = err instanceof Error ? err.message : "Could not save packet to Google Drive";
        logger.error({ err, token: req.params.token }, "[DocuFill] Failed to save public packet to Drive");
      }
    }
    // Per-account Google Drive upload (enable_gdrive channel)
    if (!driveResult && session.enable_gdrive === true) {
      const accessToken = typeof session.gdrive_access_token === "string" ? session.gdrive_access_token : null;
      const refreshToken = typeof session.gdrive_refresh_token === "string" ? session.gdrive_refresh_token : null;
      const folderId = typeof session.gdrive_folder_id === "string" ? session.gdrive_folder_id : null;
      if (accessToken && refreshToken && folderId) {
        try {
          const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
          driveResult = await uploadSessionPdfToAccountDrive(
            { accessToken, refreshToken },
            folderId,
            pdfBuffer,
            {
              firstName: cleanText(prefill.firstName),
              lastName: cleanText(prefill.lastName),
              packageName: String(session.package_name ?? "Docuplete"),
              generatedAt,
            },
          );
        } catch (err) {
          driveWarning = err instanceof Error ? err.message : "Could not save packet to Google Drive";
          logger.error({ err, token: req.params.token }, "[DocuFill] Per-account Drive upload failed (public submit)");
        }
      }
    }
    // ── HubSpot contact upsert ───────────────────────────────────────────────
    let hubspotWarning: string | undefined;
    if (session.enable_hubspot === true) {
      const hsAccessToken  = typeof session.hubspot_access_token  === "string" ? session.hubspot_access_token  : null;
      const hsRefreshToken = typeof session.hubspot_refresh_token === "string" ? session.hubspot_refresh_token : null;
      if (hsAccessToken && hsRefreshToken) {
        try {
          const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
          const fields  = Array.isArray(session.fields) ? (session.fields as Array<{ id: string; label: string; type?: string }>) : [];
          const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
          const props   = extractHubSpotProperties(prefill, fields, answers);
          const packageAccountId = typeof session.package_account_id === "number" ? session.package_account_id : Number(session.package_account_id);
          const result  = await upsertHubSpotContact(hsAccessToken, hsRefreshToken, props);
          if (result.newAccessToken) {
            await db.query(`UPDATE accounts SET hubspot_access_token=$1 WHERE id=$2`, [result.newAccessToken, packageAccountId]);
          }
          logger.info({ contactId: result.contactId, created: result.created }, "[DocuFill] HubSpot contact upserted (public)");
        } catch (err) {
          hubspotWarning = err instanceof Error ? err.message : "Could not sync contact to HubSpot";
          logger.error({ err, token: req.params.token }, "[DocuFill] HubSpot upsert failed (public submit)");
        }
      }
    }
    await db.query(
      `UPDATE docufill_interview_sessions
          SET status='generated',
              generated_packet=$1::jsonb,
              generated_pdf_drive_id=$2,
              generated_pdf_url=$3,
              generated_pdf_saved_at=CASE WHEN $3::text IS NULL THEN generated_pdf_saved_at ELSE NOW() END,
              updated_at=NOW()
        WHERE token=$4`,
      [JSON.stringify(generated), driveResult?.fileId ?? null, driveResult?.webViewLink ?? null, req.params.token],
    );
    const allPublicWarnings = [...(driveWarning ? [driveWarning] : []), ...(hubspotWarning ? [hubspotWarning] : [])];
    res.json({
      packet: generated,
      downloadUrl: `/api/v1/docufill/public/sessions/${req.params.token}/packet.pdf`,
      drive: driveResult ? { fileId: driveResult.fileId, url: driveResult.webViewLink } : null,
      warnings: allPublicWarnings,
    });
    const webhookUrl = typeof session.webhook_url === "string" ? session.webhook_url : null;
    if (session.webhook_enabled === true && webhookUrl) {
      fireWebhookAsync(
        db,
        typeof session.package_id === "number" ? session.package_id : Number(session.package_id),
        typeof session.package_account_id === "number" ? session.package_account_id : Number(session.package_account_id),
        webhookUrl,
        buildWebhookPayload(session),
      );
    }
    // ── Task #195: fire submission notification emails asynchronously ──────────
    if (session.notify_staff_on_submit === true || session.notify_client_on_submit === true) {
      fireSubmissionEmailsAsync(session, pdfBuffer, req.params.token, db).catch((err) => {
        logger.error({ err, token: req.params.token }, "[DocuFill] Submission emails failed (non-fatal)");
      });
    }
    // Record PDF generation usage event (fire-and-forget)
    const pkgAccountId = typeof session.package_account_id === "number" ? session.package_account_id : null;
    if (pkgAccountId) {
      void recordPdfGenerationEvent(pkgAccountId);
    }
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to generate public packet");
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

/**
 * @openapi
 * /docufill/public/sessions/{token}/packet.pdf:
 *   get:
 *     tags:
 *       - Docuplete — Public (no auth)
 *     summary: Download the generated packet as PDF
 *     description: |
 *       Returns the fully-filled packet PDF for display or download.
 *       The packet is rendered on demand from the latest saved answers — it
 *       does not require a prior `/generate` call, but all required fields
 *       must be complete.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Session not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * POST /docufill/public/embed/:embedKey/session
 * Creates a new anonymous interview session for the package that owns this embed key.
 * Called by the embed/v1.js snippet running on a third-party webpage.
 */
publicDocufillRouter.post("/embed/:embedKey/session", async (req, res) => {
  try {
    const { embedKey } = req.params;
    if (!embedKey || !embedKey.startsWith("emb_")) {
      res.status(400).json({ error: "Invalid embed key" });
      return;
    }
    const db = getDb();
    const { rows: pkgRows } = await db.query(
      `SELECT p.*, a.custom_domain, a.custom_domain_status
         FROM docufill_packages p
         JOIN accounts a ON a.id = p.account_id
        WHERE p.embed_key = $1 AND p.enable_embed = true AND p.status = 'active'`,
      [embedKey],
    );
    const pkg = pkgRows[0] as (PackageRow & { custom_domain: string | null; custom_domain_status: string | null }) | undefined;
    if (!pkg) {
      res.status(404).json({ error: "Embed key not found or package is not active" });
      return;
    }
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, source, status, test_mode, prefill, answers, expires_at, account_id)
       VALUES ($1, $2, $3, $4, 'embed', 'draft', false, '{}'::jsonb, '{}'::jsonb, $5, $6)`,
      [token, pkg.id, pkg.version ?? 1, pkg.transaction_scope ?? "", expiresAt, pkg.account_id],
    );
    const appOrigin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");
    const interviewOrigin =
      pkg.custom_domain && pkg.custom_domain_status === "active"
        ? `https://${pkg.custom_domain}`
        : appOrigin;
    const interviewUrl = `${interviewOrigin}/docufill/public/${token}`;
    res.status(201).json({ token, interviewUrl });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create embed session");
    res.status(500).json({ error: "Failed to create session" });
  }
});

publicDocufillRouter.get("/sessions/:token/packet.pdf", async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(req.params.token, db);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const output = await buildPacketPdfBuffer(session, db);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=docufill-${req.params.token}.pdf`);
    res.setHeader("Content-Length", String(output.length));
    res.end(output);
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to preview public packet PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to preview packet" });
  }
});

export default router;
