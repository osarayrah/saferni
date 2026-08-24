/**
 * bookingOutbox — durable outbox for booking-failure notifications.
 *
 * Pattern:
 *  1. The `booking_failed` transition writes `notificationState: "pending"` to
 *     `bookingError` in the same UPDATE that flips the status, making the
 *     intent durable even if the process restarts immediately after.
 *  2. `sendAndRecordNotification` attempts delivery and updates state to
 *     "sent" or "failed". On failure it increments notificationRetries.
 *  3. `startOutboxProcessor` runs a background loop that periodically picks up
 *     any unsent rows and retries them — independent of incoming HTTP traffic.
 *
 * Environment variables (set in .env or the environment):
 *   OUTBOX_INTERVAL_MS   — polling interval (ms); default 300 000 (5 min)
 *   OUTBOX_MAX_RETRIES   — stop retrying after this many attempts; default 10
 */

import { eq, and, sql } from "drizzle-orm";
import { db, bookingsTable, type Booking } from "@workspace/db";
import { logger } from "./logger";
import {
  emitOpsAlert,
  sendTravelerFailureEmail,
  sendOpsFailureEmail,
  type BookingFailedContext,
} from "./notifyBookingFailed";

const OUTBOX_INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS ?? 300_000);
const MAX_RETRIES = Number(process.env.OUTBOX_MAX_RETRIES ?? 10);

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v;
  return undefined;
};

// ---------------------------------------------------------------------------
// Core send + record helper
// ---------------------------------------------------------------------------

/**
 * Attempt to deliver a booking-failure notification and record the outcome
 * atomically in the booking row. This is the single place that transitions
 * notificationState between "pending" → "sent" | "failed".
 */
export async function sendAndRecordNotification(booking: Booking, ctx: BookingFailedContext): Promise<void> {
  // Stamp the cooldown immediately so retryNotificationIfDue (also invoked on the
  // same GET request) does not schedule a redundant retry for the same attempt.
  _notifyRetryLast.set(booking.id, Date.now());

  const errData = rec(booking.bookingError);
  const baseMessage = str(errData.message) ?? ctx.errors.join("; ");
  const retries = typeof errData.notificationRetries === "number" ? errData.notificationRetries : 0;

  // Per-channel state from previous attempts (survive partial-success retries).
  const travelerAlreadySent = errData.travelerEmailSent === true;
  const opsRequired = Boolean(process.env.BOOKING_ALERT_TO);
  const opsAlreadySent = errData.opsEmailSent === true;

  // Ops alert log — always fires; idempotent (just a log entry, no delivery failure possible).
  emitOpsAlert(ctx);

  let travelerOk = travelerAlreadySent;
  let opsOk = opsAlreadySent || !opsRequired; // not required → treat as satisfied
  let anyFailed = false;

  // Traveler email — only attempt if not already delivered.
  if (!travelerAlreadySent) {
    try {
      await sendTravelerFailureEmail(ctx);
      travelerOk = true;
    } catch (err) {
      logger.error({ bookingId: booking.id, err }, "Traveler failure email not delivered — will retry");
      anyFailed = true;
    }
  }

  // Ops alert email — only attempt if configured and not already delivered.
  if (opsRequired && !opsAlreadySent) {
    try {
      await sendOpsFailureEmail(ctx);
      opsOk = true;
    } catch (err) {
      logger.error({ bookingId: booking.id, err }, "Ops failure email not delivered — will retry");
      anyFailed = true;
    }
  }

  const allDone = travelerOk && opsOk;
  const nextRetries = anyFailed ? retries + 1 : retries;
  const exhausted = !allDone && nextRetries >= MAX_RETRIES;
  const nextState = allDone ? "sent" : exhausted ? "exhausted" : "failed";

  if (exhausted) {
    logger.error(
      { bookingId: booking.id, attempt: nextRetries },
      "Booking-failure notification exhausted max retries — requires manual follow-up",
    );
  } else if (allDone) {
    logger.info({ bookingId: booking.id }, "Booking-failure notification delivered on all required channels");
  }

  try {
    await db
      .update(bookingsTable)
      .set({
        bookingError: {
          ...errData,
          message: baseMessage,
          notificationState: nextState,
          travelerEmailSent: travelerOk,
          ...(opsRequired ? { opsEmailSent: opsOk } : {}),
          notificationRetries: nextRetries,
        },
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id));
  } catch (dbErr) {
    logger.error({ bookingId: booking.id, dbErr }, "Could not record notification state in DB");
  }
}

