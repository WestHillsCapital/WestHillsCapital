import { randomBytes, createHash } from "crypto";
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { hashApiKey } from "../middleware/requireApiKeyAuth";
import { requireProductAuth } from "../middleware/requireProductAuth";
import { requireAdminRole } from "../middleware/requireRole";
import { requirePlanFeature } from "../middleware/requirePlanFeature";
import { linkPendingInvitation } from "../lib/auth-utils";
import { seedDemoPackage } from "../lib/demoPackage";
import { seedIndustryFields } from "../lib/industryFieldSeeds";
import { insertAuditLog, getActorEmail } from "../lib/auditLog";
import { getUserEmailsToNotify, sendInAppNotifications } from "../lib/notificationPrefs";
import { sendOrgAlertEmails } from "../lib/email";
import { verifySync as totpVerifySync } from "otplib";
import { isRateLimited, isCurrentlyBlocked } from "../lib/ratelimit";

const TOTP_FAIL_MAX = 10;
const TOTP_FAIL_WINDOW_MS = 60 * 1000;

const TRUSTED_DEVICE_COOKIE = "td_token";
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

function hashDeviceToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseUserAgentLabel(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown" };
  let browser = "Unknown";
  let os = "Unknown";
  if (/chrome\/[\d.]+/i.test(ua) && !/chromium|edg|opr/i.test(ua)) browser = "Chrome";
  else if (/firefox\/[\d.]+/i.test(ua)) browser = "Firefox";
  else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/edg\/[\d.]+/i.test(ua)) browser = "Edge";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  return { browser, os };
}

const router = Router();

const API_KEY_PREFIX = "sk_live_";
const MAX_KEYS_PER_ACCOUNT = 25;

/**
 * POST /api/v1/product/auth/onboard
 *
 * Called immediately after a new user signs up via Clerk.
 * Creates an accounts row + account_users row for the new tenant,
 * or returns the existing account if they've already onboarded.
 *
 * Body: { companyName: string }
 * Requires: Clerk session (Authorization via Clerk JWT or cookie)
 */
