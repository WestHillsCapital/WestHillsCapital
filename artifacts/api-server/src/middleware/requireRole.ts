import type { RequestHandler } from "express";

/**
 * Numeric rank for each role — higher is more privileged.
 * Any role string not in this map is treated as the lowest rank (0).
 */
const ROLE_RANK: Record<string, number> = {
  readonly: 0,
  member:   1,
  admin:    2,
};

/**
 * Returns an Express middleware that rejects requests whose authenticated
 * user's role ranks below `minRole`.
 *
 * Skips the check entirely for internal-portal requests (where
 * req.internalEmail is set by requireInternalAuth) — those are always admins.
 *
 * In dev/test environments where auth is disabled, requireProductAuth sets
 * productUserRole = 'admin', so all role checks pass.
 *
 * For API-key authenticated requests, productUserRole = 'member'.
 */
export function requireRole(minRole: "readonly" | "member" | "admin"): RequestHandler {
  return (req, res, next) => {
    // Internal portal users (signed in via Google/requireInternalAuth) are
    // always treated as admins — skip role enforcement for them.
    if (req.internalEmail !== undefined) return next();

    const role = req.productUserRole ?? "member";
    const rank = ROLE_RANK[role] ?? 0;
    const required = ROLE_RANK[minRole] ?? 0;

    if (rank < required) {
      const needed = minRole === "admin" ? "admin" : "member or above";
      return void res.status(403).json({
        error: `You don't have permission to perform this action. ${needed === "admin" ? "Admin" : "Member"} access is required.`,
      });
    }
    next();
  };
}

/** Convenience shorthand — requires the user to have the 'admin' role. */
export const requireAdminRole: RequestHandler = requireRole("admin");
