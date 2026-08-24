import { sql } from "drizzle-orm";
import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// Per-user synced app state: trips, saved offers, and profile preferences (last-write-wins).
export const userSyncTable = pgTable("user_sync", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  trips: jsonb("trips")
    .notNull()
    .default(sql`'[]'::jsonb`),
  savedOffers: jsonb("saved_offers")
    .notNull()
    .default(sql`'[]'::jsonb`),
  preferences: jsonb("preferences"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserSync = typeof userSyncTable.$inferSelect;
