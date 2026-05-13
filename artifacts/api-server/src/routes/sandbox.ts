import { randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import cors from "cors";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { seedDemoPackage, DEMO_FIELDS } from "../lib/demoPackage";
import { sendSandboxKeyVerificationEmail, sendSandboxKeysEmail } from "../lib/email";

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
/**
 * Self-heal the sandbox package's auth_level on every call. Cheap indexed UPDATE
 * (WHERE clause on indexed account_id, no-op when already 'none'). Necessary
 * because external writes (admin PATCH /packages/:id, migrations, manual SQL)
 * can flip auth_level to 'email_otp', which would gate the demo behind real
 * email OTP and produce a 401 from /generate — a bug observed in production.
 */
async function ensureSandboxAuthLevelNone(accountId: number): Promise<void> {
  const db = getDb();
  await db.query(
    `UPDATE docuplete_packages SET auth_level = 'none' WHERE account_id = $1 AND auth_level != 'none'`,
    [accountId],
  );
}

async function getOrCreateSandbox(): Promise<SandboxCtx> {
  if (_sandboxAccountId && _sandboxPackageId) {
    // Self-heal on every call — see ensureSandboxAuthLevelNone for rationale.
    await ensureSandboxAuthLevelNone(_sandboxAccountId);
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
  // can use its own internal mutex (docuplete_migration_state ON CONFLICT).
  if (justCreated) {
    await seedDemoPackage(db, accountId);
  }

  // Refresh the sandbox package's fields on every cold start so the live DB
  // stays in sync with DEMO_FIELDS (fixes stale rows that pre-date interviewMode).
  await db.query(
    `UPDATE docuplete_packages SET fields = $1::jsonb WHERE account_id = $2 AND status = 'active'`,
    [JSON.stringify(DEMO_FIELDS), accountId],
  );

  // Always ensure the sandbox package has auth_level = 'none' (defense in depth:
  // seedDemoPackage may run before this update, or the package may have been
  // modified externally).
  await ensureSandboxAuthLevelNone(accountId);

  const pkgResult = await db.query<{ id: number; version: number; transaction_scope: string | null }>(
    `SELECT id, version, transaction_scope
       FROM docuplete_packages
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
 * Creates a demo Docuplete session, optionally pre-filled with values
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

    // Self-heal on every /start call: overwrite the package fields and auth_level
    // so any external mutation (migration, admin action, library hydration write-back)
    // is undone before the new session is created. Cheap — indexed UPDATE is a no-op
    // when the values are already correct.
    await db.query(
      `UPDATE docuplete_packages
          SET fields = $1::jsonb, auth_level = 'none'
        WHERE account_id = $2 AND status = 'active'`,
      [JSON.stringify(DEMO_FIELDS), accountId],
    );

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
      `SELECT version, transaction_scope FROM docuplete_packages WHERE id = $1`,
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
      `INSERT INTO docuplete_interview_sessions
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

// ── Disposable / temp email domain blocklist ─────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.de",
  "10minutemail.co.uk","10minutemail.co.za","10minutemail.us",
  "tempmail.com","tempmail.net","temp-mail.org","temp-mail.io","tempinbox.com",
  "throwam.com","throwaway.email","throwaways.email",
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.de",
  "guerrillamail.info","guerrillamail.biz","guerrillamailblock.com","grr.la",
  "sharklasers.com","spam4.me",
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc",
  "nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf",
  "moncourrier.fr.nf","monemail.fr.nf",
  "mailinator.com","mailinator2.com","notmailinator.com",
  "trashmail.at","trashmail.com","trashmail.io","trashmail.me",
  "trashmail.net","trashmail.org","trashmail.se",
  "discard.email","discardmail.com","discardmail.de",
  "fakeinbox.com","mailnull.com","mailnesia.com",
  "spamgourmet.com","spambox.us","spambox.info","spambox.me","spambox.org",
  "getonemail.com","getonemail.net",
  "mailexpire.com","filzmail.de","devnullmail.com",
  "mytrashmail.com","nobulk.com","nospamfor.us",
  "mt2015.com","trash2009.com","trash2010.com","trash2011.com",
  "spamspot.com","crazymailing.com","put2.net","rklips.com","rmqkr.net",
  "spam.la","spam.su","mailmetrash.com","mailin8r.com",
  "veryrealemail.com","chogmail.com",
  "getnada.com","maildrop.cc","spamgob.com",
  "mintemail.com","mailseal.de","pookmail.com",
  "sogetthis.com","shortmail.net",
  "klzlk.com","trbvm.com","vipxm.net","miucce.com",
  "pfui.ru","tafmail.com","uroid.com",
  "binkmail.com","bobmail.info","dacoolest.com",
  "dontreg.com","dontsendmespam.de",
  "safetymail.info","rejectmail.com","safe-mail.net",
  "spamoff.de","supergreatmail.com","thanksnospam.com",
  "uggsrock.com","wetrainbayarea.org","yomail.info",
  "zippymail.info","anonmails.de","fakemails.net",
  "tempsky.com","haltospam.com","trashmail.at",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

// ── Lazy table migration ──────────────────────────────────────────────────────
let _sandboxKeyTableReady = false;

async function ensureSandboxKeyTable(): Promise<void> {
  if (_sandboxKeyTableReady) return;
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS sandbox_key_requests (
      id                SERIAL PRIMARY KEY,
      email             TEXT NOT NULL UNIQUE,
      otp_code          CHAR(6),
      otp_expires_at    TIMESTAMPTZ,
      sandbox_key       TEXT,
      verified_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      request_count     INTEGER NOT NULL DEFAULT 1
    )
  `);
  _sandboxKeyTableReady = true;
}

// CORS: these two endpoints are public and credentialless — allow any origin
// so the Docuplete docs site can call them regardless of which domain it runs on.
const publicCors = cors({ origin: "*" });

// ── POST /api/v1/sandbox/request-key ─────────────────────────────────────────
router.options("/request-key", publicCors);
router.post("/request-key", publicCors, async (req, res) => {
  try {
    await ensureSandboxKeyTable();

    const raw = (req.body as Record<string, unknown>);
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const isResend = raw.resend === true;

    // ── Validate email format ───────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(422).json({ error: "Please enter a valid email address." });
      return;
    }

    // ── Block disposable email addresses ───────────────────────────────────
    if (isDisposableEmail(email)) {
      res.status(422).json({
        error: "Temporary email addresses are not allowed. Please use your real work or personal email.",
      });
      return;
    }

    const db = getDb();

    // ── Rate limit: no more than one OTP per 60 s per email ────────────────
    const existing = await db.query<{
      last_requested_at: Date;
      sandbox_key: string | null;
    }>(
      `SELECT last_requested_at, sandbox_key FROM sandbox_key_requests WHERE email = $1`,
      [email],
    );

    if (existing.rows.length > 0) {
      const secondsSinceLast =
        (Date.now() - new Date(existing.rows[0].last_requested_at).getTime()) / 1_000;
      if (secondsSinceLast < 60) {
        res.status(429).json({
          error: "Please wait a moment before requesting another code.",
        });
        return;
      }
    }

    // ── Generate 6-digit OTP ────────────────────────────────────────────────
    const otp = randomInt(100_000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1_000); // 15 minutes

    // ── Upsert record ───────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO sandbox_key_requests
         (email, otp_code, otp_expires_at, last_requested_at, request_count)
       VALUES ($1, $2, $3, NOW(), 1)
       ON CONFLICT (email) DO UPDATE
         SET otp_code          = EXCLUDED.otp_code,
             otp_expires_at    = EXCLUDED.otp_expires_at,
             last_requested_at = NOW(),
             request_count     = sandbox_key_requests.request_count + 1`,
      [email, otp, expiresAt],
    );

    // ── Send OTP email (non-fatal on failure) ───────────────────────────────
    try {
      await sendSandboxKeyVerificationEmail(email, otp);
    } catch (emailErr) {
      logger.warn({ err: emailErr, email }, "[Sandbox] OTP email send failed");
    }

    logger.info({ email, isResend }, "[Sandbox] Key request OTP sent");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Sandbox] /request-key failed");
    res.status(500).json({ error: "Failed to send verification code. Please try again." });
  }
});

