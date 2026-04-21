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
  parseDocuFillFields as parseFields,
  type DocuFillFieldItem,
} from "../lib/docufill-redaction";

const router: IRouter = Router();
const MAX_PACKAGE_PDF_BYTES = 100 * 1024 * 1024;

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type QueryClient = Pool | PoolClient;
type PackageRow = Record<string, unknown> & { documents?: unknown };

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

type SessionInput = {
  packageId?: number;
  custodianId?: number | string | null;
  depositoryId?: number | string | null;
  dealId?: number | null;
  source?: string;
  prefill?: JsonValue;
};

type AnswersInput = {
  answers?: JsonValue;
  status?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

async function readPdfBody(req: Request): Promise<Buffer> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new PdfUploadError("Only PDF uploads are supported");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  const maxSize = 25 * 1024 * 1024;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxSize) {
      throw new PdfUploadError("PDF must be 25 MB or smaller");
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  if (body.length < 5 || body.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new PdfUploadError("Uploaded file is not a valid PDF");
  }
  return body;
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont) {
  const words = text.split(/\s+/).filter(Boolean);
  const maxChars = 60;
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxChars) {
      page.drawText(line, { x, y: currentY, size, font, color: rgb(0, 0, 0) });
      line = word;
      currentY -= size + 2;
    } else {
      line = nextLine;
    }
  });
  if (line) {
    page.drawText(line, { x, y: currentY, size, font, color: rgb(0, 0, 0) });
  }
}

async function getPackage(packageId: number, client: QueryClient = getDb()): Promise<PackageRow | undefined> {
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
  return (await hydrateStoredDocumentMetadata([pkg], client))[0];
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
    const [custodians, depositories, packages] = await Promise.all([
      db.query("SELECT * FROM docufill_custodians ORDER BY active DESC, name ASC"),
      db.query("SELECT * FROM docufill_depositories ORDER BY active DESC, name ASC"),
      db.query(`SELECT p.*, c.name AS custodian_name, d.name AS depository_name
                  FROM docufill_packages p
                  LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
                  LEFT JOIN docufill_depositories d ON d.id = p.depository_id
                 ORDER BY p.updated_at DESC, p.name ASC`),
    ]);
    const hydratedPackages = await hydrateStoredDocumentMetadata(packages.rows as PackageRow[], db);
    res.json({ custodians: custodians.rows, depositories: depositories.rows, packages: hydratedPackages });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to load bootstrap data");
    res.status(500).json({ error: "Failed to load DocuFill data" });
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
         (name, custodian_id, depository_id, transaction_scope, description, status, documents, fields, mappings)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)
       RETURNING *`,
      [
        name,
        body.custodianId ?? null,
        body.depositoryId ?? null,
        cleanText(body.transactionScope) || "Custodial paperwork",
        nullableText(body.description),
        cleanText(body.status) || "draft",
        jsonParam(body.documents),
        jsonParam(body.fields),
        jsonParam(body.mappings),
      ],
    );
    res.status(201).json({ package: rows[0] });
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
    const existing = await getPackage(id);
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
          mappings=$9::jsonb, version=version+1, updated_at=NOW()
        WHERE id=$10
        RETURNING *`,
      [
        name,
        body.custodianId === undefined ? existing.custodian_id : body.custodianId,
        body.depositoryId === undefined ? existing.depository_id : body.depositoryId,
        body.transactionScope === undefined ? existing.transaction_scope : cleanText(body.transactionScope),
        body.description === undefined ? existing.description : nullableText(body.description),
        body.status === undefined ? existing.status : cleanText(body.status),
        nextDocumentsJson,
        body.fields === undefined ? JSON.stringify(existing.fields ?? []) : jsonParam(body.fields),
        body.mappings === undefined ? JSON.stringify(existing.mappings ?? []) : jsonParam(body.mappings),
        id,
      ],
      );
      await client.query("COMMIT");
      const hydrated = await hydrateStoredDocumentMetadata(rows as PackageRow[], client);
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
    if (String(pkg.status ?? "") !== "active") {
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
    const token = createSessionToken();
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, deal_id, source, status, prefill, answers, expires_at)
       VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb,'{}'::jsonb,NOW() + INTERVAL '90 days')
       RETURNING *`,
      [token, packageId, pkg.version ?? 1, body.dealId ?? null, cleanText(body.source) || "deal_builder", jsonParam(body.prefill ?? {})],
    );
    res.status(201).json({ session: rows[0], token });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to create interview session");
    res.status(500).json({ error: "Failed to create interview session" });
  }
});

router.get("/sessions/:token", async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
              p.transaction_scope, p.custodian_id, p.depository_id,
              c.name AS custodian_name, d.name AS depository_name
         FROM docufill_interview_sessions s
         JOIN docufill_packages p ON p.id = s.package_id
         LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
         LEFT JOIN docufill_depositories d ON d.id = p.depository_id
        WHERE s.token = $1
          AND s.expires_at > NOW()`,
      [req.params.token],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const hydratedPackage = (await hydrateStoredDocumentMetadata([{ id: rows[0].package_id, documents: rows[0].documents }], db))[0];
    res.json({ session: { ...rows[0], documents: hydratedPackage.documents } });
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
    const { rows } = await db.query(
      `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
              c.name AS custodian_name, d.name AS depository_name
         FROM docufill_interview_sessions s
         JOIN docufill_packages p ON p.id = s.package_id
         LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
         LEFT JOIN docufill_depositories d ON d.id = p.depository_id
        WHERE s.token = $1
          AND s.expires_at > NOW()`,
      [req.params.token],
    );
    const session = rows[0] as Record<string, unknown> | undefined;
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const hydratedPackage = (await hydrateStoredDocumentMetadata([{ id: session.package_id, documents: session.documents }], db))[0];
    session.documents = hydratedPackage.documents;
    const generated = buildDocuFillPacketSummary(session);
    await db.query(
      `UPDATE docufill_interview_sessions SET status='generated', generated_packet=$1::jsonb, updated_at=NOW() WHERE token=$2`,
      [JSON.stringify(generated), req.params.token],
    );
    res.json({ packet: generated, downloadUrl: `/api/internal/docufill/sessions/${req.params.token}/packet.pdf` });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to generate packet");
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

