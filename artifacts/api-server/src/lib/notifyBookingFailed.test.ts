/**
 * Tests for notifyBookingFailed:
 *  - ops alert always fires (even without SMTP)
 *  - SMTP-not-configured throws so the outbox can mark the row as "failed"
 *  - NOTIFICATION_QUEUED log has no PII (email body / recipient)
 *  - sendMail failure throws so the outbox can retry
 *  - outbox state transitions: pending → sent / failed recorded in DB
 *  - legacy provider-checkout bookings are left untouched (no reconciliation
 *    exists anymore — LiteAPI booking is synchronous)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, bookingsTable, type Booking } from "@workspace/db";
import request from "supertest";
import app from "../app";
import {
  _setNotifyForTesting,
  _setTravelerEmailForTesting,
  _setOpsEmailForTesting,
  notifyBookingFailed,
  type BookingFailedContext,
} from "./notifyBookingFailed";
import { sendAndRecordNotification } from "./bookingOutbox";
import { logger } from "./logger";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

// -----------------------------------------------------------------------
// Unit tests for notifyBookingFailed itself
// -----------------------------------------------------------------------

describe("notifyBookingFailed — ops alert", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, "error");
    _setNotifyForTesting(null); // ensure we use the real implementation
  });

  afterEach(() => {
    logSpy.mockRestore();
    _setNotifyForTesting(null);
  });

  it("always emits an ops alert log even when SMTP is not configured", async () => {
    const originalHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    const ctx: BookingFailedContext = {
      bookingId: "test-booking-001",
      contactEmail: "traveler@example.com",
      amountCents: 50000,
      currency: "usd",
      errors: ["Flight booking rejected by provider"],
      partiallyConfirmed: false,
    };

    // Throws because SMTP is absent — but the ops alert must have fired first.
    await expect(notifyBookingFailed(ctx)).rejects.toThrow();

    const alertCall = logSpy.mock.calls.find((callArgs: unknown[]) =>
      typeof callArgs[0] === "object" && callArgs[0] !== null &&
      (callArgs[0] as Rec).ALERT === "BOOKING_FAILED_AFTER_PAYMENT",
    );
    expect(alertCall).toBeDefined();
    const meta = alertCall![0] as Rec;
    expect(meta.bookingId).toBe("test-booking-001");
    expect(meta.amountCents).toBe(50000);
    // contactEmail must NOT appear in the ops alert (PII kept out of logs).
    expect(meta.contactEmail).toBeUndefined();

    if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
  });

  it("emits NOTIFICATION_QUEUED and throws when SMTP is absent", async () => {
    const originalHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    await expect(
      notifyBookingFailed({
        bookingId: "test-booking-002",
        contactEmail: "traveler@example.com",
        amountCents: 10000,
        currency: "usd",
        errors: ["Hotel not available"],
      }),
    ).rejects.toThrow("SMTP_HOST not configured");

    const queueCall = logSpy.mock.calls.find((callArgs: unknown[]) =>
      typeof callArgs[0] === "object" && callArgs[0] !== null &&
      (callArgs[0] as Rec).NOTIFICATION_QUEUED === true,
    );
    expect(queueCall).toBeDefined();
    const meta = queueCall![0] as Rec;
    // Must NOT include PII (email address, email body).
    expect(meta.recipient).toBeUndefined();
    expect(meta.body).toBeUndefined();
    // Must include bookingId and a hint for the operator.
    expect(meta.bookingId).toBe("test-booking-002");
    expect(typeof meta.hint).toBe("string");

    if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
  });

  it("throws when traveler sendMail fails so the outbox can retry", async () => {
    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = "failing.smtp.example";

    // nodemailer will fail to connect — confirm the error propagates.
    await expect(
      notifyBookingFailed({
        bookingId: "test-booking-003",
        contactEmail: "traveler@example.com",
        amountCents: 20000,
        currency: "usd",
        errors: ["Something went wrong"],
      }),
    ).rejects.toThrow();

    if (originalHost !== undefined) process.env.SMTP_HOST = originalHost;
    else delete process.env.SMTP_HOST;
  });
});

// -----------------------------------------------------------------------
// Unit tests: ops-email channel failure semantics
// -----------------------------------------------------------------------

describe("notifyBookingFailed — ops email channel", () => {
  afterEach(() => {
    _setNotifyForTesting(null);
  });

  it("records notificationState 'failed' when the ops email channel throws", async () => {
    // notifyBookingFailed now throws when ops email delivery fails (no longer swallowed),
    // so sendAndRecordNotification must record "failed" — not "sent" — in that case.
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        userId: null,
        status: "booking_failed",
        amountCents: 30000,
        currency: "USD",
        contactEmail: "traveler@example.com",
        details: {},
        bookingError: { message: "hotel rejected", notificationState: "pending" },
      })
      .returning();
    if (!booking) throw new Error("setup failed");
    createdIds.push(booking.id);

    // Mock simulates notifyBookingFailed throwing due to ops email failure.
    _setNotifyForTesting(async () => { throw new Error("ops smtp timeout"); });

    await sendAndRecordNotification(booking, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: ["hotel rejected"],
    });

    const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    // Ops channel failure must not be silently swallowed — state must be "failed" for retry.
    expect(rec(row?.bookingError).notificationState).toBe("failed");
    expect(rec(row?.bookingError).notificationRetries).toBe(1);
  });

  it("does not re-send traveler email on retry when traveler delivery already succeeded (ops was the failing channel)", async () => {
    const origAlertTo = process.env.BOOKING_ALERT_TO;
    process.env.BOOKING_ALERT_TO = "ops@safferni.app"; // require ops channel

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        userId: null,
        status: "booking_failed",
        amountCents: 30000,
        currency: "USD",
        contactEmail: "traveler@example.com",
        details: {},
        bookingError: { message: "hotel rejected", notificationState: "pending" },
      })
      .returning();
    if (!booking) throw new Error("setup failed");
    createdIds.push(booking.id);

    let travelerSendCount = 0;
    let opsSendCount = 0;

    // First attempt: traveler succeeds, ops fails.
    _setTravelerEmailForTesting(async () => { travelerSendCount++; });
    _setOpsEmailForTesting(async () => { opsSendCount++; throw new Error("ops smtp timeout"); });

    await sendAndRecordNotification(booking, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: ["hotel rejected"],
    });

    const [afterFirst] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    expect(rec(afterFirst?.bookingError).notificationState).toBe("failed");
    expect(rec(afterFirst?.bookingError).travelerEmailSent).toBe(true); // traveler delivered
    expect(rec(afterFirst?.bookingError).opsEmailSent).not.toBe(true); // ops not delivered
    expect(travelerSendCount).toBe(1);
    expect(opsSendCount).toBe(1);

    // Second attempt (retry): ops now succeeds.
    _setOpsEmailForTesting(async () => { opsSendCount++; });

    await sendAndRecordNotification(afterFirst!, {
      bookingId: afterFirst!.id,
      contactEmail: afterFirst!.contactEmail,
      amountCents: afterFirst!.amountCents,
      currency: afterFirst!.currency,
      errors: ["hotel rejected"],
    });

    const [afterRetry] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    expect(rec(afterRetry?.bookingError).notificationState).toBe("sent");
    // Traveler must NOT have been re-sent — only ops was retried.
    expect(travelerSendCount).toBe(1);
    expect(opsSendCount).toBe(2);

    // Reset
    if (origAlertTo !== undefined) process.env.BOOKING_ALERT_TO = origAlertTo;
    else delete process.env.BOOKING_ALERT_TO;
    _setTravelerEmailForTesting(null);
    _setOpsEmailForTesting(null);
  });

  it("records notificationState 'sent' without BOOKING_ALERT_TO — ops alert log is the ops channel", async () => {
    const origAlertTo = process.env.BOOKING_ALERT_TO;
    delete process.env.BOOKING_ALERT_TO;

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        userId: null,
        status: "booking_failed",
        amountCents: 30000,
        currency: "USD",
        contactEmail: "traveler@example.com",
        details: {},
        bookingError: { message: "hotel rejected", notificationState: "pending" },
      })
      .returning();
    if (!booking) throw new Error("setup failed");
    createdIds.push(booking.id);

    // Notification mock succeeds (traveler email delivered, no ops email needed).
    _setNotifyForTesting(async () => { /* success */ });

    await sendAndRecordNotification(booking, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: ["hotel rejected"],
    });

    const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    expect(rec(row?.bookingError).notificationState).toBe("sent");

    if (origAlertTo !== undefined) process.env.BOOKING_ALERT_TO = origAlertTo;
  });
});

