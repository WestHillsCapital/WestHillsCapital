import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricingRouter from "./pricing";
import schedulingRouter from "./scheduling";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/pricing", pricingRouter);
router.use("/scheduling", schedulingRouter);
router.use("/leads", leadsRouter);

export default router;
