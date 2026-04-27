import type { RequestHandler } from "express";

/**
 * Safety-net middleware that must run after requireProductAuth or requireInternalAuth.
 *
 * Both auth middlewares already reject unauthenticated requests, but this
 * provides a belt-and-suspenders guarantee: if req.internalAccountId is somehow
 * still undefined when a docufill route handler runs, we reject with 401 rather
 * than silently falling back to account 1 or another tenant's data.
 *
 * Usage: mount between the auth middleware and the route handler.
 *   router.use("/product/docufill", requireProductAuth, requireAccountId, docufillRouter);
 */
export const requireAccountId: RequestHandler = (req, res, next) => {
  if (req.internalAccountId === undefined || req.internalAccountId === null) {
    return void res.status(401).json({ error: "Authentication required." });
  }
  next();
};
