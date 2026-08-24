import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/**
 * Trip bookings. The reservation is placed with the travel supplier after
 * the booking request is accepted.
 *
 * status lifecycle:
 *   paid -> booked
 *       \-> booking_failed (supplier failed — needs attention)
 *   cancelled
 */
export const bookingsTable = pgTable("bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: varchar("status").notNull().default("paid"),
  // Snapshot of what is being booked (draft summary, flight offer, hotel offer, travelers).
  details: jsonb("details").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency").notNull(),
  contactEmail: varchar("contact_email").notNull(),
  // Secret per-booking token — guests must present it to view the booking.
  accessToken: varchar("access_token")
    .notNull()
    .default(sql`gen_random_uuid()`),
  // Supplier confirmations (RouteStack) — reference numbers / raw responses.
  flightConfirmation: jsonb("flight_confirmation"),
  hotelConfirmation: jsonb("hotel_confirmation"),
  bookingError: jsonb("booking_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Booking = typeof bookingsTable.$inferSelect;
export type NewBooking = typeof bookingsTable.$inferInsert;
