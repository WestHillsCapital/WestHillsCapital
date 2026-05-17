import { Router, type IRouter, type Request, type Response } from "express";
import healthRouter        from "./health";
import pricingRouter       from "./pricing";
import schedulingRouter    from "./scheduling";
import leadsRouter         from "./leads";
import calendarSetupRouter from "./calendar-setup";
import sheetsBackfillRouter from "./sheets-backfill";
import internalAuthRouter  from "./internal-auth";
import internalRouter      from "./internal";
import dealsRouter         from "./deals";
import fedexRouter         from "./fedex";
import docupleteRouter, { publicDocupleteRouter, apiKeyDocupleteRouter } from "./docuplete";
import contentRouter, { publicContentRouter } from "./content";
import productAuthRouter   from "./product-auth";
import storageRouter       from "./storage";
import settingsRouter      from "./settings";
import docsRouter          from "./docs";
import merlinRouter, { publicMerlinRouter } from "./merlin";
import { requireInternalAuth } from "../middleware/requireInternalAuth";
import { requireProductAuth } from "../middleware/requireProductAuth";
import { requireAccountId } from "../middleware/requireAccountId";
import { requireApiKeyAuth } from "../middleware/requireApiKeyAuth";
import affiliatesAdminRouter, { publicAffiliateRouter } from "./affiliates";
import headlessSessionsRouter from "./headlessSessions";
import developerRouter from "./developer";
import sandboxRouter from "./sandbox";
import customDomainRouter from "./customDomain";
import scimRouter from "./scim";
import samlRouter from "./saml";

const router: IRouter = Router();

// ── API documentation (public) ────────────────────────────────────────────────
router.use(docsRouter);

// ── Public routes ─────────────────────────────────────────────────────────────
router.use(healthRouter);
router.use(storageRouter);
router.use("/pricing",      pricingRouter);
router.use("/scheduling",   schedulingRouter);
router.use("/leads",        leadsRouter);
router.use("/calendar-setup",    calendarSetupRouter);
router.use("/sheets-backfill",   sheetsBackfillRouter);
router.use("/content",           publicContentRouter);

// ── Public affiliate application ──────────────────────────────────────────────
router.use("/affiliates", publicAffiliateRouter);

// ── Internal auth (public sign-in/signout endpoints) ──────────────────────────
router.use("/internal/auth", internalAuthRouter);

// ── Internal-only routes (require valid session token) ────────────────────────
// requireInternalAuth validates `Authorization: Bearer <sessionToken>` and
// attaches req.internalEmail to the request.
router.use("/internal", requireInternalAuth, internalRouter);

// ── Deal routes (internal tool — also require auth) ───────────────────────────
router.use("/deals", requireInternalAuth, dealsRouter);

// ── FedEx location search (internal tool) ─────────────────────────────────────
router.use("/fedex", requireInternalAuth, fedexRouter);

// ── Docuplete: WHC internal (session token) ────────────────────────────────────
// requireAccountId runs after requireInternalAuth as a belt-and-suspenders
// guard: if account resolution somehow fails, reject rather than fall through.
router.use("/internal/docuplete", requireInternalAuth, requireAccountId, docupleteRouter);

// ── Merlin: WHC internal (session token) ──────────────────────────────────────
// Same auth chain as internal docuplete: internal session token + account guard.
router.use("/internal/merlin", requireInternalAuth, requireAccountId, merlinRouter);

// ── Content engine (internal tool — also require auth) ────────────────────────
router.use("/internal/content", requireInternalAuth, contentRouter);

// ── Org settings (internal tool — require auth) ───────────────────────────────
router.use("/internal/settings", requireInternalAuth, settingsRouter);

// ── Affiliates admin (internal tool — require auth) ───────────────────────────
router.use("/internal/affiliates", requireInternalAuth, affiliatesAdminRouter);

// ── v1 API: versioned product + public Docuplete routes ───────────────────────
// All externally-published product API endpoints live under /api/v1/...
// The old unversioned paths below redirect 301 → v1 for backward compatibility.
const v1Router: IRouter = Router();

v1Router.use("/docuplete/public",  publicDocupleteRouter);
v1Router.use("/docuplete/public",  publicMerlinRouter);
v1Router.use("/product/docuplete", requireProductAuth, requireAccountId, docupleteRouter);
// Backward compat: /api/v1/product/docuplete → /api/v1/product/docuplete (301)
v1Router.use("/product/docuplete",  v1Redirect("/product/docuplete"));
// Backward compat: /api/v1/docuplete/public → /api/v1/docuplete/public (301)
v1Router.use("/docuplete/public",   v1Redirect("/docuplete/public"));
v1Router.use("/product/auth",      productAuthRouter);
v1Router.use("/product/settings",  requireProductAuth, settingsRouter);
v1Router.use("/product/merlin",    requireProductAuth, requireAccountId, merlinRouter);
v1Router.use("/packages",          requireApiKeyAuth,  requireAccountId, apiKeyDocupleteRouter);
v1Router.use("/sessions",              headlessSessionsRouter);
v1Router.use("/account/custom-domain", customDomainRouter);
v1Router.use("/product/developer",     requireProductAuth, requireAccountId, developerRouter);
v1Router.use("/sandbox",               sandboxRouter);
v1Router.use("/saml",                  samlRouter);

router.use("/v1", v1Router);

// ── SCIM 2.0 provisioning — /api/scim/v2/* ────────────────────────────────────
// Auth is handled inside the scimRouter (bearer token from scim_tokens table).
router.use("/scim/v2", scimRouter);

// ── Redirect helpers ──────────────────────────────────────────────────────────

// Redirects unversioned /api/<prefix> → /api/v1/<newPrefix> (301).
// Used for legacy paths that pre-date the /v1 namespace.
function legacyRedirect(newPrefix: string) {
  return (req: Request, res: Response) => {
    const qs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    res.redirect(301, `/api/v1${newPrefix}${req.path === "/" ? "" : req.path}${qs}`);
  };
}

// Redirects within the v1 namespace: /api/v1/<old> → /api/v1/<newPrefix> (301).
// Used when a path is renamed but old clients should still be redirected.
function v1Redirect(newPrefix: string) {
  return (req: Request, res: Response) => {
    const qs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    res.redirect(301, `/api/v1${newPrefix}${req.path === "/" ? "" : req.path}${qs}`);
  };
}

// ── Legacy redirects: /api/product/... → /api/v1/product/... (301) ────────────
// Preserves backward compatibility for any integrations built against the
// unversioned paths. New code should target /api/v1/... directly.
router.use("/docuplete/public",  legacyRedirect("/docuplete/public"));
router.use("/product/docuplete", legacyRedirect("/product/docuplete"));
router.use("/product/auth",     legacyRedirect("/product/auth"));
router.use("/product/settings", legacyRedirect("/product/settings"));

export default router;