router.get("/sessions/:token/packet.pdf", async (req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT s.*, p.name AS package_name, p.documents, p.fields, p.mappings,
              c.name AS custodian_name, d.name AS depository_name
         FROM docufill_interview_sessions s
         JOIN docufill_packages p ON p.id = s.package_id
         LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
         LEFT JOIN docufill_depositories d ON d.id = p.depository_id
        WHERE s.token = $1
          AND s.expires_at > NOW()`,
      [req.params.token],
    );
    const session = rows[0] as Record<string, unknown> | undefined;
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const hydratedPackage = (await hydrateStoredDocumentMetadata([{ id: session.package_id, documents: session.documents }], db))[0];
    session.documents = hydratedPackage.documents;
    const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
    const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
    const fields = parseFields(session.fields);
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const packageId = Number(session.package_id);
    const storedDocuments = parseDocuments(session.documents).filter((sourceDoc) => sourceDoc.pdfStored);
    const storedRowsResult = Number.isInteger(packageId) && storedDocuments.length > 0
      ? await db.query(
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
          if (!value) return;
          const pageIndex = Math.max(Number(mapping.page ?? 1) - 1, 0);
          const page = merged.getPages()[merged.getPageCount() - copiedPages.length + pageIndex];
          if (!page) return;
          const { width, height } = page.getSize();
          const x = Math.max(0, Math.min(width - 12, (Number(mapping.x ?? 0) / 100) * width));
          const y = Math.max(12, Math.min(height - 12, height - (Number(mapping.y ?? 0) / 100) * height));
          drawWrappedText(page, value, x, y, 9, font);
        });
      }
      const output = Buffer.from(await merged.save());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=docufill-${req.params.token}.pdf`);
      res.setHeader("Content-Length", String(output.length));
      res.end(output);
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=docufill-${req.params.token}.pdf`);
    const doc = new PDFDocument({ margin: 54 });
    doc.pipe(res);
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
    doc.moveDown();
    doc.fontSize(9).fillColor("#666666").text("This first DocuFill packet summarizes the mapped data captured for the selected package. The saved field placement map is stored with the package for final PDF overlay expansion.");
    doc.end();
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to download packet PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to download packet" });
  }
});

export default router;
