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
  type DocuFillFieldItem,
} from "../lib/docufill-redaction";
import { saveDocuFillPacketToDrive } from "../lib/google-drive";
import {
  sendInterviewLinkEmail,
  sendDocupleteStaffSubmissionEmail,
  sendDocupleteClientConfirmationEmail,
} from "../lib/email";
import { requireAdminRole, requireRole } from "../middleware/requireRole";
import { requireWithinPlanLimits, recordSubmissionEvent, recordPdfGenerationEvent } from "../middleware/requireWithinPlanLimits";
const requireMemberRole = requireRole("member");

const router: IRouter = Router();
export const publicDocufillRouter: IRouter = Router();
const MAX_PACKAGE_PDF_BYTES = 100 * 1024 * 1024;
const TRANSACTION_SCOPES = new Set(["ira_transfer", "ira_contribution", "ira_distribution", "cash_purchase", "storage_change", "beneficiary_update", "liquidation", "buy_sell_direction", "address_change"]);

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type QueryClient = Pool | PoolClient;
type PackageRow = Record<string, unknown> & { documents?: unknown; fields?: unknown };

class PdfUploadError extends Error {}

type PackageInput = {
  name?: string;
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
  custodianId?: number | string | null;
  depositoryId?: number | string | null;
  transactionScope?: string | null;
  dealId?: number | null;
  source?: string;
  prefill?: JsonValue;
  testMode?: boolean;
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
    generated_pdf_drive_id: _di,
    deal_id: _dl,
    custodian_id: _ci,
    depository_id: _dp,
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

/** Delays (ms) between delivery attempts: immediate, +5s, +30s, +5min. */
const WEBHOOK_RETRY_DELAYS_MS = [5_000, 30_000, 5 * 60_000];

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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(webhookUrl, { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    httpStatus = res.status;
    responseSnippet = (await res.text().catch(() => "")).slice(0, 500);
    ok = res.ok;
    if (!ok) logger.warn({ status: res.status, webhookUrl, attempt }, "[DocuFill] Webhook non-2xx");
  } catch (err) {
    responseSnippet = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    logger.error({ err, webhookUrl, attempt }, "[DocuFill] Webhook request failed");
  }
  const durationMs = Date.now() - start;
  db.query(
    `INSERT INTO webhook_deliveries
       (package_id, account_id, event_type, payload_hash, attempt_number, http_status, response_body, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [packageId, accountId, eventType, payloadHash, attempt, httpStatus, responseSnippet, durationMs],
  ).catch((e) => logger.error({ e }, "[DocuFill] Failed to log webhook delivery"));
  return ok;
}

/**
 * Fire a signed webhook and retry up to 3 times on failure.
 * Retries are scheduled at 5 s, 30 s, and 5 min after each failure.
 * Every attempt is recorded in webhook_deliveries.
 */
function fireWebhookAsync(
  db: Pool,
  packageId: number,
  accountId: number,
  webhookUrl: string,
  webhookSecret: string | null,
  payload: Record<string, unknown>,
  eventType = "interview.submitted",
): void {
  const bodyStr = JSON.stringify(payload);
  const payloadHash = createHash("sha256").update(bodyStr).digest("hex").slice(0, 16);

  async function tryDeliver(attempt: number): Promise<void> {
    const success = await doWebhookDelivery(
      db, packageId, accountId, webhookUrl, webhookSecret, bodyStr, attempt, eventType, payloadHash,
    );
    if (!success && attempt <= WEBHOOK_RETRY_DELAYS_MS.length) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempt - 1];
      setTimeout(() => void tryDeliver(attempt + 1), delay).unref();
    }
  }

  setImmediate(() => void tryDeliver(1));
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

  // Staff notification
  if (session.notify_staff_on_submit === true && accountId) {
    try {
      const { rows: userRows } = await db.query(
        `SELECT email FROM account_users WHERE account_id = $1 AND email IS NOT NULL AND email <> ''`,
        [accountId],
      );
      const staffEmails: string[] = userRows.map((r: Record<string, unknown>) => String(r.email)).filter(Boolean);
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
          pdfBuffer:  pdfBuffer.length <= 5 * 1024 * 1024 ? pdfBuffer : null,
          pdfFilename,
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

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

function fieldLibrarySelectSql(): string {
  return `SELECT id, label, category, field_type AS type, source, options, sensitive, required,
                 validation_type AS "validationType", validation_pattern AS "validationPattern",
                 validation_message AS "validationMessage", active, sort_order AS "sortOrder"
            FROM docufill_fields`;
}

async function getFieldLibrary(client: QueryClient = getDb()) {
  const { rows } = await client.query(`${fieldLibrarySelectSql()} ORDER BY active DESC, sort_order ASC, label ASC`);
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

async function getPdfMetadata(buffer: Buffer): Promise<{ pageCount: number; pageSizes: Array<{ width: number; height: number }> }> {
  try {
    const pdf = await PdfLibDocument.load(buffer, { ignoreEncryption: true });
    const pageSizes = pdf.getPages().map((page) => {
      const { width, height } = page.getSize();
      return { width, height };
    });
    return { pageCount: Math.max(pdf.getPageCount(), 1), pageSizes };
  } catch {
    throw new PdfUploadError("Uploaded PDF could not be parsed");
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

async function hydratePackages(packages: PackageRow[], client: QueryClient = getDb(), fieldLibrary?: Array<Record<string, unknown> & { id: string }>): Promise<PackageRow[]> {
  const library = fieldLibrary ?? await getFieldLibrary(client);
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
  const { rows } = await client.query(
    `SELECT p.*, c.name AS custodian_name, d.name AS depository_name
       FROM docufill_packages p
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
      WHERE p.id = $1 ${accountFilter}`,
    params,
  );
  const pkg = rows[0] as PackageRow | undefined;
  if (!pkg) return undefined;
  if (!hydrate) return pkg;
  return (await hydratePackages([pkg], client))[0];
}

async function getSession(token: string, client: QueryClient = getDb(), accountId?: number): Promise<Record<string, unknown> | undefined> {
  const params: unknown[] = [token];
  const accountFilter = accountId != null
    ? (params.push(accountId), `AND s.account_id = $${params.length}`)
    : "";
  const { rows } = await client.query(
    `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
            p.transaction_scope, p.custodian_id, p.depository_id,
            p.webhook_enabled, p.webhook_url, p.webhook_secret,
            p.notify_staff_on_submit, p.notify_client_on_submit,
            p.account_id AS package_account_id,
            c.name AS custodian_name, d.name AS depository_name,
            a.name AS org_name,
            CASE WHEN a.logo_url IS NOT NULL THEN '/api/storage/org-logo/' || a.id::text ELSE NULL END AS org_logo_url,
            a.brand_color AS org_brand_color
       FROM docufill_interview_sessions s
       JOIN docufill_packages p ON p.id = s.package_id
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
       LEFT JOIN accounts a ON a.id = p.account_id
      WHERE s.token = $1 ${accountFilter}
        AND s.expires_at > NOW()`,
    params,
  );
  const session = rows[0] as Record<string, unknown> | undefined;
  if (!session) return undefined;
  const hydratedPackage = (await hydratePackages([{ id: session.package_id, documents: session.documents, fields: session.fields }], client))[0];
  return { ...session, documents: hydratedPackage.documents, fields: hydratedPackage.fields };
}

function fieldInInterview(field: DocuFillFieldItem): boolean {
  if (field.interviewMode) return field.interviewMode !== "omitted";
  return field.interviewVisible !== false;
}

function fieldIsRequired(field: DocuFillFieldItem): boolean {
  if (field.interviewMode) return field.interviewMode === "required";
  return field.required === true && field.interviewVisible !== false;
}

function validateSessionAnswers(session: Record<string, unknown>): { valid: boolean; missingFields: string[]; errors: string[] } {
  const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
  const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
  const fields = parseFields(session.fields);
  const missingFields: string[] = [];
  const errors: string[] = [];
  fields.filter((f) => fieldInInterview(f) && f.interviewMode !== "readonly").forEach((field) => {
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
    const [custodians, depositories, transactionTypes, fieldLibrary, packages] = await Promise.all([
      db.query("SELECT * FROM docufill_custodians WHERE account_id = $1 ORDER BY active DESC, name ASC", [accountId]),
      db.query("SELECT * FROM docufill_depositories WHERE account_id = $1 ORDER BY active DESC, name ASC", [accountId]),
      db.query("SELECT * FROM docufill_transaction_types ORDER BY active DESC, sort_order ASC, label ASC"),
      getFieldLibrary(db),
      db.query(`SELECT p.*, c.name AS custodian_name, d.name AS depository_name
                  FROM docufill_packages p
                  LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
                  LEFT JOIN docufill_depositories d ON d.id = p.depository_id
                 WHERE p.account_id = $1
                 ORDER BY p.updated_at DESC, p.name ASC`, [accountId]),
    ]);
    const hydratedPackages = await hydratePackages(packages.rows as PackageRow[], db, fieldLibrary);
    res.json({ custodians: custodians.rows, depositories: depositories.rows, transactionTypes: transactionTypes.rows, fieldLibrary, packages: hydratedPackages.map(sanitizePackageForClient) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load bootstrap data");
    res.status(500).json({ error: "Failed to load Docuplete data" });
  }
});

router.get("/field-library", async (_req, res) => {
  try {
    res.json({ fieldLibrary: await getFieldLibrary() });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load field library");
    res.status(500).json({ error: "Failed to load field library" });
  }
});

router.post("/field-library", requireAdminRole, async (req, res) => {
  try {
    const body = req.body as FieldLibraryInput;
    const label = cleanText(body.label);
    if (!label) {
      res.status(400).json({ error: "Field label is required" });
      return;
    }
    const requestedId = cleanText(body.id);
    let id = requestedId || fieldLibraryIdFromLabel(label);
    const db = getDb();
    const { rows: labelDuplicateRows } = await db.query(
      `SELECT id, label
         FROM docufill_fields
        WHERE lower(label) = lower($1)
        LIMIT 1`,
      [label],
    );
    if (labelDuplicateRows[0]) {
      res.status(409).json({
        error: "A shared field with that label already exists",
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
      res.status(409).json({ error: "A shared field with that id already exists", fieldId: id });
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
            validation_type, validation_pattern, validation_message, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
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
      ],
    );
    if (!rows[0]) {
      res.status(409).json({ error: "A shared field with that id already exists", fieldId: id });
      return;
    }
    res.status(201).json({ field: rows[0] });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A shared field with that label already exists" });
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
    const { rows: duplicateRows } = await db.query(
      `SELECT id
         FROM docufill_fields
        WHERE lower(label) = lower($1) AND id <> $2
        LIMIT 1`,
      [label, id],
    );
    if (duplicateRows[0]) {
      res.status(409).json({ error: "A shared field with that label already exists", fieldId: duplicateRows[0].id });
      return;
    }
    const { rows } = await db.query(
      `UPDATE docufill_fields SET
          label=$1, category=$2, field_type=$3, source=$4, options=$5::jsonb,
          sensitive=$6, required=$7, validation_type=$8, validation_pattern=$9,
          validation_message=$10, active=$11, sort_order=$12, updated_at=NOW()
        WHERE id=$13
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
      ],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Field library item not found" });
      return;
    }
    res.json({ field: rows[0] });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A shared field with that label already exists" });
      return;
    }
    logger.error({ err }, "[DocuFill] Failed to update field library item");
    res.status(500).json({ error: "Failed to update field library item" });
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

