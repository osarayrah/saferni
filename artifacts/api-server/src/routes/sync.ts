import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSyncTable } from "@workspace/db";
import { PutSyncStateBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/sync", requireAuth, async (req, res) => {
  const [row] = await db
    .select()
    .from(userSyncTable)
    .where(eq(userSyncTable.userId, req.dbUser!.id));
  res.json({
    trips: row?.trips ?? [],
    savedOffers: row?.savedOffers ?? [],
    preferences: row?.preferences ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  });
});

router.put("/sync", requireAuth, async (req, res) => {
  const parsed = PutSyncStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sync payload" });
    return;
  }
  // Validation confirms the shape, but store the raw body so extra trip and
  // offer fields are preserved verbatim. Omitted fields remain unchanged.
  const trips = (req.body as { trips: unknown[] }).trips;
  const body = req.body as { preferences?: unknown; savedOffers?: unknown[] };
  const [existing] = await db.select().from(userSyncTable).where(eq(userSyncTable.userId, req.dbUser!.id));
  const preferences = Object.prototype.hasOwnProperty.call(body, "preferences")
    ? body.preferences ?? null
    : existing?.preferences ?? null;
  const savedOffers = Object.prototype.hasOwnProperty.call(body, "savedOffers")
    ? body.savedOffers ?? []
    : existing?.savedOffers ?? [];
  const [row] = await db
    .insert(userSyncTable)
    .values({ userId: req.dbUser!.id, trips, savedOffers, preferences: preferences ?? null })
    .onConflictDoUpdate({
      target: userSyncTable.userId,
      set: {
        trips,
        savedOffers,
        preferences: preferences ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json({
    trips: row.trips,
    savedOffers: row.savedOffers,
    preferences: row.preferences ?? null,
    updatedAt: row.updatedAt.toISOString(),
  });
});

export default router;
