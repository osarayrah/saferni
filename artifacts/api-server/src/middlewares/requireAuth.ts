import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

function getLegacyUserId(req: Request): string | undefined {
  const auth = getAuth(req);
  // Migrated users may carry the original local ID in the custom claim.
  // New Clerk users do not have that claim, so use Clerk's native ID.
  const userId = auth.sessionClaims?.userId ?? auth.userId;
  return typeof userId === "string" && userId.length > 0 ? userId : undefined;
}

/**
 * Finds or creates the local application user. Migrated accounts use their
 * original local ID when Clerk provides it; new accounts use Clerk's ID.
 */
export async function getDbUser(req: Request): Promise<User | undefined> {
  const userId = getLegacyUserId(req);
  if (!userId) return undefined;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (existing) return existing;

  const [inserted] = await db
    .insert(usersTable)
    .values({ id: userId })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const [raced] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return raced;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!getLegacyUserId(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const dbUser = await getDbUser(req);
    if (!dbUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Failed to provision local user");
    res.status(500).json({ error: "Could not load your account" });
  }
}