import { Router, type IRouter, type Request } from "express";
import { randomBytes } from "node:crypto";
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
  return "ira_transfer";
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

async function getPackage(packageId: number, client: QueryClient = getDb(), hydrate = true): Promise<PackageRow | undefined> {
  const { rows } = await client.query(
    `SELECT p.*, c.name AS custodian_name, d.name AS depository_name
       FROM docufill_packages p
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
      WHERE p.id = $1`,
    [packageId],
  );
  const pkg = rows[0] as PackageRow | undefined;
  if (!pkg) return undefined;
  if (!hydrate) return pkg;
  return (await hydratePackages([pkg], client))[0];
}

async function getSession(token: string, client: QueryClient = getDb()): Promise<Record<string, unknown> | undefined> {
  const { rows } = await client.query(
    `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
            p.transaction_scope, p.custodian_id, p.depository_id,
            c.name AS custodian_name, d.name AS depository_name
       FROM docufill_interview_sessions s
       JOIN docufill_packages p ON p.id = s.package_id
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
      WHERE s.token = $1
        AND s.expires_at > NOW()`,
    [token],
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
    doc.fontSize(18).text("DocuFill Packet", { align: "center" });
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
  documentId?: string | null;
  title?: string | null;
  filename: string;
  pdf: Buffer;
}) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await getPackage(params.packageId, client);
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
        WHERE id=$2`,
      [JSON.stringify(nextDocuments), params.packageId],
    );
    await client.query("COMMIT");
    return getPackage(params.packageId);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

router.get("/bootstrap", async (_req, res) => {
  try {
    const db = getDb();
    const [custodians, depositories, transactionTypes, fieldLibrary, packages] = await Promise.all([
      db.query("SELECT * FROM docufill_custodians ORDER BY active DESC, name ASC"),
      db.query("SELECT * FROM docufill_depositories ORDER BY active DESC, name ASC"),
      db.query("SELECT * FROM docufill_transaction_types ORDER BY active DESC, sort_order ASC, label ASC"),
      getFieldLibrary(db),
      db.query(`SELECT p.*, c.name AS custodian_name, d.name AS depository_name
                  FROM docufill_packages p
                  LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
                  LEFT JOIN docufill_depositories d ON d.id = p.depository_id
                 ORDER BY p.updated_at DESC, p.name ASC`),
    ]);
    const hydratedPackages = await hydratePackages(packages.rows as PackageRow[], db, fieldLibrary);
    res.json({ custodians: custodians.rows, depositories: depositories.rows, transactionTypes: transactionTypes.rows, fieldLibrary, packages: hydratedPackages });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load bootstrap data");
    res.status(500).json({ error: "Failed to load DocuFill data" });
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

router.post("/field-library", async (req, res) => {
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

router.patch("/field-library/:id", async (req, res) => {
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

router.post("/transaction-types", async (req, res) => {
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

router.patch("/transaction-types/:scope", async (req, res) => {
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

router.post("/custodians", async (req, res) => {
  try {
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Custodian name is required" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_custodians (name, contact_name, email, phone, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false],
    );
    res.status(201).json({ custodian: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create custodian");
    res.status(500).json({ error: "Failed to create custodian" });
  }
});

router.patch("/custodians/:id", async (req, res) => {
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
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE docufill_custodians SET
          name=$1, contact_name=$2, email=$3, phone=$4, notes=$5,
          active=$6, updated_at=NOW()
        WHERE id=$7
        RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, id],
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

router.post("/depositories", async (req, res) => {
  try {
    const body = req.body as EntityInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Depository name is required" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_depositories (name, contact_name, email, phone, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false],
    );
    res.status(201).json({ depository: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create depository");
    res.status(500).json({ error: "Failed to create depository" });
  }
});

router.patch("/depositories/:id", async (req, res) => {
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
    const db = getDb();
    const { rows } = await db.query(
      `UPDATE docufill_depositories SET
          name=$1, contact_name=$2, email=$3, phone=$4, notes=$5,
          active=$6, updated_at=NOW()
        WHERE id=$7
        RETURNING *`,
      [name, nullableText(body.contactName), nullableText(body.email), nullableText(body.phone), nullableText(body.notes), body.active !== false, id],
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

router.post("/packages", async (req, res) => {
  try {
    const body = req.body as PackageInput;
    const name = cleanText(body.name);
    if (!name) {
      res.status(400).json({ error: "Package name is required" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_packages
         (name, custodian_id, depository_id, transaction_scope, description, status, documents, fields, mappings, recipients)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)
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
      ],
    );
    const hydrated = await hydratePackages(rows as PackageRow[], db);
    res.status(201).json({ package: hydrated[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create package");
    res.status(500).json({ error: "Failed to create package" });
  }
});

router.patch("/packages/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const body = req.body as PackageInput;
    const existing = await getPackage(id, getDb(), false);
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
          enable_customer_link=$13, version=version+1, updated_at=NOW()
        WHERE id=$14
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
        id,
      ],
      );
      await client.query("COMMIT");
      const hydrated = await hydratePackages(rows as PackageRow[], client);
      res.json({ package: hydrated[0] });
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

router.delete("/packages/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const db = getDb();
    const { rows } = await db.query(
      `DELETE FROM docufill_packages
        WHERE id=$1
        RETURNING id`,
      [id],
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

router.post("/packages/:id/documents", async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const pdf = await readPdfBody(req);
    const pkg = await upsertPackageDocument({
      packageId,
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

router.put("/packages/:id/documents/:documentId/pdf", async (req, res) => {
  try {
    const packageId = parseId(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid package id" });
      return;
    }
    const pdf = await readPdfBody(req);
    const existing = await getPackage(packageId);
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
      `SELECT filename, content_type, byte_size, pdf_data
         FROM docufill_package_documents
        WHERE package_id=$1 AND document_id=$2`,
      [packageId, req.params.documentId],
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
    const existing = await getPackage(packageId);
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
          WHERE id=$3`,
        [JSON.stringify(documents), JSON.stringify(mappings), packageId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const pkg = await getPackage(packageId);
    res.json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to remove package document");
    res.status(500).json({ error: "Failed to remove package document" });
  }
});