router.post("/onboard", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    return void res.status(401).json({ error: "Authentication required." });
  }

  const email: string | undefined = (req.body as { email?: string }).email?.trim().toLowerCase();
  const companyName: string | undefined = (req.body as { companyName?: string }).companyName?.trim();
  const industry: string | undefined = (req.body as { industry?: string }).industry?.trim() || undefined;

  if (!email) {
    return void res.status(400).json({ error: "email is required." });
  }

  try {
    const existing = await getDb().query<{ account_id: number; account_name: string; slug: string }>(
      `SELECT au.account_id, a.name AS account_name, a.slug
       FROM account_users au
       JOIN accounts a ON a.id = au.account_id
       WHERE au.clerk_user_id = $1
       LIMIT 1`,
      [clerkUserId],
    );

    if (existing.rows[0]) {
      return void res.json({
        accountId:   existing.rows[0].account_id,
        accountName: existing.rows[0].account_name,
        slug:        existing.rows[0].slug,
        created:     false,
      });
    }

    const name = companyName || email.split("@")[0] || "My Company";
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${slugBase}-${Date.now()}`;

    const acctResult = await getDb().query<{ id: number }>(
      `INSERT INTO accounts (name, slug, industry) VALUES ($1, $2, $3) RETURNING id`,
      [name, slug, industry ?? null],
    );
    const accountId = acctResult.rows[0].id;

    await getDb().query(
      `INSERT INTO account_users (account_id, email, role, clerk_user_id)
       VALUES ($1, $2, 'admin', $3)
       ON CONFLICT (account_id, email) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id`,
      [accountId, email, clerkUserId],
    );

    logger.info({ accountId, email, clerkUserId }, "[ProductAuth] New tenant onboarded");

    // Provision demo package — await so it exists before the user reaches the app.
    // Non-fatal: a failure here should not block account creation.
    await seedDemoPackage(getDb(), accountId).catch((err) => {
      logger.warn({ err, accountId }, "[ProductAuth] Demo package seed failed (non-fatal)");
    });

    // Seed industry-specific fields into this account's field library (non-fatal).
    // Always runs — seedIndustryFields defaults to "general" when industry is null.
    await seedIndustryFields(getDb(), accountId, industry ?? null).catch((err) => {
      logger.warn({ err, accountId, industry }, "[ProductAuth] Industry field seed failed (non-fatal)");
    });

    return void res.status(201).json({
      accountId,
      accountName: name,
      slug,
      created: true,
    });
  } catch (err) {
    logger.error({ err }, "[ProductAuth] Onboard error");
    return void res.status(500).json({ error: "Failed to create account." });
  }
});

/**
 * @openapi
 * /product/auth/me:
 *   get:
 *     tags:
 *       - Product Portal — Auth
 *     summary: Get current account
 *     description: |
 *       Returns account and user information for the authenticated session.
 *       Accepts both Clerk JWTs and API keys (`sk_live_...`).
 *
 *       When authenticated via API key, `email` is `null` (keys are account-scoped,
 *       not user-scoped) and `role` is `"member"`.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Account info
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountInfo'
 *       401:
 *         description: Missing or invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", requireProductAuth, async (req, res) => {
  // requireProductAuth handles both Clerk JWT and API key (sk_live_...) auth.
  // After it runs, req.internalAccountId and req.productUserRole are guaranteed set.
  const accountId = req.internalAccountId!;

  // If auth came via Clerk, we may need to return user-specific fields (email/role).
  // Check for a Clerk user to see if we can get user details.
  const auth = getAuth(req);
  const clerkUserId = auth?.userId ?? null;

  try {
    type MeRow = { account_id: number; account_name: string; slug: string; email: string | null; role: string; logo_url: string | null };

    if (clerkUserId) {
      // Clerk path: look up user record for email and role
      let result = await getDb().query<MeRow>(
        `SELECT au.account_id, a.name AS account_name, a.slug, a.logo_url, au.email, au.role
           FROM account_users au
           JOIN accounts a ON a.id = au.account_id
          WHERE au.clerk_user_id = $1 AND au.status = 'active'
          LIMIT 1`,
        [clerkUserId],
      );

      // Link pending invitation on first sign-in (invitation flow)
      if (!result.rows[0]) {
        const linked = await linkPendingInvitation(clerkUserId);
        if (linked) {
          const acc = await getDb().query<{ name: string; slug: string; logo_url: string | null }>(
            `SELECT name, slug, logo_url FROM accounts WHERE id = $1`,
            [linked.account_id],
          );
          result = {
            rows: [{
              account_id:   linked.account_id,
              account_name: acc.rows[0]?.name ?? "",
              slug:         acc.rows[0]?.slug ?? "",
              logo_url:     acc.rows[0]?.logo_url ?? null,
              email:        linked.email,
              role:         linked.role,
            }],
          } as typeof result;
        }
      }

      if (!result.rows[0]) {
        return void res.status(404).json({ error: "Account not found.", code: "ACCOUNT_NOT_FOUND" });
      }

      const row = result.rows[0];
      return void res.json({
        accountId:    row.account_id,
        accountName:  row.account_name,
        slug:         row.slug,
        email:        row.email,
        role:         row.role,
        orgLogoUrl:   row.logo_url ? `/api/storage/org-logo/${row.account_id}` : null,
      });
    }

    // API key path: look up account by ID; no specific user context
    const acc = await getDb().query<{ name: string; slug: string; logo_url: string | null }>(
      `SELECT name, slug, logo_url FROM accounts WHERE id = $1 LIMIT 1`,
      [accountId],
    );

    if (!acc.rows[0]) {
      return void res.status(404).json({ error: "Account not found.", code: "ACCOUNT_NOT_FOUND" });
    }

    return void res.json({
      accountId:   accountId,
      accountName: acc.rows[0].name,
      slug:        acc.rows[0].slug,
      email:       null,
      role:        req.productUserRole ?? "member",
      orgLogoUrl:  acc.rows[0].logo_url ? `/api/storage/org-logo/${accountId}` : null,
    });
  } catch (err) {
    logger.error({ err }, "[ProductAuth] /me error");
    return void res.status(500).json({ error: "Server error." });
  }
});

/**
 * POST /api/v1/product/auth/verify-2fa
 *
 * Verifies a TOTP code (or backup code) for the current Clerk session.
 * When successful, marks the session as 2FA-verified so subsequent requests
 * are allowed through requireProductAuth without another TOTP challenge.
 *
 * Body: { code: string }
 * Requires: Clerk JWT (called before requireProductAuth would block access)
 */
router.post("/verify-2fa", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? req.socket?.remoteAddress ?? null;

  if (!clerkUserId) {
    return void res.status(401).json({ error: "Authentication required." });
  }

  // Rate limit by combined IP + Clerk user ID so that users on shared IPs
  // don't block each other. This is a cheap in-memory check before any DB work.
  const ipUserKey = `totp_fail:ip:${ip ?? "unknown"}:uid:${clerkUserId}`;
  if (isCurrentlyBlocked(ipUserKey, TOTP_FAIL_MAX, TOTP_FAIL_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many failed attempts. Please wait before trying again." });
  }

  const body = req.body as { code?: string; trustDevice?: boolean };
  const code = (body.code ?? "").trim();
  const trustDevice = body.trustDevice === true;
  if (!code) {
    return void res.status(400).json({ error: "code is required." });
  }

  try {
    const userResult = await getDb().query<{
      id: number;
      account_id: number;
      role: string;
      totp_enabled: boolean;
      totp_secret: string | null;
      totp_backup_codes: string[];
    }>(
      `SELECT id, account_id, role, totp_enabled, totp_secret, totp_backup_codes
         FROM account_users
        WHERE clerk_user_id = $1 AND status = 'active'
        LIMIT 1`,
      [clerkUserId],
    );

    if (!userResult.rows[0]) {
      return void res.status(404).json({ error: "Account not found.", code: "ACCOUNT_NOT_FOUND" });
    }

    const user = userResult.rows[0];

    // Also check per-user rate limit (blocks cross-IP brute-force on the same account)
    const userKey = `totp_fail:user:${user.id}`;
    if (isCurrentlyBlocked(userKey, TOTP_FAIL_MAX, TOTP_FAIL_WINDOW_MS)) {
      return void res.status(429).json({ error: "Too many failed attempts. Please wait before trying again." });
    }

    if (!user.totp_enabled || !user.totp_secret) {
      return void res.status(400).json({ error: "Two-factor authentication is not enabled for this account." });
    }

    const secret = user.totp_secret;
    const storedHashes = user.totp_backup_codes ?? [];

    // Check TOTP code first — wrap in try/catch since otplib may throw on
    // malformed secrets or tokens rather than returning false
    let validTotp = false;
    try {
      validTotp = totpVerifySync({ token: code, secret }).valid;
    } catch {
      // Invalid token format or secret — treat as failed verification
      validTotp = false;
    }

    // Check backup code if TOTP didn't match
    const codeHash = hashBackupCode(code);
    const backupIndex = storedHashes.indexOf(codeHash);
    const validBackup = backupIndex !== -1;

    if (!validTotp && !validBackup) {
      // Increment rate limit counters on failed attempts (IP+user combined, and user-scoped).
      // Both must always be incremented, so avoid short-circuit evaluation.
      // If either counter crosses the threshold right now, return 429 immediately.
      const ipUserLimited = isRateLimited(ipUserKey, TOTP_FAIL_MAX, TOTP_FAIL_WINDOW_MS);
      const userLimited    = isRateLimited(userKey, TOTP_FAIL_MAX, TOTP_FAIL_WINDOW_MS);
      const nowLimited     = ipUserLimited || userLimited;
      if (nowLimited) {
        return void res.status(429).json({ error: "Too many failed attempts. Please wait before trying again." });
      }
      return void res.status(401).json({ error: "Invalid authentication code.", code: "TOTP_INVALID" });
    }

    const sessionId = auth?.sessionId ?? null;
    const ua = req.headers["user-agent"] ?? null;

    if (!sessionId) {
      return void res.status(400).json({ error: "No session ID found. Please sign in again." });
    }

    // If a backup code was used, consume it (remove from the stored list)
    if (validBackup && !validTotp) {
      const updatedCodes = [...storedHashes];
      updatedCodes.splice(backupIndex, 1);
      await getDb().query(
        `UPDATE account_users SET totp_backup_codes = $1 WHERE id = $2`,
        [updatedCodes, user.id],
      );
    }

    // Upsert the session record and mark it as 2FA-verified
    await getDb().query(
      `INSERT INTO user_active_sessions (account_id, user_id, clerk_session_id, ip_address, user_agent, totp_verified)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (clerk_session_id) DO UPDATE
           SET totp_verified  = TRUE,
               last_active_at = NOW(),
               ip_address     = EXCLUDED.ip_address,
               user_agent     = EXCLUDED.user_agent`,
      [user.account_id, user.id, sessionId, ip, ua],
    );

    logger.info({ userId: user.id, accountId: user.account_id, usedBackup: validBackup && !validTotp }, "[ProductAuth] 2FA verified for session");

    // Issue a trusted-device cookie if the user requested it
    if (trustDevice) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashDeviceToken(rawToken);
      const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);
      const { browser, os } = parseUserAgentLabel(ua);
      const label = `${browser} on ${os}`;

      await getDb().query(
        `INSERT INTO trusted_devices (user_id, account_id, token_hash, label, ip_address, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, user.account_id, tokenHash, label, ip, expiresAt],
      );

      res.cookie(TRUSTED_DEVICE_COOKIE, rawToken, {
        httpOnly: true,
        signed:   true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   TRUSTED_DEVICE_TTL_MS,
        path:     "/",
      });
    }

    return void res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[ProductAuth] verify-2fa error");
    return void res.status(500).json({ error: "Server error." });
  }
});

