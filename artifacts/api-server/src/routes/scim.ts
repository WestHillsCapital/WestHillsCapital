/**
 * SCIM 2.0 provisioning endpoints.
 *
 * Mounted at /api/scim/v2
 *
 * Supports automated user provisioning and deprovisioning from enterprise
 * Identity Providers (Okta, Azure AD, Google Workspace, etc.).
 *
 * Authentication: Bearer token — a SCIM-specific token managed separately
 * from API keys. Create tokens via the settings UI or
 *   POST /api/v1/account/scim-tokens
 *
 * Implements: RFC 7644 (SCIM protocol), RFC 7643 (SCIM schema)
 * Supports: Users resource — list, create, get, patch, delete
 */

import { createHash, randomBytes } from "crypto";
import express, { Router, type Request, type Response } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router = Router();

// Parse both application/json and application/scim+json request bodies.
// Express's default express.json() only handles application/json.
router.use(express.json({ type: ["application/json", "application/scim+json"] }));

const SCIM_CONTENT_TYPE = "application/scim+json";

// ── SCIM bearer token auth middleware ─────────────────────────────────────────

async function requireScimAuth(
  req: Request,
  res: Response,
  next: () => void,
): Promise<void> {
  const authHeader = req.headers.authorization ?? "";
  const rawToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!rawToken) {
    res.status(401).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(401, "Bearer token required."));
    return;
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const db = getDb();

  try {
    const { rows } = await db.query<{ id: number; account_id: number }>(
      `SELECT id, account_id FROM scim_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL
        LIMIT 1`,
      [tokenHash],
    );
    const token = rows[0];
    if (!token) {
      res.status(401).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(401, "Invalid or revoked SCIM token."));
      return;
    }

    // Update last used
    db.query(`UPDATE scim_tokens SET last_used_at = NOW() WHERE id = $1`, [token.id]).catch(() => {});

    req.internalAccountId = token.account_id;
    next();
  } catch (err) {
    logger.error({ err }, "[SCIM] Auth check failed");
    res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
}

// ── SCIM helpers ──────────────────────────────────────────────────────────────

function scimError(status: number, detail: string) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    status: String(status),
    detail,
  };
}

function scimUserFromRow(row: {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  created_at: Date;
  last_seen_at: Date | null;
  clerk_user_id: string | null;
}, baseUrl: string) {
  const active = row.status === "active";
  const nameParts = (row.display_name ?? row.email).split(" ");
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: String(row.id),
    externalId: row.clerk_user_id ?? undefined,
    userName: row.email,
    name: {
      formatted: row.display_name ?? row.email,
      givenName: nameParts[0] ?? "",
      familyName: nameParts.slice(1).join(" ") || "",
    },
    displayName: row.display_name ?? row.email,
    emails: [{ value: row.email, primary: true, type: "work" }],
    active,
    roles: [{ value: row.role, primary: true }],
    meta: {
      resourceType: "User",
      created: row.created_at,
      lastModified: row.last_seen_at ?? row.created_at,
      location: `${baseUrl}/Users/${row.id}`,
    },
  };
}

function getBaseUrl(req: Request): string {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) ?? req.protocol;
  const hostHeader = req.headers.host;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) ?? "api.docuplete.com";
  return `${proto}://${host}/api/scim/v2`;
}

// ── GET /api/scim/v2/ServiceProviderConfig ─────────────────────────────────────

router.get("/ServiceProviderConfig", (_req, res) => {
  res.set("Content-Type", SCIM_CONTENT_TYPE).json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "SCIM bearer token provisioned via the Docuplete dashboard.",
        primary: true,
      },
    ],
  });
});

// ── GET /api/scim/v2/Schemas ───────────────────────────────────────────────────

router.get("/Schemas", (_req, res) => {
  res.set("Content-Type", SCIM_CONTENT_TYPE).json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 1,
    Resources: [
      {
        id: "urn:ietf:params:scim:schemas:core:2.0:User",
        name: "User",
        description: "Docuplete account user.",
        attributes: [
          { name: "userName", type: "string", required: true, uniqueness: "server" },
          { name: "displayName", type: "string" },
          { name: "active", type: "boolean" },
          { name: "emails", type: "complex", multiValued: true },
          { name: "roles", type: "complex", multiValued: true },
        ],
      },
    ],
  });
});

// ── GET /api/scim/v2/Users ────────────────────────────────────────────────────

