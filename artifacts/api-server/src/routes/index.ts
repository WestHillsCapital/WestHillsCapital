import { Router, type IRouter } from "express";
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
import docufillRouter, { publicDocufillRouter } from "./docufill";
import contentRouter, { publicContentRouter } from "./content";
import productAuthRouter   from "./product-auth";
import storageRouter       from "./storage";
import settingsRouter      from "./settings";
import { requireInternalAuth } from "../middleware/requireInternalAuth";
import { requireProductAuth } from "../middleware/requireProductAuth";

const router: IRouter = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.use(healthRouter);
router.use(storageRouter);
router.use("/pricing",      pricingRouter);
router.use("/scheduling",   schedulingRouter);
router.use("/leads",        leadsRouter);
router.use("/calendar-setup",    calendarSetupRouter);
router.use("/sheets-backfill",   sheetsBackfillRouter);
router.use("/content",           publicContentRouter);
router.use("/docufill/public",   publicDocufillRouter);

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
router.use("/internal/docufill", requireInternalAuth, docufillRouter);

// ── DocuFill: product/SaaS (Clerk JWT) ────────────────────────────────────────
router.use("/product/docufill", requireProductAuth, docufillRouter);

// ── Product auth (Clerk-based onboard + me) ────────────────────────────────────
router.use("/product/auth", productAuthRouter);

// ── Content engine (internal tool — also require auth) ────────────────────────
router.use("/internal/content", requireInternalAuth, contentRouter);

// ── Org settings (internal tool — require auth) ───────────────────────────────
router.use("/internal/settings", requireInternalAuth, settingsRouter);

// ── Org settings (product portal — Clerk auth) ────────────────────────────────
// Re-uses the identical settingsRouter; requireProductAuth resolves
// req.internalAccountId from the Clerk user's account, same as internal auth.
router.use("/product/settings", requireProductAuth, settingsRouter);

export default router;
