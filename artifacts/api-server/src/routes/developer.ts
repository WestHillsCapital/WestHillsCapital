import { Router, type Request } from "express";
import { z } from "zod";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { requireRole } from "../middleware/requireRole";
import { parseDocupleteFields, hydratePackageFields } from "../lib/docuplete-redaction";
import { SOURCE_KEY_TO_HUBSPOT } from "../lib/hubspot-account";

const router = Router();

const requireMemberRole = requireRole("member");
const requireAdminRole  = requireRole("admin");

function acctId(req: Request): number {
  const id = (req as Request & { internalAccountId?: number }).internalAccountId;
  if (!id) throw new Error("BUG: acctId() called without resolved account");
  return id;
}

// ── Lazy migration: add source_key_mappings column if not present ──────────────
let _migrationDone = false;
async function ensureColumn() {
  if (_migrationDone) return;
  try {
    await getDb().query(
      `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source_key_mappings jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    _migrationDone = true;
  } catch (err) {
    logger.warn({ err }, "[Developer] Could not ensure source_key_mappings column");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /source-keys
// Returns all source keys across all packages for the account, grouped by key.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/source-keys", requireMemberRole, async (req, res) => {
  await ensureColumn();
  try {
    const db        = getDb();
    const accountId = acctId(req);

    const { rows: packages } = await db.query<{
      id: number; name: string; status: string; fields: unknown;
    }>(
      `SELECT id, name, status, fields
         FROM docuplete_packages
        WHERE account_id = $1
        ORDER BY name ASC`,
      [accountId],
    );

    // Collect library field IDs referenced by any package
    const libraryIds = new Set<string>();
    for (const pkg of packages) {
      for (const f of parseDocupleteFields(pkg.fields)) {
        if (f.libraryFieldId) libraryIds.add(f.libraryFieldId);
      }
    }

    type LibraryRow = Record<string, unknown> & { id: string };
    let libraryFields: LibraryRow[] = [];
    if (libraryIds.size > 0) {
      const { rows } = await db.query<LibraryRow>(
        `SELECT id, label, category, field_type, source, options, sensitive, required
           FROM docuplete_fields
          WHERE id = ANY($1::text[])`,
        [Array.from(libraryIds)],
      );
      libraryFields = rows;
    }

    // Group fields by source key
    type SkField = {
      fieldId: string; fieldLabel: string; fieldType: string; sensitive: boolean;
      packageId: number; packageName: string; packageStatus: string;
      interviewMode: string | null;
    };
    const grouped = new Map<string, { sourceKey: string; fields: SkField[] }>();

    for (const pkg of packages) {
      const hydrated = hydratePackageFields(pkg.fields, libraryFields);
      for (const f of hydrated) {
        const sk = f.source && f.source !== "interview" ? f.source : null;
        if (!sk) continue;
        const entry = grouped.get(sk) ?? { sourceKey: sk, fields: [] };
        entry.fields.push({
          fieldId:       f.id,
          fieldLabel:    String(f.label ?? f.name ?? f.id),
          fieldType:     String(f.field_type ?? "text"),
          sensitive:     f.sensitive === true,
          packageId:     pkg.id,
          packageName:   pkg.name,
          packageStatus: pkg.status,
          interviewMode: typeof f.interviewMode === "string" ? f.interviewMode : null,
        });
        grouped.set(sk, entry);
      }
    }

    // Count sessions per package so we can surface usage per source key
    const allPackageIds = packages.map((p) => p.id);
    const sessionCountByPackage = new Map<number, number>();
    if (allPackageIds.length > 0) {
      const { rows: sessionRows } = await db.query<{ package_id: number; cnt: string }>(
        `SELECT package_id, COUNT(*) AS cnt
           FROM docuplete_interview_sessions
          WHERE package_id = ANY($1::int[])
          GROUP BY package_id`,
        [allPackageIds],
      );
      for (const row of sessionRows) {
        sessionCountByPackage.set(Number(row.package_id), parseInt(row.cnt, 10));
      }
    }

    const sourceKeys = Array.from(grouped.values())
      .map((g) => {
        const uniquePkgIds = [...new Set(g.fields.map((f) => f.packageId))];
        const sessionCount = uniquePkgIds.reduce(
          (sum, pid) => sum + (sessionCountByPackage.get(pid) ?? 0),
          0,
        );
        return {
          ...g,
          packageCount:           uniquePkgIds.length,
          sessionCount,
          builtinHubspotProperty: SOURCE_KEY_TO_HUBSPOT[g.sourceKey] ?? null,
        };
      })
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));

    const packageList = packages.map((p) => ({ id: p.id, name: p.name, status: p.status }));

    return void res.json({ sourceKeys, packages: packageList });
  } catch (err) {
    logger.error({ err }, "[Developer] Failed to list source keys");
    return void res.status(500).json({ error: "Failed to load source keys" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /source-keys  — update a single field's source key within a package
// Body: { packageId, fieldId, newSourceKey }
// ─────────────────────────────────────────────────────────────────────────────
const PatchSourceKeySchema = z.object({
  packageId:    z.number().int().positive(),
  fieldId:      z.string().min(1),
  newSourceKey: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9_]*$/, "Source key may only contain letters, numbers, and underscores"),
});

router.patch("/source-keys", requireAdminRole, async (req, res) => {
  try {
    const parse = PatchSourceKeySchema.safeParse(req.body);
    if (!parse.success) {
      return void res.status(400).json({
        error: "Invalid request",
        issues: parse.error.issues.map((i) => i.message),
      });
    }
    const { packageId, fieldId, newSourceKey } = parse.data;
    const db        = getDb();
    const accountId = acctId(req);

    const { rows } = await db.query<{ id: number; fields: unknown }>(
      `SELECT id, fields FROM docuplete_packages WHERE id = $1 AND account_id = $2 LIMIT 1`,
      [packageId, accountId],
    );
    const pkg = rows[0];
    if (!pkg) return void res.status(404).json({ error: "Package not found" });

    const fields  = parseDocupleteFields(pkg.fields);
    const idx     = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) return void res.status(404).json({ error: "Field not found in package" });

    fields[idx] = { ...fields[idx], source: newSourceKey || "interview" };

    await db.query(
      `UPDATE docuplete_packages SET fields = $1::jsonb, updated_at = NOW() WHERE id = $2 AND account_id = $3`,
      [JSON.stringify(fields), packageId, accountId],
    );

    logger.info({ accountId, packageId, fieldId, newSourceKey }, "[Developer] Source key updated");
    return void res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Developer] Failed to update source key");
    return void res.status(500).json({ error: "Failed to update source key" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /source-key-mappings  — account's custom HubSpot + CSV column mappings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/source-key-mappings", requireMemberRole, async (req, res) => {
  await ensureColumn();
  try {
    const db        = getDb();
    const accountId = acctId(req);
    const { rows }  = await db.query<{ source_key_mappings: unknown }>(
      `SELECT source_key_mappings FROM accounts WHERE id = $1`,
      [accountId],
    );
    const raw     = (rows[0]?.source_key_mappings ?? {}) as Record<string, unknown>;
    const hubspot = (raw.hubspot ?? {}) as Record<string, string>;
    const csv     = (raw.csv ?? {})     as Record<string, string>;
    return void res.json({ mappings: { hubspot, csv } });
  } catch (err) {
    logger.error({ err }, "[Developer] Failed to load source key mappings");
    return void res.json({ mappings: { hubspot: {}, csv: {} } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /source-key-mappings  — replace the account's custom mappings
// Body: { hubspot: Record<string,string>, csv: Record<string,string> }
// ─────────────────────────────────────────────────────────────────────────────
const MappingsSchema = z.object({
  hubspot: z.record(z.string(), z.string()).optional().default({}),
  csv:     z.record(z.string(), z.string()).optional().default({}),
});

router.put("/source-key-mappings", requireAdminRole, async (req, res) => {
  await ensureColumn();
  try {
    const parse = MappingsSchema.safeParse(req.body);
    if (!parse.success) {
      return void res.status(400).json({ error: "Invalid mappings format" });
    }
    const db        = getDb();
    const accountId = acctId(req);
    await db.query(
      `UPDATE accounts SET source_key_mappings = $1::jsonb WHERE id = $2`,
      [JSON.stringify(parse.data), accountId],
    );
    return void res.json({ ok: true, mappings: parse.data });
  } catch (err) {
    logger.error({ err }, "[Developer] Failed to save source key mappings");
    return void res.status(500).json({ error: "Failed to save mappings" });
  }
});

export default router;
