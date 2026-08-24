import { Router, type IRouter } from "express";
import { getDbUser } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Kept as a small compatibility endpoint for clients that still ask the API
// for the current account. Clerk itself remains the source of session truth.
router.get("/auth/user", async (req, res) => {
  try {
    const user = await getDbUser(req);
    res.json({ user: user ?? null });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load current account");
    res.status(500).json({ error: "Could not load your account" });
  }
});

export default router;