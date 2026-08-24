import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plannerRouter from "./planner";
import syncRouter from "./sync";
import searchRouter from "./search";
import bookingsRouter from "./bookings";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plannerRouter);
router.use(syncRouter);
router.use(searchRouter);
router.use(bookingsRouter);
router.use(authRouter);

export default router;
