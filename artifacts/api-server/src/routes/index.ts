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
import { requireInternalAuth } from "../middleware/requireInternalAuth";

const router: IRouter = Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.use(healthRouter);
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

router.use("/internal/docufill", requireInternalAuth, docufillRouter);

// ── Content engine (internal tool — also require auth) ────────────────────────
router.use("/internal/content", requireInternalAuth, contentRouter);

export default router;
