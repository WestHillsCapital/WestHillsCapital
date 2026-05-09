import { randomBytes } from "node:crypto";
import { Router } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { seedDemoPackage, DEMO_FIELDS } from "../lib/demoPackage";

const router = Router();

const APP_ORIGIN = process.env.APP_ORIGIN ?? "https://docuplete.com";

// In-process cache so warm requests skip the DB bootstrap check entirely.
let _sandboxAccountId: number | null = null;
let _sandboxPackageId: number | null = null;

type SandboxCtx = { accountId: number; packageId: number };

/**
 * Lazily find-or-create the global sandbox account + demo package.
 * Uses a PostgreSQL advisory lock (id 777_777) to serialise concurrent
 * cold-start requests so only one process does the bootstrap work.
 */
async function getOrCreateSandbox(): Promise<SandboxCtx> {
  if (_sandboxAccountId && _sandboxPackageId) {
    return { accountId: _sandboxAccountId, packageId: _sandboxPackageId };
  }

  const db = getDb();
  const client = await db.connect();
  let accountId: number;
  let justCreated = false;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(777777)");

    const existing = await client.query<{ id: number }>(
      `SELECT id FROM accounts WHERE slug = 'docuplete-sandbox' LIMIT 1`,
    );

    if (existing.rows.length > 0) {
      accountId = existing.rows[0].id;
    } else {
      const result = await client.query<{ id: number }>(
        `INSERT INTO accounts (name, slug, plan_tier)
         VALUES ('Docuplete Sandbox', 'docuplete-sandbox', 'pro')
         RETURNING id`,
      );
      accountId = result.rows[0].id;
      justCreated = true;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Seed demo package outside the advisory-lock transaction so seedDemoPackage
  // can use its own internal mutex (docufill_migration_state ON CONFLICT).
  if (justCreated) {
    await seedDemoPackage(db, accountId);
  }

  // Refresh the sandbox package's fields on every cold start so the live DB
  // stays in sync with DEMO_FIELDS (fixes stale rows that pre-date interviewMode).
  await db.query(
    `UPDATE docufill_packages SET fields = $1::jsonb WHERE account_id = $2 AND status = 'active'`,
    [JSON.stringify(DEMO_FIELDS), accountId],
  );

  // Always ensure the sandbox package has auth_level = 'none' (defense in depth:
  // seedDemoPackage may run before this update, or the package may have been
  // modified externally).
  await db.query(
    `UPDATE docufill_packages SET auth_level = 'none' WHERE account_id = $1 AND auth_level != 'none'`,
    [accountId],
  );

  const pkgResult = await db.query<{ id: number; version: number; transaction_scope: string | null }>(
    `SELECT id, version, transaction_scope
       FROM docufill_packages
      WHERE account_id = $1 AND status = 'active'
      LIMIT 1`,
    [accountId],
  );

  if (pkgResult.rows.length === 0) {
    throw new Error("[Sandbox] Demo package not found after seeding");
  }

  _sandboxAccountId = accountId;
  _sandboxPackageId = pkgResult.rows[0].id;

  return { accountId: _sandboxAccountId, packageId: _sandboxPackageId };
}

/**
 * GET /api/v1/sandbox/start
 *
 * Publicly accessible — no API key or session token required.
 *
 * Creates a demo DocuFill session, optionally pre-filled with values
 * supplied as URL query parameters, and returns the interview URL the
 * caller should redirect to.
 *
 * Query params (all optional):
 *   firstName, lastName, email, dateOfBirth, addressLine1, city, state, zip
 *
 * Response 200:
 *   { sessionToken, interviewUrl, prefill, expiresAt }
 */
router.get("/start", async (req, res) => {
  try {
    const db = getDb();
    const { accountId, packageId } = await getOrCreateSandbox();

    // Collect whitelisted URL params → prefill keyed by source key
    const prefill: Record<string, string> = {};
    const paramMap: Record<string, string> = {
      firstName:    "firstName",
      lastName:     "lastName",
      email:        "email",
      dateOfBirth:  "dateOfBirth",
      addressLine1: "addressLine1",
      city:         "city",
      state:        "state",
      zip:          "zip",
    };
    for (const [param, sourceKey] of Object.entries(paramMap)) {
      const val = typeof req.query[param] === "string" ? (req.query[param] as string).trim() : "";
      if (val) prefill[sourceKey] = val;
    }

    // Fetch live package metadata
    const pkg = await db.query<{ version: number; transaction_scope: string | null }>(
      `SELECT version, transaction_scope FROM docufill_packages WHERE id = $1`,
      [packageId],
    );
    if (pkg.rows.length === 0) {
      res.status(500).json({ error: "Sandbox package not found" });
      return;
    }
    const { version, transaction_scope } = pkg.rows[0];

    const token     = `df_sbx_${randomBytes(16).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000); // 7 days

    await db.query(
      `INSERT INTO docufill_interview_sessions
         (token, package_id, package_version, transaction_scope, account_id,
          source, status, prefill, answers, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'sandbox', 'draft', $6::jsonb, '{}'::jsonb, $7)`,
      [token, packageId, version ?? 1, transaction_scope ?? null, accountId,
       JSON.stringify(prefill), expiresAt],
    );

    const interviewUrl = `${APP_ORIGIN}/docuplete/public/${token}?sandbox=1`;

    logger.info({ token, prefillKeys: Object.keys(prefill) }, "[Sandbox] Session started");

    res.json({
      sessionToken: token,
      interviewUrl,
      prefill,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "[Sandbox] Failed to start sandbox session");
    res.status(500).json({ error: "Failed to start sandbox session" });
  }
});

export default router;