// ---------------------------------------------------------------------------
// Outbox batch processor
// ---------------------------------------------------------------------------

/** Fetch and process all bookings with unsent notifications. */
export async function processOutboxBatch(): Promise<void> {
  let rows: Booking[];
  try {
    rows = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.status, "booking_failed"),
          // Retry pending/failed rows; stop on "sent" or "exhausted".
          sql`COALESCE(${bookingsTable.bookingError}->>'notificationState', 'pending') IN ('pending', 'failed')`,
          // Don't retry beyond the configured max.
          sql`COALESCE((${bookingsTable.bookingError}->>'notificationRetries')::int, 0) < ${MAX_RETRIES}`,
        ),
      )
      .limit(50);
  } catch (err) {
    logger.error({ err }, "Outbox: failed to query pending notifications");
    return;
  }

  if (!rows.length) return;
  logger.info({ count: rows.length }, "Outbox: processing pending booking-failure notifications");

  for (const booking of rows) {
    const errData = rec(booking.bookingError);
    const errorMessage = str(errData.message) ?? "Booking failed with the travel provider";
    const ctx: BookingFailedContext = {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: [errorMessage],
      partiallyConfirmed: Boolean(errData.partiallyConfirmed),
      flightConfirmed: typeof errData.flightConfirmed === "boolean" ? errData.flightConfirmed : undefined,
      hotelConfirmed: typeof errData.hotelConfirmed === "boolean" ? errData.hotelConfirmed : undefined,
    };
    await sendAndRecordNotification(booking, ctx);
  }
}

// ---------------------------------------------------------------------------
// In-process retry helper (for GET-request recovery path)
// ---------------------------------------------------------------------------

/** In-process cooldown map — prevents hammering on every GET. */
const _notifyRetryLast = new Map<string, number>();
const NOTIFY_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * If a booking_failed row has an unsent notification, retry it. Called from
 * GET /bookings/:id so a user refresh can recover from a crash-interrupted
 * send even before the background outbox processor fires. Idempotent.
 */
export async function retryNotificationIfDue(booking: Booking): Promise<void> {
  const errData = rec(booking.bookingError);
  if (str(errData.notificationState) === "sent" || str(errData.notificationState) === "exhausted") return;

  const retries = typeof errData.notificationRetries === "number" ? errData.notificationRetries : 0;
  if (retries >= MAX_RETRIES) return;

  const last = _notifyRetryLast.get(booking.id) ?? 0;
  if (Date.now() - last < NOTIFY_RETRY_INTERVAL_MS) return;
  _notifyRetryLast.set(booking.id, Date.now());

  const errorMessage = str(errData.message) ?? "Booking failed with the travel provider";
  logger.warn({ bookingId: booking.id, notificationState: str(errData.notificationState) },
    "GET-triggered retry of booking-failure notification");
  await sendAndRecordNotification(booking, {
    bookingId: booking.id,
    contactEmail: booking.contactEmail,
    amountCents: booking.amountCents,
    currency: booking.currency,
    errors: [errorMessage],
    partiallyConfirmed: Boolean(errData.partiallyConfirmed),
    flightConfirmed: typeof errData.flightConfirmed === "boolean" ? errData.flightConfirmed : undefined,
    hotelConfirmed: typeof errData.hotelConfirmed === "boolean" ? errData.hotelConfirmed : undefined,
  });
}

// ---------------------------------------------------------------------------
// Background loop
// ---------------------------------------------------------------------------

/**
 * Start the outbox processor. Runs once on startup (to catch anything that
 * failed during a previous crash) then continues on a fixed interval.
 * Safe to call multiple times — each call creates a new interval; only call
 * once per process (from index.ts).
 */
export function startOutboxProcessor(): void {
  const run = (): void => {
    processOutboxBatch().catch((err) =>
      logger.error({ err }, "Outbox processor encountered an unexpected error"),
    );
  };

  // Run once immediately on startup to recover from any crash-interrupted sends.
  run();
  setInterval(run, OUTBOX_INTERVAL_MS);
  logger.info({ intervalMs: OUTBOX_INTERVAL_MS }, "Booking-failure notification outbox processor started");
}