// ── POST /api/v1/sandbox/verify-key ──────────────────────────────────────────
router.options("/verify-key", publicCors);
router.post("/verify-key", publicCors, async (req, res) => {
  try {
    await ensureSandboxKeyTable();

    const raw = (req.body as Record<string, unknown>);
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    const code  = typeof raw.code  === "string" ? raw.code.trim().replace(/\s/g, "") : "";

    if (!email || !code) {
      res.status(422).json({ error: "Email and code are required." });
      return;
    }

    const db = getDb();
    const result = await db.query<{
      otp_code: string | null;
      otp_expires_at: Date | null;
      sandbox_key: string | null;
      verified_at: Date | null;
    }>(
      `SELECT otp_code, otp_expires_at, sandbox_key, verified_at
         FROM sandbox_key_requests WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No verification request found for this email. Please request a code first." });
      return;
    }

    const row = result.rows[0];

    // ── Already verified — return the existing key ──────────────────────────
    if (row.verified_at && row.sandbox_key) {
      res.json({ sandboxKey: row.sandbox_key });
      return;
    }

    // ── Check expiry ────────────────────────────────────────────────────────
    if (!row.otp_expires_at || new Date(row.otp_expires_at) < new Date()) {
      res.status(422).json({ error: "This code has expired. Please request a new one." });
      return;
    }

    // ── Check code ──────────────────────────────────────────────────────────
    if (row.otp_code !== code) {
      res.status(422).json({ error: "Invalid code. Please check your email and try again." });
      return;
    }

    // ── Generate sandbox key ────────────────────────────────────────────────
    const sandboxKey = `dp_test_${randomBytes(20).toString("hex")}`;

    await db.query(
      `UPDATE sandbox_key_requests
          SET sandbox_key    = $1,
              verified_at    = NOW(),
              otp_code       = NULL,
              otp_expires_at = NULL
        WHERE email = $2`,
      [sandboxKey, email],
    );

    // ── Email the key to the user (async, non-fatal) ────────────────────────
    sendSandboxKeysEmail(email, sandboxKey).catch((err: unknown) => {
      logger.warn({ err, email }, "[Sandbox] Keys delivery email failed (non-fatal)");
    });

    logger.info({ email }, "[Sandbox] Sandbox key issued");
    res.json({ sandboxKey });
  } catch (err) {
    logger.error({ err }, "[Sandbox] /verify-key failed");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

export default router;
