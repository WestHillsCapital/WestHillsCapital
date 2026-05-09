/**
 * Custom domain management for Docuplete enterprise accounts.
 *
 * Mounted at /api/v1/account/custom-domain
 *
 * Allows enterprise accounts to configure a custom subdomain for their
 * interview links (e.g. documents.theircorp.com instead of docuplete.com/...).
 *
 * DNS setup required:
 *   CNAME  <their-subdomain>  →  docuplete.com
 *
 * Verification checks that the CNAME record resolves correctly.
 * Once verified, the API server starts generating interview URLs using
 * the custom domain automatically.
 */

import { Router } from "express";
import { z } from "zod";
import dns from "dns/promises";
import { getDb } from "../db";
import { logger } from "../lib/logger";
import { requireApiKeyAuth } from "../middleware/requireApiKeyAuth";
import { requireAccountId } from "../middleware/requireAccountId";

const router = Router();

const DOCUPLETE_TARGET_CNAME = "docuplete.com";

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

function isValidSubdomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/.test(domain);
}

// ── GET /api/v1/account/custom-domain ─────────────────────────────────────────

/**
 * Returns the current custom domain configuration for the account.
 */
router.get(
  "/",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const db = getDb();

      const { rows } = await db.query<{
        custom_domain: string | null;
        custom_domain_status: string;
        custom_domain_verified_at: Date | null;
      }>(
        `SELECT custom_domain, custom_domain_status, custom_domain_verified_at
           FROM accounts WHERE id = $1`,
        [accountId],
      );

      const row = rows[0];
      if (!row) return void res.status(404).json({ error: "Account not found." });

      return void res.json({
        domain: row.custom_domain ?? null,
        status: row.custom_domain ? row.custom_domain_status : "not_configured",
        verifiedAt: row.custom_domain_verified_at ?? null,
        cnameTarget: DOCUPLETE_TARGET_CNAME,
        instructions: row.custom_domain
          ? null
          : `Add a CNAME DNS record pointing your subdomain to ${DOCUPLETE_TARGET_CNAME}, then call the verify endpoint.`,
      });
    } catch (err) {
      logger.error({ err }, "[CustomDomain] GET failed");
      return void res.status(500).json({ error: "Failed to retrieve custom domain configuration." });
    }
  },
);

// ── PUT /api/v1/account/custom-domain ─────────────────────────────────────────

const SetDomainSchema = z.object({
  domain: z.string().min(4).max(253),
});

/**
 * Set or update the custom domain for the account.
 * This does not verify DNS — call the verify endpoint after setting.
 */
router.put(
  "/",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const _parse = SetDomainSchema.safeParse(req.body);
      if (!_parse.success) {
        return void res.status(400).json({
          error: "Invalid request body",
          issues: _parse.error.issues.map((i) => i.message),
        });
      }

      const domain = normalizeDomain(_parse.data.domain);
      if (!isValidSubdomain(domain)) {
        return void res.status(400).json({
          error: "Invalid domain format. Must be a valid fully-qualified domain name (e.g. docs.yourcompany.com).",
        });
      }

      const db = getDb();

      // Ensure the domain isn't already claimed by another account
      const { rows: conflicts } = await db.query<{ id: number }>(
        `SELECT id FROM accounts WHERE custom_domain = $1 AND id != $2 LIMIT 1`,
        [domain, accountId],
      );
      if (conflicts.length > 0) {
        return void res.status(409).json({
          error: "This domain is already configured for another account.",
        });
      }

      await db.query(
        `UPDATE accounts
            SET custom_domain = $1,
                custom_domain_status = 'pending_verification',
                custom_domain_verified_at = NULL
          WHERE id = $2`,
        [domain, accountId],
      );

      logger.info({ accountId, domain }, "[CustomDomain] Domain set — awaiting verification");

      return void res.json({
        domain,
        status: "pending_verification",
        verifiedAt: null,
        next: "Call POST /api/v1/account/custom-domain/verify to check your DNS configuration.",
        cnameTarget: DOCUPLETE_TARGET_CNAME,
      });
    } catch (err) {
      logger.error({ err }, "[CustomDomain] PUT failed");
      return void res.status(500).json({ error: "Failed to update custom domain." });
    }
  },
);

// ── POST /api/v1/account/custom-domain/verify ─────────────────────────────────

/**
 * Trigger a DNS verification check for the configured custom domain.
 * Checks that a CNAME record pointing to docuplete.com exists.
 * On success, marks the domain as active so interview URLs use it.
 */
router.post(
  "/verify",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const db = getDb();

      const { rows } = await db.query<{ custom_domain: string | null }>(
        `SELECT custom_domain FROM accounts WHERE id = $1`,
        [accountId],
      );
      const domain = rows[0]?.custom_domain;
      if (!domain) {
        return void res.status(400).json({
          error: "No custom domain configured. Call PUT /api/v1/account/custom-domain first.",
        });
      }

      // Resolve CNAME chain
      let cnameTarget: string | null = null;
      try {
        const cnameRecords = await dns.resolveCname(domain);
        cnameTarget = cnameRecords[0] ? normalizeDomain(cnameRecords[0]) : null;
      } catch (dnsErr) {
        logger.info({ dnsErr, domain }, "[CustomDomain] CNAME resolution failed");
      }

      const expectedTarget = DOCUPLETE_TARGET_CNAME;
      const verified =
        cnameTarget !== null &&
        (cnameTarget === expectedTarget || cnameTarget.endsWith(`.${expectedTarget}`));

      if (verified) {
        await db.query(
          `UPDATE accounts
              SET custom_domain_status = 'active',
                  custom_domain_verified_at = NOW()
            WHERE id = $1`,
          [accountId],
        );
        logger.info({ accountId, domain, cnameTarget }, "[CustomDomain] Domain verified successfully");
        return void res.json({
          domain,
          status: "active",
          verified: true,
          cnameFound: cnameTarget,
          message: `Domain verified. Interview links will now use https://${domain}/...`,
        });
      }

      await db.query(
        `UPDATE accounts SET custom_domain_status = 'verification_failed' WHERE id = $1`,
        [accountId],
      );

      logger.info({ accountId, domain, cnameTarget }, "[CustomDomain] Domain verification failed");
      return void res.status(422).json({
        domain,
        status: "verification_failed",
        verified: false,
        cnameFound: cnameTarget,
        expected: expectedTarget,
        message: `CNAME not pointing to ${expectedTarget}. Found: ${cnameTarget ?? "nothing"}. DNS changes can take up to 48 hours to propagate.`,
      });
    } catch (err) {
      logger.error({ err }, "[CustomDomain] Verify failed");
      return void res.status(500).json({ error: "Verification check failed." });
    }
  },
);

// ── DELETE /api/v1/account/custom-domain ──────────────────────────────────────

/**
 * Remove the custom domain configuration.
 * Interview links will revert to using docuplete.com.
 */
router.delete(
  "/",
  requireApiKeyAuth,
  requireAccountId,
  async (req, res) => {
    try {
      const accountId = req.internalAccountId!;
      const db = getDb();

      await db.query(
        `UPDATE accounts
            SET custom_domain = NULL,
                custom_domain_status = 'unverified',
                custom_domain_verified_at = NULL
          WHERE id = $1`,
        [accountId],
      );

      logger.info({ accountId }, "[CustomDomain] Custom domain removed");
      return void res.json({ ok: true, message: "Custom domain removed. Interview links will use docuplete.com." });
    } catch (err) {
      logger.error({ err }, "[CustomDomain] DELETE failed");
      return void res.status(500).json({ error: "Failed to remove custom domain." });
    }
  },
);

export default router;