router.get("/Users", requireScimAuth as unknown as (req: Request, res: Response, next: () => void) => void, async (req, res) => {
  try {
    const accountId = req.internalAccountId!;
    const db = getDb();
    const baseUrl = getBaseUrl(req);

    const startIndex = Math.max(parseInt(String(req.query.startIndex ?? "1"), 10) || 1, 1);
    const count = Math.min(Math.max(parseInt(String(req.query.count ?? "100"), 10) || 100, 1), 200);
    const offset = startIndex - 1;

    const filterRaw = typeof req.query.filter === "string" ? req.query.filter : null;

    // Support basic SCIM filter: userName eq "email@example.com"
    let emailFilter: string | null = null;
    if (filterRaw) {
      const m = filterRaw.match(/userName\s+eq\s+"([^"]+)"/i);
      if (m?.[1]) emailFilter = m[1].toLowerCase();
    }

    const conditions: string[] = ["account_id = $1"];
    const params: unknown[] = [accountId];
    let idx = 2;

    if (emailFilter) {
      conditions.push(`lower(email) = $${idx++}`);
      params.push(emailFilter);
    }

    const where = conditions.join(" AND ");

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT id, email, display_name, role, status, created_at, last_seen_at, clerk_user_id
           FROM account_users
          WHERE ${where}
          ORDER BY created_at ASC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, count, offset],
      ),
      db.query(`SELECT COUNT(*) AS total FROM account_users WHERE ${where}`, params),
    ]);

    const total = parseInt(String(countResult.rows[0]?.total ?? "0"), 10);
    const resources = dataResult.rows.map((r) => scimUserFromRow(r, baseUrl));

    res.set("Content-Type", SCIM_CONTENT_TYPE).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      startIndex,
      itemsPerPage: count,
      Resources: resources,
    });
  } catch (err) {
    logger.error({ err }, "[SCIM] GET /Users failed");
    res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
});

// ── POST /api/scim/v2/Users ───────────────────────────────────────────────────