router.post("/csv-batch", async (req, res) => {
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
    const pkg = await getPackage(packageId, db);
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
    const packageName = String(pkg.name ?? "DocuFill");
    const transactionScope = String(pkg.transaction_scope ?? "ira_transfer");
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
             (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers, expires_at)
           VALUES ($1,$2,$3,$4,NULL,'csv_batch','draft',false,'{}'::jsonb,$5::jsonb,NOW() + INTERVAL '90 days')`,
          [token, packageId, packageVersion, transactionScope, jsonParam(answers)],
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
            WHERE token=$4`,
          [JSON.stringify(generated), driveResult?.fileId ?? null, driveResult?.webViewLink ?? null, token],
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
      `SELECT token FROM docufill_interview_sessions
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "No session found for this deal" });
      return;
    }
    const session = await getSession(String(rows[0].token), db);
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

router.post("/sessions", async (req, res) => {
  try {
    const body = req.body as SessionInput;
    const packageId = parseId(body.packageId);
    if (!packageId) {
      res.status(400).json({ error: "Package id is required" });
      return;
    }
    const pkg = await getPackage(packageId);
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
         (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode, prefill, answers, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8::jsonb,'{}'::jsonb,NOW() + INTERVAL '90 days')
       RETURNING *`,
      [token, packageId, pkg.version ?? 1, requestedScope, body.dealId ?? null, cleanText(body.source) || "deal_builder", testMode, jsonParam(body.prefill ?? {})],
    );
    res.status(201).json({ session: rows[0], token });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create interview session");
    res.status(500).json({ error: "Failed to create interview session" });
  }
});

router.get("/sessions/:token", async (req, res) => {
  try {
    const session = await getSession(req.params.token);
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

router.patch("/sessions/:token", async (req, res) => {
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
    logger.error({ err }, "[DocuFill] Failed to save interview answers");
    res.status(500).json({ error: "Failed to save interview answers" });
  }
});

router.post("/sessions/:token/generate", async (req, res) => {
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
          packageName: String(session.package_name ?? "DocuFill"),
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
        WHERE token=$4`,
      [JSON.stringify(generated), driveResult?.fileId ?? null, driveResult?.webViewLink ?? null, req.params.token],
    );
    res.json({
      packet: generated,
      downloadUrl: `/api/internal/docufill/sessions/${req.params.token}/packet.pdf`,
      drive: driveResult ? { fileId: driveResult.fileId, url: driveResult.webViewLink } : null,
      warnings: driveWarning ? [driveWarning] : [],
    });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to generate packet");
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

router.get("/sessions/:token/packet.pdf", async (req, res) => {
  try {
    const db = getDb();
    const session = await getSession(req.params.token, db);
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

publicDocufillRouter.get("/sessions/:token", async (req, res) => {
  try {
    const session = await getSession(req.params.token);
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load public interview session");
    res.status(500).json({ error: "Failed to load interview session" });
  }
});

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
          packageName: String(session.package_name ?? "DocuFill"),
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
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to generate public packet");
    res.status(500).json({ error: "Failed to generate packet" });
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
