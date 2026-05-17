/**
 * SAML 2.0 Service Provider — public endpoints.
 *
 * Mounted at /api/v1/saml in routes/index.ts.
 *
 * All routes here are PUBLIC (no auth required) — they are called either by the
 * browser during the SSO flow or by IdP administrators importing SP metadata.
 *
 *   GET  /check                — probe whether an email domain has SSO configured
 *   GET  /login                — initiate SP-initiated SSO (redirects to IdP)
 *   POST /callback/:accountId  — Assertion Consumer Service (ACS) endpoint
 *   GET  /metadata/:accountId  — SP metadata XML (import into your IdP)
 */

import { Router, urlencoded } from "express";
import { SAML }               from "@node-saml/node-saml";
import { createClerkClient }  from "@clerk/express";
import { getDb }              from "../db";
import { logger }             from "../lib/logger";

const router = Router();

// ── URL helpers ───────────────────────────────────────────────────────────────

function apiBase(): string {
  return (process.env.API_BASE_URL ?? "https://api.docuplete.com").replace(/\/$/, "");
}

export function samlAcsUrl(accountId: number): string {
  return `${apiBase()}/api/v1/saml/callback/${accountId}`;
}

export function samlEntityId(accountId: number): string {
  return `${apiBase()}/saml/${accountId}`;
}

export function samlMetadataUrl(accountId: number): string {
  return `${apiBase()}/api/v1/saml/metadata/${accountId}`;
}

const appBase = (): string =>
  (process.env.DOCUPLETE_APP_URL ?? "https://app.docuplete.com").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface SamlConnectionRow {
  id:              number;
  account_id:      number;
  enabled:         boolean;
  enforced:        boolean;
  domain:          string;
  idp_entity_id:   string;
  idp_sso_url:     string;
  idp_certificate: string;
  sp_entity_id:    string;
}

// ── SAML instance factory ─────────────────────────────────────────────────────

function makeSaml(conn: SamlConnectionRow): SAML {
  // node-saml accepts a raw base64 cert (no PEM headers) or a full PEM string.
  // Strip headers so both storage formats are handled uniformly.
  const rawCert = conn.idp_certificate
    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  return new SAML({
    callbackUrl:                  samlAcsUrl(conn.account_id),
    entryPoint:                   conn.idp_sso_url,
    issuer:                       samlEntityId(conn.account_id),
    idpCert:                      rawCert,
    wantAssertionsSigned:         false,
    wantAuthnResponseSigned:      false,
    disableRequestedAuthnContext: true,
    acceptedClockSkewMs:          5000,
  });
}

// ── SP metadata XML generator (no IdP cert dependency) ───────────────────────

function generateSpMetadata(accountId: number): string {
  const entityId = samlEntityId(accountId);
  const acs      = samlAcsUrl(accountId);
  return [
    `<?xml version="1.0"?>`,
    `<md:EntityDescriptor`,
    `    xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"`,
    `    entityID="${entityId}">`,
    `  <md:SPSSODescriptor`,
    `      AuthnRequestsSigned="false"`,
    `      WantAssertionsSigned="false"`,
    `      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `    <md:NameIDFormat>`,
    `      urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`,
    `    </md:NameIDFormat>`,
    `    <md:AssertionConsumerService`,
    `        Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
    `        Location="${acs}"`,
    `        index="1"/>`,
    `  </md:SPSSODescriptor>`,
    `</md:EntityDescriptor>`,
  ].join("\n");
}

// ── GET /check?email= ─────────────────────────────────────────────────────────
// Returns { hasSaml: boolean, domain: string } for a given email.
// Used by the login page to decide whether to redirect to the IdP.

router.get("/check", async (req, res) => {
  const raw    = String(req.query["email"] ?? "").trim().toLowerCase();
  const atIdx  = raw.indexOf("@");
  if (atIdx < 0) {
    return void res.json({ hasSaml: false, domain: null });
  }
  const domain = raw.slice(atIdx + 1);
  try {
    const { rows } = await getDb().query<{ id: number }>(
      `SELECT id FROM saml_connections WHERE domain = $1 AND enabled = TRUE LIMIT 1`,
      [domain],
    );
    res.json({ hasSaml: rows.length > 0, domain });
  } catch (err) {
    logger.error({ err }, "[SAML] /check DB error");
    res.json({ hasSaml: false, domain });
  }
});

// ── GET /login?email=&relay= ──────────────────────────────────────────────────
// Initiates SP-initiated SSO. Redirects the browser to the IdP.
// `relay` is an optional opaque state string (e.g. the intended post-login URL)
// that is echoed back in the SAML response as RelayState.

router.get("/login", async (req, res) => {
  const email      = String(req.query["email"] ?? "").trim().toLowerCase();
  const relayState = String(req.query["relay"] ?? "");

  const atIdx = email.indexOf("@");
  if (atIdx < 0) {
    return void res.status(400).json({ error: "email parameter is required" });
  }
  const domain = email.slice(atIdx + 1);

  try {
    const { rows } = await getDb().query<SamlConnectionRow>(
      `SELECT * FROM saml_connections WHERE domain = $1 AND enabled = TRUE LIMIT 1`,
      [domain],
    );
    if (!rows[0]) {
      return void res.status(404).json({
        error: "No SSO connection is configured for this email domain.",
        code:  "SAML_DOMAIN_NOT_FOUND",
      });
    }
    const redirectUrl = await makeSaml(rows[0]).getAuthorizeUrlAsync(
      relayState,
      req.hostname,
      {},
    );
    res.redirect(302, redirectUrl);
  } catch (err) {
    logger.error({ err, domain }, "[SAML] login initiation failed");
    res.status(500).json({ error: "SSO initiation failed. Please try again." });
  }
});

