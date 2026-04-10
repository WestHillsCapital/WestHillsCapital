import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricingRouter from "./pricing";
import schedulingRouter from "./scheduling";
import leadsRouter from "./leads";
import calendarSetupRouter from "./calendar-setup";
import sheetsBackfillRouter from "./sheets-backfill";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/pricing", pricingRouter);
router.use("/scheduling", schedulingRouter);
router.use("/leads", leadsRouter);
router.use("/calendar-setup", calendarSetupRouter);
router.use("/sheets-backfill", sheetsBackfillRouter);

export default router;