router.post("/Users", requireScimAuth as unknown as (req: Request, res: Response, next: () => void) => void, async (req, res) => {
  try {
    const accountId = req.internalAccountId!;
    const db = getDb();
    const baseUrl = getBaseUrl(req);
    const body = req.body as Record<string, unknown>;

    const userName = typeof body.userName === "string" ? body.userName.toLowerCase().trim() : null;
    if (!userName || !userName.includes("@")) {
      return void res.status(400).set("Content-Type", SCIM_CONTENT_TYPE).json(
        scimError(400, "userName must be a valid email address."),
      );
    }

    const displayName =
      typeof body.displayName === "string"
        ? body.displayName
        : (() => {
            const name = body.name as Record<string, unknown> | undefined;
            const parts = [name?.givenName, name?.familyName].filter(Boolean);
            return parts.length ? parts.join(" ") : userName;
          })();

    // Check for existing user
    const { rows: existing } = await db.query<{ id: number; status: string }>(
      `SELECT id, status FROM account_users WHERE account_id = $1 AND lower(email) = $2 LIMIT 1`,
      [accountId, userName],
    );

    if (existing[0]) {
      // Reactivate if deactivated
      if (existing[0].status !== "active") {
        await db.query(
          `UPDATE account_users SET status = 'active', display_name = $1 WHERE id = $2`,
          [displayName, existing[0].id],
        );
      }
      const { rows } = await db.query(
        `SELECT id, email, display_name, role, status, created_at, last_seen_at, clerk_user_id
           FROM account_users WHERE id = $1`,
        [existing[0].id],
      );
      return void res.status(200).set("Content-Type", SCIM_CONTENT_TYPE).json(scimUserFromRow(rows[0], baseUrl));
    }

    // Check seat limit
    const { rows: acctRows } = await db.query<{ seat_limit: number; seat_count: number }>(
      `SELECT a.seat_limit,
              (SELECT COUNT(*) FROM account_users WHERE account_id = $1 AND status = 'active') AS seat_count
         FROM accounts a WHERE a.id = $1`,
      [accountId],
    );
    const acct = acctRows[0];
    if (acct && acct.seat_count >= acct.seat_limit) {
      return void res.status(400).set("Content-Type", SCIM_CONTENT_TYPE).json(
        scimError(400, `Seat limit reached (${acct.seat_limit}). Upgrade your plan to add more users.`),
      );
    }

    const role = "member";
    const { rows: newRows } = await db.query<{ id: number }>(
      `INSERT INTO account_users (account_id, email, display_name, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [accountId, userName, displayName, role],
    );

    const { rows } = await db.query(
      `SELECT id, email, display_name, role, status, created_at, last_seen_at, clerk_user_id
         FROM account_users WHERE id = $1`,
      [newRows[0].id],
    );

    logger.info({ accountId, email: userName }, "[SCIM] User provisioned");
    return void res.status(201).set("Content-Type", SCIM_CONTENT_TYPE).json(scimUserFromRow(rows[0], baseUrl));
  } catch (err) {
    logger.error({ err }, "[SCIM] POST /Users failed");
    return void res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
});

// ── GET /api/scim/v2/Users/:id ────────────────────────────────────────────────

router.get("/Users/:id", requireScimAuth as unknown as (req: Request, res: Response, next: () => void) => void, async (req, res) => {
  try {
    const accountId = req.internalAccountId!;
    const userId = parseInt(String(req.params.id), 10);
    if (!userId) {
      return void res.status(400).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(400, "Invalid user ID."));
    }

    const db = getDb();
    const { rows } = await db.query(
      `SELECT id, email, display_name, role, status, created_at, last_seen_at, clerk_user_id
         FROM account_users WHERE id = $1 AND account_id = $2 LIMIT 1`,
      [userId, accountId],
    );
    if (!rows[0]) {
      return void res.status(404).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(404, "User not found."));
    }

    return void res.set("Content-Type", SCIM_CONTENT_TYPE).json(scimUserFromRow(rows[0], getBaseUrl(req)));
  } catch (err) {
    logger.error({ err }, "[SCIM] GET /Users/:id failed");
    return void res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
});

// ── PATCH /api/scim/v2/Users/:id ──────────────────────────────────────────────

router.patch("/Users/:id", requireScimAuth as unknown as (req: Request, res: Response, next: () => void) => void, async (req, res) => {
  try {
    const accountId = req.internalAccountId!;
    const userId = parseInt(String(req.params.id), 10);
    if (!userId) {
      return void res.status(400).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(400, "Invalid user ID."));
    }

    const db = getDb();
    const { rows: existing } = await db.query<{ id: number }>(
      `SELECT id FROM account_users WHERE id = $1 AND account_id = $2 LIMIT 1`,
      [userId, accountId],
    );
    if (!existing[0]) {
      return void res.status(404).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(404, "User not found."));
    }

    // Process SCIM patch operations
    const body = req.body as { Operations?: Array<{ op: string; path?: string; value?: unknown }> };
    const ops = body.Operations ?? [];

    let newStatus: string | null = null;
    let newDisplayName: string | null = null;

    for (const op of ops) {
      const opLower = op.op?.toLowerCase();
      if (opLower === "replace") {
        if (op.path === "active" || (typeof op.value === "object" && op.value !== null && "active" in (op.value as object))) {
          const active = op.path === "active"
            ? op.value
            : (op.value as Record<string, unknown>).active;
          newStatus = active === true || active === "true" ? "active" : "deactivated";
        }
        if (op.path === "displayName" && typeof op.value === "string") {
          newDisplayName = op.value;
        }
        if (!op.path && typeof op.value === "object" && op.value !== null) {
          const v = op.value as Record<string, unknown>;
          if ("active" in v) {
            newStatus = v.active === true ? "active" : "deactivated";
          }
          if (typeof v.displayName === "string") newDisplayName = v.displayName;
        }
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [userId];
    let idx = 2;

    if (newStatus !== null) {
      updates.push(`status = $${idx++}`);
      params.push(newStatus);
    }
    if (newDisplayName !== null) {
      updates.push(`display_name = $${idx++}`);
      params.push(newDisplayName);
    }

    if (updates.length > 0) {
      await db.query(
        `UPDATE account_users SET ${updates.join(", ")} WHERE id = $1`,
        params,
      );
      logger.info({ accountId, userId, newStatus, newDisplayName }, "[SCIM] User patched");
    }

    const { rows } = await db.query(
      `SELECT id, email, display_name, role, status, created_at, last_seen_at, clerk_user_id
         FROM account_users WHERE id = $1`,
      [userId],
    );
    return void res.set("Content-Type", SCIM_CONTENT_TYPE).json(scimUserFromRow(rows[0], getBaseUrl(req)));
  } catch (err) {
    logger.error({ err }, "[SCIM] PATCH /Users/:id failed");
    return void res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
});

// ── DELETE /api/scim/v2/Users/:id ─────────────────────────────────────────────

router.delete("/Users/:id", requireScimAuth as unknown as (req: Request, res: Response, next: () => void) => void, async (req, res) => {
  try {
    const accountId = req.internalAccountId!;
    const userId = parseInt(String(req.params.id), 10);
    if (!userId) {
      return void res.status(400).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(400, "Invalid user ID."));
    }

    const db = getDb();

    // Soft-delete: deactivate rather than hard-delete to preserve audit trail
    const { rowCount } = await db.query(
      `UPDATE account_users SET status = 'deactivated'
        WHERE id = $1 AND account_id = $2`,
      [userId, accountId],
    );

    if (!rowCount) {
      return void res.status(404).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(404, "User not found."));
    }

    logger.info({ accountId, userId }, "[SCIM] User deprovisioned (soft-delete)");
    return void res.status(204).send();
  } catch (err) {
    logger.error({ err }, "[SCIM] DELETE /Users/:id failed");
    return void res.status(500).set("Content-Type", SCIM_CONTENT_TYPE).json(scimError(500, "Internal error."));
  }
});

// ── SCIM Token management — POST /api/v1/account/scim-tokens ──────────────────
// Exposed here as a helper export for the settings router to mount.

export async function createScimToken(accountId: number, name: string): Promise<{
  token: string;
  prefix: string;
  id: number;
}> {
  const raw = `scim_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  const db = getDb();
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO scim_tokens (account_id, name, token_hash, token_prefix) VALUES ($1, $2, $3, $4) RETURNING id`,
    [accountId, name, hash, prefix],
  );
  return { token: raw, prefix, id: rows[0].id };
}

export default router;