// ── POST /callback/:accountId — ACS ───────────────────────────────────────────
// Receives the SAML assertion from the IdP (HTTP-POST binding).
// Validates the response, finds or JIT-provisions the user, creates a
// short-lived Clerk sign-in token, then redirects to the dashboard.

router.post(
  "/callback/:accountId",
  urlencoded({ extended: false }),
  async (req, res) => {
    const accountId = parseInt(req.params["accountId"] ?? "", 10);
    if (isNaN(accountId)) {
      return void res
        .status(400)
        .send("Invalid SSO callback URL — missing account identifier.");
    }

    try {
      // ── 1. Load the SAML connection ─────────────────────────────────────────
      const { rows } = await getDb().query<SamlConnectionRow>(
        `SELECT * FROM saml_connections WHERE account_id = $1 AND enabled = TRUE LIMIT 1`,
        [accountId],
      );
      if (!rows[0]) {
        return void res
          .status(404)
          .send("SSO is not configured or is disabled for this account.");
      }
      const conn = rows[0];

      // ── 2. Validate the SAML assertion ──────────────────────────────────────
      const body = req.body as Record<string, string>;
      const { profile } = await makeSaml(conn).validatePostResponseAsync(body);

      if (!profile) {
        logger.warn({ accountId }, "[SAML] callback: empty profile in assertion");
        return void res
          .status(401)
          .send("SSO assertion could not be validated. Please try again.");
      }

      // ── 3. Extract email from NameID or attribute ───────────────────────────
      const attrs = profile as Record<string, unknown>;
      const email = (
        (profile.nameID ?? attrs["email"] ?? attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ?? "") as string
      )
        .toString()
        .trim()
        .toLowerCase();

      if (!email || !email.includes("@")) {
        logger.warn({ accountId, nameID: profile.nameID }, "[SAML] callback: no valid email in assertion");
        return void res
          .status(401)
          .send("SSO assertion did not contain a valid email address.");
      }

      const firstName = String(
        attrs["firstName"] ??
        attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"] ??
        "",
      ).trim();
      const lastName = String(
        attrs["lastName"] ??
        attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"] ??
        "",
      ).trim();

      // ── 4. Find or create the Clerk user ────────────────────────────────────
      const secretKey = process.env["CLERK_SECRET_KEY"];
      if (!secretKey) {
        logger.error("[SAML] CLERK_SECRET_KEY not configured");
        return void res
          .status(500)
          .send("Authentication service is misconfigured. Please contact support.");
      }

      const clerk    = createClerkClient({ secretKey });
      const userList = await clerk.users.getUserList({ emailAddress: [email] });

      let clerkUserId: string;
      if (userList.totalCount > 0 && userList.data[0]) {
        clerkUserId = userList.data[0].id;
      } else {
        const created = await clerk.users.createUser({
          emailAddress:            [email],
          ...(firstName ? { firstName } : {}),
          ...(lastName  ? { lastName  } : {}),
          skipPasswordRequirement: true,
        });
        clerkUserId = created.id;
        logger.info({ accountId, email }, "[SAML] JIT-provisioned new Clerk user");
      }

      // ── 5. Ensure account_users row exists (JIT provisioning) ───────────────
      await getDb().query(
        `INSERT INTO account_users (account_id, email, role, clerk_user_id, status, invited_at)
           VALUES ($1, $2, 'member', $3, 'active', NOW())
           ON CONFLICT (account_id, email) DO UPDATE
             SET clerk_user_id = EXCLUDED.clerk_user_id,
                 status        = 'active'`,
        [accountId, email, clerkUserId],
      );

      // ── 6. Create short-lived Clerk sign-in token ───────────────────────────
      const tokenResponse = await clerk.signInTokens.createSignInToken({
        userId:           clerkUserId,
        expiresInSeconds: 300,
      });

      // ── 7. Redirect to the app with the SSO ticket ──────────────────────────
      const relayState = String(body["RelayState"] ?? "").trim();
      const baseDest   =
        relayState && relayState.startsWith("/")
          ? `${appBase()}${relayState}`
          : `${appBase()}/`;

      const sep         = baseDest.includes("?") ? "&" : "?";
      const callbackUrl = `${baseDest}${sep}sso_ticket=${encodeURIComponent(tokenResponse.token)}`;

      logger.info({ accountId, email }, "[SAML] SSO login successful");
      res.redirect(302, callbackUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, accountId }, "[SAML] callback validation failed");
      res
        .status(401)
        .send(`SSO authentication failed: ${msg}. Please contact your IT administrator.`);
    }
  },
);

// ── GET /metadata/:accountId — SP metadata XML ───────────────────────────────
// Returns the SP metadata XML that IdP administrators paste into their IdP
// configuration. This endpoint is intentionally public and unauthenticated.

router.get("/metadata/:accountId", (req, res) => {
  const accountId = parseInt(req.params["accountId"] ?? "", 10);
  if (isNaN(accountId)) {
    return void res.status(400).send("Invalid account ID.");
  }
  res
    .set("Content-Type", "application/xml; charset=utf-8")
    .send(generateSpMetadata(accountId));
});

export default router;
