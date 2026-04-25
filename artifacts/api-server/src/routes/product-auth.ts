import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router = Router();

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
    const existing = await db.query<{ account_id: number; account_name: string; slug: string }>(
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

    const acctResult = await db.query<{ id: number }>(
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
 * GET /api/product/auth/me
 *
 * Returns the current user's account info.
 * Used by the frontend to detect first-login and redirect accordingly.
 */
router.get("/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    return void res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const result = await db.query<{ account_id: number; account_name: string; slug: string; email: string; role: string }>(
      `SELECT au.account_id, a.name AS account_name, a.slug, au.email, au.role
       FROM account_users au
       JOIN accounts a ON a.id = au.account_id
       WHERE au.clerk_user_id = $1
       LIMIT 1`,
      [clerkUserId],
    );

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
  } catch (err) {
    logger.error({ err }, "[ProductAuth] /me error");
    return void res.status(500).json({ error: "Server error." });
  }
});

export default router;
