/**
 * notifyBookingFailed — per-channel notification when a booking fails after payment.
 *
 * Three notification channels (each independently tracked so retries never
 * re-send a channel that already succeeded):
 *  1. Ops alert log — structured ERROR entry; always fires; idempotent.
 *  2. Traveler email — sent via SMTP; throws on failure.
 *  3. Ops alert email — sent when BOOKING_ALERT_TO is configured; throws on
 *     failure so the caller records the channel as "failed" and retries.
 *
 * Callers use sendTravelerFailureEmail / sendOpsFailureEmail from this module
 * (or the combined notifyBookingFailed convenience wrapper) rather than
 * importing from bookingOutbox.
 *
 * SMTP environment variables (set in .env or the environment):
 *   SMTP_HOST        — e.g. smtp.mailgun.org
 *   SMTP_PORT        — default 587
 *   SMTP_USER        — auth username
 *   SMTP_PASS        — auth password
 *   SMTP_FROM        — "From" address, default "noreply@safferni.app"
 *   BOOKING_ALERT_TO — ops email address; when set, ops email is a required channel
 */

import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface BookingFailedContext {
  bookingId: string;
  contactEmail: string;
  amountCents: number;
  currency: string;
  errors: string[];
  /** True when at least one leg was confirmed before another failed. */
  partiallyConfirmed?: boolean;
  flightConfirmed?: boolean;
  hotelConfirmed?: boolean;
}

// ---------------------------------------------------------------------------
// Ops alert log (always fires, never throws, idempotent)
// ---------------------------------------------------------------------------
export function emitOpsAlert(ctx: BookingFailedContext): void {
  logger.error(
    {
      ALERT: "BOOKING_FAILED_AFTER_PAYMENT",
      bookingId: ctx.bookingId,
      amountCents: ctx.amountCents,
      currency: ctx.currency,
      errors: ctx.errors,
      partiallyConfirmed: ctx.partiallyConfirmed ?? false,
      flightConfirmed: ctx.flightConfirmed,
      hotelConfirmed: ctx.hotelConfirmed,
    },
    "BOOKING_FAILED_AFTER_PAYMENT — manual review required",
  );
}

// ---------------------------------------------------------------------------
// SMTP transport
// ---------------------------------------------------------------------------
function buildTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
  });
}

// ---------------------------------------------------------------------------
// Email bodies
// ---------------------------------------------------------------------------
function travelerBody(ctx: BookingFailedContext): string {
  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ctx.currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(ctx.amountCents / 100);

  const partialNote = ctx.partiallyConfirmed
    ? "\n\nPlease note that part of your booking may have been confirmed. Our team will clarify all confirmed references in their follow-up.\n"
    : "";

  return `Hi,

We're writing to let you know that your Safferni booking (ID: ${ctx.bookingId}) could not be fully completed after payment.${partialNote}

Charged amount: ${amountFormatted}

This booking has been flagged for review. A member of our team will look into it and be in touch as soon as possible. If you have not heard from us within one business day, please reply to this email with your booking ID above and we will follow up promptly.

We're sorry for the inconvenience.

— The Safferni Team
`;
}

function opsBody(ctx: BookingFailedContext): string {
  return `BOOKING FAILED AFTER PAYMENT — manual action required.

Booking ID  : ${ctx.bookingId}
Contact     : ${ctx.contactEmail}
Amount      : ${ctx.amountCents} ${ctx.currency.toUpperCase()} (${ctx.amountCents / 100})
Flight OK   : ${ctx.flightConfirmed ?? "n/a"}
Hotel OK    : ${ctx.hotelConfirmed ?? "n/a"}
Partial     : ${ctx.partiallyConfirmed ?? false}

Errors:
${ctx.errors.map((e) => `  • ${e}`).join("\n")}
`;
}

// ---------------------------------------------------------------------------
// Per-channel test injection hooks
// ---------------------------------------------------------------------------
let _travelerOverride: ((ctx: BookingFailedContext) => Promise<void>) | null = null;
let _opsOverride: ((ctx: BookingFailedContext) => Promise<void>) | null = null;

/**
 * Override BOTH channels for tests — must be reset in afterEach.
 * Sets the same mock for traveler and ops channels.
 */
export function _setNotifyForTesting(fn: ((ctx: BookingFailedContext) => Promise<void>) | null): void {
  _travelerOverride = fn;
  _opsOverride = fn;
}

/** Override only the traveler email channel — for targeted per-channel tests. */
export function _setTravelerEmailForTesting(fn: ((ctx: BookingFailedContext) => Promise<void>) | null): void {
  _travelerOverride = fn;
}

/** Override only the ops email channel — for targeted per-channel tests. */
export function _setOpsEmailForTesting(fn: ((ctx: BookingFailedContext) => Promise<void>) | null): void {
  _opsOverride = fn;
}

// ---------------------------------------------------------------------------
// Individual channel senders (exported for bookingOutbox per-channel tracking)
// ---------------------------------------------------------------------------

/**
 * Send the booking-failure email to the traveler.
 * Throws on failure so the outbox records the channel state and retries.
 */
export async function sendTravelerFailureEmail(ctx: BookingFailedContext): Promise<void> {
  if (_travelerOverride) return _travelerOverride(ctx);

  const transport = buildTransport();
  if (!transport) {
    logger.error(
      {
        NOTIFICATION_QUEUED: true,
        bookingId: ctx.bookingId,
        channel: "traveler_email",
        hint: "Set SMTP_HOST in .env to enable email delivery.",
      },
      "NOTIFICATION_QUEUED — SMTP not configured; traveler email will be retried by outbox",
    );
    throw new Error("SMTP_HOST not configured — traveler email deferred to outbox retry");
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@safferni.app",
    to: ctx.contactEmail,
    subject: `Action required: your Safferni booking ${ctx.bookingId} could not be completed`,
    text: travelerBody(ctx),
  });
  logger.info({ bookingId: ctx.bookingId }, "Booking-failure traveler email sent");
}

/**
 * Send the booking-failure ops alert email.
 * No-op when BOOKING_ALERT_TO is not configured (ops alert log is the ops channel).
 * Throws on failure so the outbox records the channel state and retries.
 */
export async function sendOpsFailureEmail(ctx: BookingFailedContext): Promise<void> {
  const alertTo = process.env.BOOKING_ALERT_TO;
  if (!alertTo) return; // Ops alert log is the ops channel when email is not configured.

  if (_opsOverride) return _opsOverride(ctx);

  const transport = buildTransport();
  if (!transport) {
    logger.error(
      {
        NOTIFICATION_QUEUED: true,
        bookingId: ctx.bookingId,
        channel: "ops_email",
        hint: "Set SMTP_HOST in .env to enable ops email delivery.",
      },
      "NOTIFICATION_QUEUED — SMTP not configured; ops email will be retried by outbox",
    );
    throw new Error("SMTP_HOST not configured — ops email deferred to outbox retry");
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@safferni.app",
    to: alertTo,
    subject: `[OPS ALERT] Booking failed after payment — ${ctx.bookingId}`,
    text: opsBody(ctx),
  });
  logger.info({ bookingId: ctx.bookingId }, "Booking-failure ops alert email sent");
}

// ---------------------------------------------------------------------------
// Combined convenience wrapper (used by tests expecting a single-call mock)
// ---------------------------------------------------------------------------
export async function notifyBookingFailed(ctx: BookingFailedContext): Promise<void> {
  emitOpsAlert(ctx);
  await sendTravelerFailureEmail(ctx);
  await sendOpsFailureEmail(ctx);
}
