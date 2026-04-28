import { randomBytes } from "crypto";
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { hashApiKey } from "../middleware/requireApiKeyAuth";
import { requireProductAuth } from "../middleware/requireProductAuth";
import { requireAdminRole } from "../middleware/requireRole";
import { linkPendingInvitation } from "../lib/auth-utils";
import { seedDemoPackage } from "../lib/demoPackage";
import { insertAuditLog, getActorEmail } from "../lib/auditLog";
import { getUserEmailsToNotify, sendInAppNotifications } from "../lib/notificationPrefs";
import { sendOrgAlertEmails } from "../lib/email";

const router = Router();

const API_KEY_PREFIX = "sk_live_";
const MAX_KEYS_PER_ACCOUNT = 25;

/**
 * POST /api/product/auth/onboard
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
      `INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id`,
      [name, slug],
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
    type MeRow = { account_id: number; account_name: string; slug: string; email: string | null; role: string };

    if (clerkUserId) {
      // Clerk path: look up user record for email and role
      let result = await getDb().query<MeRow>(
        `SELECT au.account_id, a.name AS account_name, a.slug, au.email, au.role
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
          const acc = await getDb().query<{ name: string; slug: string }>(
            `SELECT name, slug FROM accounts WHERE id = $1`,
            [linked.account_id],
          );
          result = {
            rows: [{
              account_id:   linked.account_id,
              account_name: acc.rows[0]?.name ?? "",
              slug:         acc.rows[0]?.slug ?? "",
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
        accountId:   row.account_id,
        accountName: row.account_name,
        slug:        row.slug,
        email:       row.email,
        role:        row.role,
      });
    }

    // API key path: look up account by ID; no specific user context
    const acc = await getDb().query<{ name: string; slug: string }>(
      `SELECT name, slug FROM accounts WHERE id = $1 LIMIT 1`,
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
    });
  } catch (err) {
    logger.error({ err }, "[ProductAuth] /me error");
    return void res.status(500).json({ error: "Server error." });
  }
});

/**
 * POST /api/product/auth/api-keys
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
router.post("/api-keys", requireProductAuth, requireAdminRole, async (req, res) => {
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
 * GET /api/product/auth/api-keys
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
 * PATCH /api/product/auth/api-keys/:id
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
 * DELETE /api/product/auth/api-keys/:id
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
