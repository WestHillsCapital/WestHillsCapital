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
import docufillRouter, { publicDocufillRouter, apiKeyDocufillRouter } from "./docufill";
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

// ── DocuFill: WHC internal (session token) ────────────────────────────────────
// requireAccountId runs after requireInternalAuth as a belt-and-suspenders
// guard: if account resolution somehow fails, reject rather than fall through.
router.use("/internal/docufill", requireInternalAuth, requireAccountId, docufillRouter);

// ── Content engine (internal tool — also require auth) ────────────────────────
router.use("/internal/content", requireInternalAuth, contentRouter);

// ── Org settings (internal tool — require auth) ───────────────────────────────
router.use("/internal/settings", requireInternalAuth, settingsRouter);

// ── v1 API: versioned product + public docufill routes ────────────────────────
// All externally-published product API endpoints live under /api/v1/...
// The old unversioned paths below redirect 301 → v1 for backward compatibility.
const v1Router: IRouter = Router();

v1Router.use("/docufill/public",   publicDocufillRouter);
v1Router.use("/docufill/public",   publicMerlinRouter);
v1Router.use("/product/docufill",  requireProductAuth, requireAccountId, docufillRouter);
v1Router.use("/product/auth",      productAuthRouter);
v1Router.use("/product/settings",  requireProductAuth, settingsRouter);
v1Router.use("/product/merlin",    requireProductAuth, requireAccountId, merlinRouter);
v1Router.use("/packages",          requireApiKeyAuth,  requireAccountId, apiKeyDocufillRouter);

router.use("/v1", v1Router);

// ── Legacy redirects: /api/product/... → /api/v1/product/... (301) ────────────
// Preserves backward compatibility for any integrations built against the
// unversioned paths. New code should target /api/v1/... directly.
function legacyRedirect(prefix: string) {
  return (req: Request, res: Response) => {
    const qs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
      : "";
    res.redirect(301, `/api/v1${prefix}${req.path === "/" ? "" : req.path}${qs}`);
  };
}

router.use("/docufill/public",  legacyRedirect("/docufill/public"));
router.use("/product/docufill", legacyRedirect("/product/docufill"));
router.use("/product/auth",     legacyRedirect("/product/auth"));
router.use("/product/settings", legacyRedirect("/product/settings"));

export default router;
