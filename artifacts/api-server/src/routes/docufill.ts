import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

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

async function getPackage(packageId: number) {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT p.*, c.name AS custodian_name, d.name AS depository_name
       FROM docufill_packages p
       LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
       LEFT JOIN docufill_depositories d ON d.id = p.depository_id
      WHERE p.id = $1`,
    [packageId],
  );
  return rows[0] as Record<string, unknown> | undefined;
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
    res.json({ custodians: custodians.rows, depositories: depositories.rows, packages: packages.rows });
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
    const db = getDb();
    const { rows } = await db.query(
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
        body.documents === undefined ? JSON.stringify(existing.documents ?? []) : jsonParam(body.documents),
        body.fields === undefined ? JSON.stringify(existing.fields ?? []) : jsonParam(body.fields),
        body.mappings === undefined ? JSON.stringify(existing.mappings ?? []) : jsonParam(body.mappings),
        id,
      ],
    );
    res.json({ package: rows[0] });
  } catch (err) {
    logger.error({ err }, "[DocuFill] Failed to update package");
    res.status(500).json({ error: "Failed to update package" });
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
    const token = `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, deal_id, source, status, prefill, answers)
       VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb,'{}'::jsonb)
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
        WHERE s.token = $1`,
      [req.params.token],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    res.json({ session: rows[0] });
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
        WHERE s.token = $1`,
      [req.params.token],
    );
    const session = rows[0] as Record<string, unknown> | undefined;
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const generated = {
      packageName: session.package_name,
      packageVersion: session.package_version,
      custodian: session.custodian_name,
      depository: session.depository_name,
      documentCount: Array.isArray(session.documents) ? session.documents.length : 0,
      mappingCount: Array.isArray(session.mappings) ? session.mappings.length : 0,
      generatedAt: new Date().toISOString(),
    };
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
      `SELECT s.*, p.name AS package_name, p.documents, p.fields,
              c.name AS custodian_name, d.name AS depository_name
         FROM docufill_interview_sessions s
         JOIN docufill_packages p ON p.id = s.package_id
         LEFT JOIN docufill_custodians c ON c.id = p.custodian_id
         LEFT JOIN docufill_depositories d ON d.id = p.depository_id
        WHERE s.token = $1`,
      [req.params.token],
    );
    const session = rows[0] as Record<string, unknown> | undefined;
    if (!session) {
      res.status(404).json({ error: "Interview session not found" });
      return;
    }
    const answers = typeof session.answers === "object" && session.answers ? session.answers as Record<string, unknown> : {};
    const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
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
    Object.entries(prefill).forEach(([key, value]) => {
      doc.fontSize(10).text(`${key}: ${String(value ?? "")}`);
    });
    doc.moveDown();
    doc.fontSize(14).text("Interview Answers");
    Object.entries(answers).forEach(([key, value]) => {
      doc.fontSize(10).text(`${key}: ${String(value ?? "")}`);
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