router.post("/packages", requireAdminRole, requireWithinPlanLimits("package"), async (req, res) => {
  try {
    const body = req.body as PackageInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Package name is required" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const webhookSecret = randomBytes(32).toString("hex");
    const { rows } = await db.query(
      `INSERT INTO docufill_packages
         (name, custodian_id, depository_id, transaction_scope, description, status, documents, fields, mappings, recipients, account_id, tags, webhook_enabled, webhook_url, webhook_secret)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14,$15)
       RETURNING *`,
      [
        name,
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
    const hydrated = await hydratePackages(rows as PackageRow[], db);
    res.status(201).json({ package: sanitizePackageForClient(hydrated[0]) });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create package");
    res.status(500).json({ error: "Failed to create package" });
  }
});

router.patch("/packages/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const body = req.body as PackageInput;
    const accountId = acctId(req);
    const existing = await getPackage(id, getDb(), false, accountId);
    if (!existing) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    const name = cleanText(body.name) || String(existing.name ?? "");
    const incomingDocuments = body.documents === undefined ? null : parseDocuments(body.documents);
    const removedStoredDocumentIds = incomingDocuments
      ? parseDocuments(existing.documents)
        .filter((doc) => doc.pdfStored && !incomingDocuments.some((incoming) => incoming.id === doc.id))
        .map((doc) => doc.id)
      : [];
    const db = getDb();
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
          name=$1, custodian_id=$2, depository_id=$3, transaction_scope=$4,
          description=$5, status=$6, documents=$7::jsonb, fields=$8::jsonb,
          mappings=$9::jsonb, recipients=$10::jsonb, enable_interview=$11, enable_csv=$12,
          enable_customer_link=$13, tags=$14::jsonb, webhook_enabled=$15, webhook_url=$16,
          notify_staff_on_submit=$17, notify_client_on_submit=$18,
          version=version+1, updated_at=NOW()
        WHERE id=$19 AND account_id=$20
        RETURNING *`,
      [
        name,
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
        id,
        accountId,
      ],
      );
      await client.query("COMMIT");
      const hydrated = await hydratePackages(rows as PackageRow[], client);
      res.json({ package: sanitizePackageForClient(hydrated[0]) });
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

router.post("/packages/:id/test-webhook", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid package id" }); return; }
    const accountId = acctId(req);
    const db = getDb();
    const pkg = await getPackage(id, db, false, accountId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
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
    const { rows } = await db.query(
      `SELECT id, event_type, attempt_number, http_status, response_body, duration_ms, created_at
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

router.delete("/packages/:id", requireAdminRole, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const accountId = acctId(req);
    const db = getDb();
    const { rows } = await db.query(
      `DELETE FROM docufill_packages
        WHERE id=$1 AND account_id=$2
        RETURNING id`,
      [id, accountId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.json({ deletedPackageId: rows[0].id });
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
    res.status(201).json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to upload package PDF");
    res.status(err instanceof PdfUploadError ? 400 : 500).json({ error: err instanceof Error ? err.message : "Failed to upload package PDF" });
  }
});

router.put("/packages/:id/documents/:documentId/pdf", requireAdminRole, async (req, res) => {
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
    res.json({ package: pkg });
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

router.delete("/packages/:id/documents/:documentId", requireAdminRole, async (req, res) => {
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
    res.json({ package: pkg });
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
        await db.query(
          `INSERT INTO docufill_interview_sessions
             (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers, expires_at, account_id)
           VALUES ($1,$2,$3,$4,NULL,'csv_batch','draft',false,'{}'::jsonb,$5::jsonb,NOW() + INTERVAL '90 days',$6)`,
          [token, packageId, packageVersion, transactionScope, jsonParam(answers), acctId(req)],
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

router.get("/sessions", async (req, res) => {
  try {
    const dealId = req.query.dealId ? Number(req.query.dealId) : null;
    if (!dealId || isNaN(dealId)) {
      res.status(400).json({ error: "dealId query param is required" });
      return;
    }
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
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to look up session by dealId");
    res.status(500).json({ error: "Failed to look up session" });
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
    const requestedCustodianId = parseId(body.custodianId) ?? parseId(prefill.custodianId);
    const requestedDepositoryId = parseId(body.depositoryId) ?? parseId(prefill.depositoryId);
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
    const { rows } = await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers, expires_at, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8::jsonb,'{}'::jsonb,NOW() + INTERVAL '90 days',$9)
       RETURNING *`,
      [token, packageId, pkg.version ?? 1, requestedScope, body.dealId ?? null, cleanText(body.source) || "deal_builder", testMode, jsonParam(body.prefill ?? {}), acctId(req)],
    );
    // Record submission usage event (fire-and-forget, non-fatal; test sessions skipped)
    if (!testMode) {
      void recordSubmissionEvent(acctId(req));
    }
    res.status(201).json({ session: rows[0], token });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create interview session");
    res.status(500).json({ error: "Failed to create interview session" });
  }
});

router.get("/sessions/:token", async (req, res) => {
  try {
    const session = await getSession(req.params.token, getDb(), acctId(req));
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
    const { rows } = await db.query(
      `UPDATE docufill_interview_sessions SET
          answers=$1::jsonb, status=COALESCE($2, status), updated_at=NOW()
        WHERE token=$3
          AND expires_at > NOW()
          AND account_id = $4
        RETURNING *`,
      [jsonParam(body.answers ?? {}), body.status ?? null, req.params.token, acctId(req)],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to save interview answers");
    res.status(500).json({ error: "Failed to save interview answers" });
  }
});

// ── Task #194: Send interview link by email ───────────────────────────────────
router.post("/sessions/:token/send-link", requireMemberRole, async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(req.params.token, db, acctId(req));
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

    const origin = process.env.APP_ORIGIN
      ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");
    const interviewUrl = `${origin}/docufill/public/${req.params.token}`;

    const orgLogoUrl    = typeof session.org_logo_url === "string" ? session.org_logo_url : null;
    const orgBrandColor = typeof session.org_brand_color === "string" ? session.org_brand_color : null;
    const orgName       = typeof session.org_name === "string" && session.org_name ? session.org_name : "Docuplete";

    await sendInterviewLinkEmail({
      recipientEmail,
      recipientName,
      interviewUrl,
      orgName,
      orgLogoUrl:    orgLogoUrl ? `${origin}${orgLogoUrl}` : null,
      orgBrandColor,
      customMessage: typeof body.customMessage === "string" ? body.customMessage.trim() || null : null,
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
    const session = await getSession(req.params.token, db, acctId(req));
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
    res.json({
      packet: generated,
      downloadUrl: `/api/internal/docufill/sessions/${req.params.token}/packet.pdf`,
      drive: driveResult ? { fileId: driveResult.fileId, url: driveResult.webViewLink } : null,
      warnings: driveWarning ? [driveWarning] : [],
    });
    const webhookUrl = typeof session.webhook_url === "string" ? session.webhook_url : null;
    if (session.webhook_enabled === true && webhookUrl) {
      fireWebhookAsync(
        db,
        typeof session.package_id === "number" ? session.package_id : Number(session.package_id),
        typeof session.package_account_id === "number" ? session.package_account_id : Number(session.package_account_id),
        webhookUrl,
        typeof session.webhook_secret === "string" ? session.webhook_secret : null,
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
    const { rows } = await db.query(
      `UPDATE docufill_interview_sessions SET
          answers=$1::jsonb, status=COALESCE($2, status), updated_at=NOW()
        WHERE token=$3
          AND expires_at > NOW()
        RETURNING *`,
      [jsonParam(body.answers ?? {}), body.status ?? null, req.params.token],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session: rows[0] });
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
 *                   example: '/api/docufill/public/sessions/df_abc123/packet.pdf'
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
    res.json({
      packet: generated,
      downloadUrl: `/api/docufill/public/sessions/${req.params.token}/packet.pdf`,
      drive: driveResult ? { fileId: driveResult.fileId, url: driveResult.webViewLink } : null,
      warnings: driveWarning ? [driveWarning] : [],
    });
    const webhookUrl = typeof session.webhook_url === "string" ? session.webhook_url : null;
    if (session.webhook_enabled === true && webhookUrl) {
      fireWebhookAsync(
        db,
        typeof session.package_id === "number" ? session.package_id : Number(session.package_id),
        typeof session.package_account_id === "number" ? session.package_account_id : Number(session.package_account_id),
        webhookUrl,
        typeof session.webhook_secret === "string" ? session.webhook_secret : null,
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