/**
 * POST /api/v1/product/auth/api-keys
 *
 * Create a new API key for the authenticated account.
 * Returns the plaintext key ONCE — it cannot be retrieved again.
 *
 * Body: { name: string }
 * Requires: Clerk JWT or existing API key
 *
 * @openapi
 * /product/auth/api-keys:
 *   post:
 *     tags:
 *       - Product Portal — API Keys
 *     summary: Create an API key
 *     description: |
 *       Creates a new API key scoped to the authenticated account.
 *       The full plaintext key is returned **once** and cannot be retrieved again — store it securely.
 *       Keys are prefixed with `sk_live_` and are stored as a SHA-256 hash.
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Production integration
 *                 description: Human-readable label for the key (max 100 characters).
 *     responses:
 *       201:
 *         description: API key created. The `key` field contains the plaintext key — shown only once.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 key:
 *                   type: string
 *                   example: "sk_live_a1b2c3d4e5f6…"
 *                   description: Full plaintext API key. Store securely — not shown again.
 *                 keyPrefix:
 *                   type: string
 *                   example: "sk_live_a1b2c3"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 note:
 *                   type: string
 *       400:
 *         description: Missing or invalid name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Maximum key limit reached
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/api-keys", requireProductAuth, requireAdminRole, requirePlanFeature("apiAccess"), async (req, res) => {
  const accountId = req.internalAccountId!;
  const name = ((req.body as { name?: string }).name ?? "").trim();

  if (!name) {
    return void res.status(400).json({ error: "name is required." });
  }
  if (name.length > 100) {
    return void res.status(400).json({ error: "name must be 100 characters or fewer." });
  }

  try {
    const countResult = await getDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM account_api_keys WHERE account_id = $1 AND revoked_at IS NULL`,
      [accountId],
    );
    if (parseInt(countResult.rows[0].count, 10) >= MAX_KEYS_PER_ACCOUNT) {
      return void res.status(409).json({
        error: `You have reached the maximum of ${MAX_KEYS_PER_ACCOUNT} active API keys. Revoke an existing key before creating a new one.`,
      });
    }

    const rawKey = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);

    const result = await getDb().query<{ id: number; created_at: Date }>(
      `INSERT INTO account_api_keys (account_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [accountId, name, keyHash, keyPrefix],
    );

    const row = result.rows[0];
    logger.info({ accountId, keyId: row.id }, "[ApiKeys] New API key created");

    const clerkUserId = getAuth(req)?.userId ?? null;
    const actorEmail = await getActorEmail(accountId, clerkUserId);
    void insertAuditLog({
      accountId,
      actorEmail,
      actorUserId: clerkUserId,
      action: "apikey.create",
      resourceType: "api_key",
      resourceId: String(row.id),
      resourceLabel: name,
    });

    // Notify org members who want api_key_created notifications
    void (async () => {
      try {
        const { rows: orgRows } = await getDb().query<{ name: string }>(
          `SELECT name FROM accounts WHERE id = $1`, [accountId],
        );
        const orgName = orgRows[0]?.name ?? "Docuplete";
        const notifTitle = "New API key created";
        const notifBody  = `The key "${name}" was created${actorEmail ? ` by ${actorEmail}` : ""}.`;

        const [emails] = await Promise.all([
          getUserEmailsToNotify(accountId, "api_key_created").then(list =>
            actorEmail ? list.filter(e => e !== actorEmail) : list,
          ),
          sendInAppNotifications(
            accountId,
            "api_key_created",
            notifTitle,
            notifBody,
            clerkUserId ? [clerkUserId] : [],
          ),
        ]);
        await sendOrgAlertEmails({
          recipientEmails: emails,
          orgName,
          subject:  `${orgName}: new API key created`,
          heading:  "A new API key was created",
          bodyHtml: `<p>A new API key named <strong>${name}</strong> was created in your organization${actorEmail ? ` by <strong>${actorEmail}</strong>` : ""}.</p><p>If you didn't expect this, please review your API keys in settings immediately.</p>`,
        });
      } catch (err) {
        logger.error({ err, accountId }, "[ApiKeys] Failed to send api_key_created notification emails");
      }
    })();

    return void res.status(201).json({
      id:         row.id,
      name,
      key:        rawKey,
      keyPrefix,
      createdAt:  row.created_at,
      note: "Store this key securely. It will not be shown again.",
    });
  } catch (err) {
    logger.error({ err }, "[ApiKeys] Failed to create API key");
    return void res.status(500).json({ error: "Failed to create API key." });
  }
});

/**
 * GET /api/v1/product/auth/api-keys
 *
 * List all active (non-revoked) API keys for the authenticated account.
 * Plaintext keys are never returned — only prefix and metadata.
 *
 * Requires: Clerk JWT or existing API key
 *
 * @openapi
 * /product/auth/api-keys:
 *   get:
 *     tags:
 *       - Product Portal — API Keys
 *     summary: List API keys
 *     description: Returns all API keys (active and revoked) for the authenticated account. Plaintext keys are never returned — only the prefix and metadata.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/api-keys", requireProductAuth, requireAdminRole, async (req, res) => {
  const accountId = req.internalAccountId!;

  try {
    const result = await getDb().query<{
      id: number;
      name: string;
      key_prefix: string;
      created_at: Date;
      revoked_at: Date | null;
      last_used_at: Date | null;
    }>(
      `SELECT id, name, key_prefix, created_at, revoked_at, last_used_at
         FROM account_api_keys
        WHERE account_id = $1
        ORDER BY created_at DESC`,
      [accountId],
    );

    return void res.json({
      keys: result.rows.map((row) => ({
        id:          row.id,
        name:        row.name,
        keyPrefix:   row.key_prefix,
        createdAt:   row.created_at,
        revokedAt:   row.revoked_at ?? null,
        lastUsedAt:  row.last_used_at ?? null,
        active:      row.revoked_at === null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[ApiKeys] Failed to list API keys");
    return void res.status(500).json({ error: "Failed to list API keys." });
  }
});

/**
 * PATCH /api/v1/product/auth/api-keys/:id
 *
 * Rename an active API key.
 * Only keys belonging to the authenticated account can be renamed.
 *
 * Body: { name: string }
 * Requires: Clerk JWT or existing API key
 *
 * @openapi
 * /product/auth/api-keys/{id}:
 *   patch:
 *     tags:
 *       - Product Portal — API Keys
 *     summary: Rename an API key
 *     description: Updates the human-readable name of an active API key. Only keys belonging to the authenticated account can be renamed.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The numeric ID of the API key to rename.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Staging server
 *                 description: New human-readable label for the key (max 100 characters).
 *     responses:
 *       200:
 *         description: Key renamed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *       400:
 *         description: Missing or invalid name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Key not found or already revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/api-keys/:id", requireProductAuth, requireAdminRole, async (req, res) => {
  const accountId = req.internalAccountId!;
  const keyId = parseInt(String(req.params.id ?? ""), 10);

  if (isNaN(keyId)) {
    return void res.status(400).json({ error: "Invalid key id." });
  }

  const name = ((req.body as { name?: string }).name ?? "").trim();
  if (!name) {
    return void res.status(400).json({ error: "name is required." });
  }
  if (name.length > 100) {
    return void res.status(400).json({ error: "name must be 100 characters or fewer." });
  }

  try {
    const result = await getDb().query<{ id: number; name: string }>(
      `UPDATE account_api_keys
          SET name = $1
        WHERE id = $2
          AND account_id = $3
          AND revoked_at IS NULL
        RETURNING id, name`,
      [name, keyId, accountId],
    );

    if (!result.rows[0]) {
      return void res.status(404).json({ error: "API key not found or already revoked." });
    }

    logger.info({ accountId, keyId, name }, "[ApiKeys] API key renamed");
    const clerkUserId = getAuth(req)?.userId ?? null;
    void insertAuditLog({
      accountId,
      actorEmail: await getActorEmail(accountId, clerkUserId),
      actorUserId: clerkUserId,
      action: "apikey.rename",
      resourceType: "api_key",
      resourceId: String(keyId),
      resourceLabel: name,
    });
    return void res.json({ success: true, id: keyId, name: result.rows[0].name });
  } catch (err) {
    logger.error({ err }, "[ApiKeys] Failed to rename API key");
    return void res.status(500).json({ error: "Failed to rename API key." });
  }
});

/**
 * DELETE /api/v1/product/auth/api-keys/:id
 *
 * Revoke an API key. The key is soft-deleted (revoked_at is set).
 * Only keys belonging to the authenticated account can be revoked.
 *
 * Requires: Clerk JWT or existing API key
 *
 * @openapi
 * /product/auth/api-keys/{id}:
 *   delete:
 *     tags:
 *       - Product Portal — API Keys
 *     summary: Revoke an API key
 *     description: Soft-revokes an API key. Revoked keys are rejected immediately. Only keys belonging to the authenticated account can be revoked.
 *     security:
 *       - productAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: The numeric ID of the API key to revoke.
 *     responses:
 *       200:
 *         description: Key revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 id:
 *                   type: integer
 *       400:
 *         description: Invalid key id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Key not found or already revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete("/api-keys/:id", requireProductAuth, requireAdminRole, async (req, res) => {
  const accountId = req.internalAccountId!;
  const keyId = parseInt(String(req.params.id ?? ""), 10);

  if (isNaN(keyId)) {
    return void res.status(400).json({ error: "Invalid key id." });
  }

  try {
    const result = await getDb().query<{ id: number; name: string }>(
      `UPDATE account_api_keys
          SET revoked_at = NOW()
        WHERE id = $1
          AND account_id = $2
          AND revoked_at IS NULL
        RETURNING id, name`,
      [keyId, accountId],
    );

    if (!result.rows[0]) {
      return void res.status(404).json({ error: "API key not found or already revoked." });
    }

    logger.info({ accountId, keyId }, "[ApiKeys] API key revoked");
    const clerkUserId = getAuth(req)?.userId ?? null;
    const revokeActorEmail = await getActorEmail(accountId, clerkUserId);
    const revokedKeyName = result.rows[0].name;
    void insertAuditLog({
      accountId,
      actorEmail: revokeActorEmail,
      actorUserId: clerkUserId,
      action: "apikey.revoke",
      resourceType: "api_key",
      resourceId: String(keyId),
      resourceLabel: revokedKeyName,
    });

    // Notify org members who want api_key_revoked notifications
    void (async () => {
      try {
        const { rows: orgRows } = await getDb().query<{ name: string }>(
          `SELECT name FROM accounts WHERE id = $1`, [accountId],
        );
        const orgName = orgRows[0]?.name ?? "Docuplete";
        const notifTitle = "API key revoked";
        const notifBody  = `The key "${revokedKeyName}" was revoked${revokeActorEmail ? ` by ${revokeActorEmail}` : ""}.`;

        const [emails] = await Promise.all([
          getUserEmailsToNotify(accountId, "api_key_revoked").then(list =>
            revokeActorEmail ? list.filter(e => e !== revokeActorEmail) : list,
          ),
          sendInAppNotifications(
            accountId,
            "api_key_revoked",
            notifTitle,
            notifBody,
            clerkUserId ? [clerkUserId] : [],
          ),
        ]);
        await sendOrgAlertEmails({
          recipientEmails: emails,
          orgName,
          subject:  `${orgName}: API key revoked`,
          heading:  "An API key was revoked",
          bodyHtml: `<p>The API key <strong>${revokedKeyName}</strong> was revoked in your organization${revokeActorEmail ? ` by <strong>${revokeActorEmail}</strong>` : ""}.</p><p>Any integrations using this key will stop working. Update them with a new key if needed.</p>`,
        });
      } catch (err) {
        logger.error({ err, accountId }, "[ApiKeys] Failed to send api_key_revoked notification emails");
      }
    })();

    return void res.json({ success: true, id: keyId });
  } catch (err) {
    logger.error({ err }, "[ApiKeys] Failed to revoke API key");
    return void res.status(500).json({ error: "Failed to revoke API key." });
  }
});

export default router;