// -----------------------------------------------------------------------
// Integration tests: legacy provider-checkout bookings (RouteStack era)
// -----------------------------------------------------------------------

const createdIds: string[] = [];

async function insertProviderCheckoutBooking(): Promise<Booking> {
  const [row] = await db
    .insert(bookingsTable)
    .values({
      userId: null,
      status: "paid",
      amountCents: 80000,
      currency: "USD",
      contactEmail: "traveler@example.com",
      details: {
        draft: { destinationName: "Rome" },
        travelers: [],
        checkout: {
          links: [
            { kind: "flight", url: "https://portal.example/checkout/fref", ref: "fref" },
          ],
        },
      },
    })
    .returning();
  if (!row) throw new Error("Failed to insert test booking");
  createdIds.push(row.id);
  return row;
}

afterEach(async () => {
  _setNotifyForTesting(null);
  for (const id of createdIds.splice(0)) {
    await db.delete(bookingsTable).where(eq(bookingsTable.id, id));
  }
});

describe("legacy provider-checkout bookings — no reconciliation", () => {
  it("leaves a legacy pending booking untouched and sends no notification on GET", async () => {
    const booking = await insertProviderCheckoutBooking();

    const notifyCalls: BookingFailedContext[] = [];
    _setNotifyForTesting(async (ctx) => { notifyCalls.push(ctx); });

    const res = await request(app).get(`/api/bookings/${booking.id}?token=${booking.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paid");

    const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    expect(row?.status).toBe("paid");
    expect(notifyCalls).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Unit tests for sendAndRecordNotification (outbox state transitions)
// -----------------------------------------------------------------------

describe("sendAndRecordNotification — outbox state", () => {
  afterEach(async () => {
    _setNotifyForTesting(null);
    for (const id of createdIds.splice(0)) {
      await db.delete(bookingsTable).where(eq(bookingsTable.id, id));
    }
  });

  async function insertFailedBooking(): Promise<Booking> {
    const [row] = await db
      .insert(bookingsTable)
      .values({
        userId: null,
        status: "booking_failed",
        amountCents: 50000,
        currency: "USD",
        contactEmail: "traveler@example.com",
        details: {},
        bookingError: { message: "flight rejected", notificationState: "pending" },
      })
      .returning();
    if (!row) throw new Error("Failed to insert test booking");
    createdIds.push(row.id);
    return row;
  }

  it("updates notificationState to 'sent' when notification succeeds", async () => {
    const booking = await insertFailedBooking();
    _setNotifyForTesting(async () => { /* success */ });

    await sendAndRecordNotification(booking, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: ["flight rejected"],
    });

    const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    expect(rec(row?.bookingError).notificationState).toBe("sent");
  });

  it("updates notificationState to 'failed' and increments retries when notification throws", async () => {
    const booking = await insertFailedBooking();
    _setNotifyForTesting(async () => { throw new Error("SMTP unavailable"); });

    await sendAndRecordNotification(booking, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: ["flight rejected"],
    });

    const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    const errData = rec(row?.bookingError);
    expect(errData.notificationState).toBe("failed");
    expect(errData.notificationRetries).toBe(1);
  });

  it("marks notificationState 'exhausted' after MAX_RETRIES attempts", async () => {
    // Pre-set notificationRetries to 9 so next attempt hits the limit (default MAX_RETRIES=10).
    const [row] = await db
      .insert(bookingsTable)
      .values({
        userId: null,
        status: "booking_failed",
        amountCents: 50000,
        currency: "USD",
        contactEmail: "traveler@example.com",
        details: {},
        bookingError: { message: "flight rejected", notificationState: "failed", notificationRetries: 9 },
      })
      .returning();
    if (!row) throw new Error("Failed to insert test booking");
    createdIds.push(row.id);

    _setNotifyForTesting(async () => { throw new Error("SMTP unavailable"); });

    await sendAndRecordNotification(row, {
      bookingId: row.id,
      contactEmail: row.contactEmail,
      amountCents: row.amountCents,
      currency: row.currency,
      errors: ["flight rejected"],
    });

    const [updated] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, row.id));
    expect(rec(updated?.bookingError).notificationState).toBe("exhausted");
  });
});

