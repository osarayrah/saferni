import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, bookingsTable, type Booking } from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { laBookPost } from "../lib/liteApi";
import { logger } from "../lib/logger";
import { getStoredFlightOffer, getStoredHotelOffer, getOfferContext } from "../lib/offerStore";
import { sendAndRecordNotification, retryNotificationIfDue } from "../lib/bookingOutbox";
import { getDbUser, requireAuth } from "../middlewares/requireAuth";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v;
  return undefined;
};
const num = (...vals: unknown[]): number | undefined => {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
};

function secretMatches(expected: string, provided: unknown): boolean {
  if (typeof provided !== "string" || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

function tokenMatches(booking: Booking, provided: unknown): boolean {
  return secretMatches(booking.accessToken, provided);
}

/**
 * Stripe appends the Checkout Session ID to its success URL. Accept it only
 * when it is the exact session recorded on this booking, so older guest
 * return links can recover without requiring browser storage.
 */
function checkoutSessionMatches(booking: Booking, provided: unknown): boolean {
  const checkoutSessionId = str(rec(rec(booking.details).payment).checkoutSessionId);
  return Boolean(checkoutSessionId && secretMatches(checkoutSessionId, provided));
}

function toApiBooking(b: Booking) {
  const details = rec(b.details);
  const draft = rec(details.draft);
  const flightConf = rec(b.flightConfirmation);
  const hotelConf = rec(b.hotelConfirmation);
  const err = rec(b.bookingError);
  return {
    id: b.id,
    status: b.status,
    amountCents: b.amountCents,
    currency: b.currency,
    contactEmail: b.contactEmail,
    ...(str(draft.destinationName) ? { destinationName: str(draft.destinationName) } : {}),
    ...(str(draft.departureDate) ? { departureDate: str(draft.departureDate) } : {}),
    ...(str(draft.returnDate) ? { returnDate: str(draft.returnDate) } : {}),
    ...(b.flightConfirmation ? { flightConfirmed: flightConf.confirmed === true } : {}),
    ...(b.hotelConfirmation ? { hotelConfirmed: hotelConf.confirmed === true } : {}),
    ...(str(flightConf.reference) ? { flightReference: str(flightConf.reference) } : {}),
    ...(str(hotelConf.reference) ? { hotelReference: str(hotelConf.reference) } : {}),
    ...(str(err.message) ? { errorMessage: str(err.message) } : {}),
    createdAt: b.createdAt.toISOString(),
  };
}

/**
 * Flight fulfillment remains deliberately unavailable. A paid booking is never
 * sent to an unapproved supplier flow; the customer is refunded instead.
 */
async function placeFlightBooking(): Promise<{ confirmed: boolean; error: string }> {
  return { confirmed: false, error: "Flight booking is not yet available with the current travel supplier." };
}

/** Settles the approved hotel booking from Safferni's LiteAPI wallet. */
async function placeHotelBooking(booking: Booking, travelers: Rec[]): Promise<{ confirmed: boolean; reference?: string; raw?: Rec; error?: string }> {
  const details = rec(booking.details);
  const prebookId = str(rec(details.liteApi).prebookId);
  if (!prebookId) return { confirmed: false, error: "Hotel booking is missing its prebook reference." };

  const first = travelers.find((t) => str(t.firstName)) ?? {};
  const holder = {
    firstName: str(first.firstName) ?? "Guest",
    lastName: str(first.lastName) ?? "Guest",
    email: booking.contactEmail,
  };
  const guestList = travelers.length ? travelers : [holder as Rec];
  const res = rec(await laBookPost("/rates/book", {
    prebookId,
    holder,
    guests: guestList.map((t) => ({
      occupancyNumber: 1,
      firstName: str(t.firstName) ?? holder.firstName,
      lastName: str(t.lastName) ?? holder.lastName,
      email: booking.contactEmail,
    })),
    payment: { method: "WALLET" },
    // Provider-side idempotency prevents duplicate supplier settlement.
    clientReference: booking.id,
  }));
  const data = rec(res.data ?? res);
  const status = str(data.status)?.toUpperCase();
  const reference = str(data.hotelConfirmationCode, data.bookingId, data.confirmationCode, data.reference);
  if ((status && status !== "CONFIRMED") || !reference) {
    return {
      confirmed: false,
      raw: data,
      error: str(res.error, rec(res.error).message, data.message) ?? "Hotel booking was not confirmed by the provider.",
    };
  }
  return { confirmed: true, reference, raw: data };
}

async function refundCustomerPayment(booking: Booking, reason: string): Promise<{ status: "refunded" | "failed" | "pending"; message: string; refundId?: string }> {
  const payment = rec(rec(booking.details).payment);
  const paymentIntentId = str(payment.paymentIntentId);
  if (!paymentIntentId) return { status: "failed", message: "The original customer payment could not be located for refund." };
  try {
    const stripe = await getUncachableStripeClient();
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, metadata: { bookingId: booking.id, reason: "supplier_rejected" } },
      { idempotencyKey: `booking-refund-${booking.id}` },
    );
    if (refund.status === "succeeded") return { status: "refunded", message: "Your payment was refunded after the supplier could not confirm the booking.", refundId: refund.id };
    if (refund.status === "pending") return { status: "pending", message: "The supplier could not confirm the booking. Your refund is pending.", refundId: refund.id };
    return { status: "failed", message: `The supplier could not confirm the booking. Refund ${refund.id} needs attention.` };
  } catch (err) {
    logger.error({ err, bookingId: booking.id, reason }, "Customer refund failed");
    return { status: "failed", message: "The supplier could not confirm the booking. Your refund needs immediate attention." };
  }
}

async function placeSupplierBookings(booking: Booking): Promise<void> {
  const details = rec(booking.details);
  const flight = rec(details.flight);
  const hotel = rec(details.hotel);
  const travelers = Array.isArray(details.travelers) ? details.travelers.map(rec) : [];
  const payment = rec(details.payment);
  let flightConfirmation: Rec | null = null;
  let hotelConfirmation: Rec | null = null;
  const errors: string[] = [];

  if (str(flight.bookingRef)) {
    try {
      const result = await placeFlightBooking();
      errors.push(result.error);
      flightConfirmation = { confirmed: false };
    } catch (err) {
      errors.push(`Flight booking failed: ${err instanceof Error ? err.message : "unknown error"}`);
      flightConfirmation = { confirmed: false };
    }
  }

  if (str(hotel.bookingRef)) {
    try {
      const result = await placeHotelBooking(booking, travelers);
      if (result.confirmed && result.reference) {
        hotelConfirmation = { confirmed: true, reference: result.reference, provider: "LiteAPI", ...(result.raw ? { raw: result.raw } : {}) };
      } else {
        errors.push(result.error ?? "Hotel booking was not confirmed by the provider.");
        hotelConfirmation = { confirmed: false, ...(result.raw ? { raw: result.raw } : {}) };
      }
    } catch (err) {
      errors.push(`Hotel booking failed: ${err instanceof Error ? err.message : "unknown error"}`);
      hotelConfirmation = { confirmed: false };
    }
  }

  const requested = [Boolean(str(flight.bookingRef)), Boolean(str(hotel.bookingRef))].filter(Boolean).length;
  const confirmed = [flightConfirmation, hotelConfirmation].filter((confirmation) => confirmation?.confirmed === true).length;
  const supplierSucceeded = requested > 0 && confirmed === requested;
  const settlement: Rec = {
    provider: "LiteAPI",
    method: "WALLET",
    status: supplierSucceeded ? "settled" : "rejected",
    ...(str(hotelConfirmation?.reference) ? { hotelReference: str(hotelConfirmation?.reference) } : {}),
    ...(str(payment.paymentIntentId) ? { stripePaymentIntentId: str(payment.paymentIntentId) } : {}),
    settledAt: new Date().toISOString(),
  };

  let status = supplierSucceeded ? "booked" : "booking_failed";
  let errorMessage = errors.join(" ");
  let updatedDetails: Rec = { ...details, supplierSettlement: settlement };
  if (!supplierSucceeded) {
    // A partial provider confirmation creates a real supplier liability. Never
    // refund the full customer charge while a confirmed leg still exists.
    if (confirmed > 0) {
      errorMessage = `${errorMessage} A supplier-confirmed part of this trip needs manual reconciliation before any refund can be issued.`.trim();
      updatedDetails = { ...updatedDetails, payment: { ...payment, refundStatus: "manual_review" } };
    } else {
      const refund = await refundCustomerPayment(booking, errorMessage);
      updatedDetails = {
        ...updatedDetails,
        payment: { ...payment, refundStatus: refund.status, ...(refund.refundId ? { refundId: refund.refundId } : {}), refundRequestedAt: new Date().toISOString() },
      };
      errorMessage = `${errorMessage} ${refund.message}`.trim();
      if (refund.status === "refunded") status = "refunded";
      if (refund.status === "pending") status = "refund_pending";
      if (refund.status === "failed") status = "refund_failed";
    }
  }

  const [updatedRow] = await db
    .update(bookingsTable)
    .set({
      status,
      details: updatedDetails,
      flightConfirmation,
      hotelConfirmation,
      bookingError: supplierSucceeded ? null : {
        message: errorMessage,
        notificationState: "pending",
        partiallyConfirmed: confirmed > 0,
        flightConfirmed: flightConfirmation ? flightConfirmation.confirmed === true : undefined,
        hotelConfirmed: hotelConfirmation ? hotelConfirmation.confirmed === true : undefined,
      },
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, booking.id))
    .returning();

  if (!supplierSucceeded && updatedRow) {
    logger.error({ bookingId: booking.id, errors, status }, "Supplier booking incomplete after customer payment");
    await sendAndRecordNotification(updatedRow, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors: [errorMessage],
      partiallyConfirmed: confirmed > 0,
      flightConfirmed: flightConfirmation ? flightConfirmation.confirmed === true : undefined,
      hotelConfirmed: hotelConfirmation ? hotelConfirmation.confirmed === true : undefined,
    });
  }
}

function checkoutReturnUrl(req: Request, requested: unknown, bookingId: string, accessToken: string): string {
  const candidate = str(requested);
  if (candidate) {
    try {
      const url = new URL(candidate);
      const configuredOrigins = new Set(
        [
          ...(process.env.WEB_APP_ORIGINS?.split(",") ?? []),
          ...(process.env.REPLIT_DOMAINS?.split(",").map((domain) => `https://${domain}`) ?? []),
        ].map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean),
      );
      // Do not derive allowed redirect origins from an inbound Host header.
      if ((url.protocol === "https:" || url.protocol === "http:") && configuredOrigins.has(url.origin)) {
        url.pathname = `${url.pathname.replace(/\/$/, "")}/${encodeURIComponent(bookingId)}`;
        // Checkout returns in a new, top-level browser context. Include the
        // booking's existing guest credential so status retrieval does not
        // depend on preview-frame or tab-scoped browser storage.
        url.searchParams.set("token", accessToken);
        return url.toString();
      }
      if (url.protocol === "safferni:") {
        const mobileReturn = new URL(`safferni://booking/${encodeURIComponent(bookingId)}`);
        mobileReturn.searchParams.set("token", accessToken);
        return mobileReturn.toString();
      }
    } catch {
      // Use the same-origin fallback.
    }
  }
  throw new Error("Checkout return URL is not an allowed Safferni web origin or mobile deep link.");
}

async function confirmCustomerPayment(booking: Booking): Promise<Booking> {
  if (booking.status === "paid") return fulfillPaidBooking(booking);
  if (booking.status !== "payment_pending") return booking;
  const payment = rec(rec(booking.details).payment);
  const checkoutSessionId = str(payment.checkoutSessionId);
  if (!checkoutSessionId) return booking;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  if (session.status === "expired") {
    const [expired] = await db.update(bookingsTable)
      .set({ status: "payment_expired", bookingError: { message: "Your payment checkout expired before payment was completed." }, updatedAt: new Date() })
      .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "payment_pending")))
      .returning();
    return expired ?? booking;
  }
  if (session.payment_status !== "paid") {
    if (session.status === "complete") {
      const [failed] = await db.update(bookingsTable)
        .set({ status: "payment_failed", bookingError: { message: "Customer payment was not completed." }, updatedAt: new Date() })
        .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "payment_pending")))
        .returning();
      return failed ?? booking;
    }
    return booking;
  }

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const [paid] = await db.update(bookingsTable)
    .set({
      status: "paid",
      details: { ...rec(booking.details), payment: { ...payment, status: "paid", paymentIntentId, paidAt: new Date().toISOString() } },
      updatedAt: new Date(),
    })
    .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "payment_pending")))
    .returning();

  if (!paid) {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    return current ?? booking;
  }
  return fulfillPaidBooking(paid);
}

async function fulfillPaidBooking(booking: Booking): Promise<Booking> {
  const [claimed] = await db.update(bookingsTable)
    .set({
      status: "fulfillment_processing",
      details: { ...rec(booking.details), payment: { ...rec(rec(booking.details).payment), fulfillmentStartedAt: new Date().toISOString() } },
      updatedAt: new Date(),
    })
    .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "paid")))
    .returning();
  if (!claimed) {
    const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
    return current ?? booking;
  }
  await placeSupplierBookings(claimed);
  const [settled] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
  return settled ?? claimed;
}

/** Reconciles a refund created by the supplier-rejection path. */
async function reconcilePendingRefund(booking: Booking): Promise<void> {
  const payment = rec(rec(booking.details).payment);
  const refundId = str(payment.refundId);
  if (!refundId) return;
  try {
    const stripe = await getUncachableStripeClient();
    const refund = await stripe.refunds.retrieve(refundId);
    if (refund.status === "pending") return;
    const refunded = refund.status === "succeeded";
    await db.update(bookingsTable).set({
      status: refunded ? "refunded" : "refund_failed",
      details: { ...rec(booking.details), payment: { ...payment, refundStatus: refunded ? "refunded" : "failed", refundFinalizedAt: new Date().toISOString() } },
      bookingError: { ...rec(booking.bookingError), message: refunded ? "The supplier could not confirm the booking and your payment was refunded." : "The supplier could not confirm the booking and the refund needs attention." },
      updatedAt: new Date(),
    }).where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "refund_pending")));
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Pending refund reconciliation failed");
  }
}

/** Called from verified Stripe events and periodic recovery to prevent paid bookings from being stranded. */
export async function processDuePaymentBookings(): Promise<void> {
  const candidates = await db.select().from(bookingsTable)
    .where(and(
      eq(bookingsTable.status, "payment_pending"),
    ))
    .orderBy(desc(bookingsTable.updatedAt))
    .limit(25);
  for (const candidate of candidates) {
    try { await confirmCustomerPayment(candidate); } catch (err) { logger.error({ err, bookingId: candidate.id }, "Pending payment reconciliation failed"); }
  }

  const paid = await db.select().from(bookingsTable).where(eq(bookingsTable.status, "paid")).limit(25);
  for (const booking of paid) {
    try { await fulfillPaidBooking(booking); } catch (err) { logger.error({ err, bookingId: booking.id }, "Paid booking fulfillment recovery failed"); }
  }

  const processing = await db.select().from(bookingsTable).where(eq(bookingsTable.status, "fulfillment_processing")).limit(25);
  const recoveryThreshold = Date.now() - 5 * 60_000;
  for (const booking of processing) {
    const startedAt = Date.parse(str(rec(rec(booking.details).payment).fulfillmentStartedAt) ?? "");
    if (!Number.isFinite(startedAt) || startedAt > recoveryThreshold) continue;
    const [released] = await db.update(bookingsTable)
      .set({ status: "paid", updatedAt: new Date() })
      .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "fulfillment_processing")))
      .returning();
    if (!released) continue;
    try { await fulfillPaidBooking(released); } catch (err) { logger.error({ err, bookingId: booking.id }, "Stalled supplier fulfillment recovery failed"); }
  }

  const pendingRefunds = await db.select().from(bookingsTable).where(eq(bookingsTable.status, "refund_pending")).limit(25);
  for (const booking of pendingRefunds) await reconcilePendingRefund(booking);
}

router.post("/bookings", async (req, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid booking payload" });
    return;
  }
  const body = req.body as Rec;
  const flightReq = rec(body.flight);
  const hotelReq = rec(body.hotel);
  const draft = rec(body.draft);
  const flight = str(flightReq.id) ? getStoredFlightOffer(String(flightReq.id)) ?? null : null;
  const hotel = str(hotelReq.id) ? getStoredHotelOffer(String(hotelReq.id)) ?? null : null;
  if ((str(flightReq.id) && !flight) || (str(hotelReq.id) && !hotel)) {
    res.status(409).json({ error: "These offers have expired. Please run a new search to get fresh prices before booking." });
    return;
  }
  if (!str(flight?.bookingRef) && !str(hotel?.bookingRef)) {
    res.status(400).json({ error: "Nothing bookable selected — offers are missing booking references." });
    return;
  }

  const flightPrice = flight?.totalPrice ?? 0;
  let hotelPrice = hotel?.totalPrice ?? 0;
  let liteApiPrebook: Rec | null = null;
  if (hotel && str(hotel.bookingRef)) {
    const context = getOfferContext(hotel.id) ?? {};
    const offerId = str(context.offerId);
    if (!offerId) {
      res.status(409).json({ error: "These offers have expired. Please run a new search to get fresh prices before booking." });
      return;
    }
    try {
      const pre = rec(await laBookPost("/rates/prebook", { offerId, usePaymentSdk: false }));
      const data = rec(pre.data ?? pre);
      const prebookId = str(data.prebookId);
      if (!prebookId) throw new Error("LiteAPI prebook returned no prebookId");
      const livePrice = num(data.price, rec(data.price).amount, data.totalAmount);
      if (livePrice && livePrice > 0) hotelPrice = livePrice;
      liteApiPrebook = { prebookId, offerId, ...(livePrice ? { price: livePrice } : {}), ...(str(data.currency) ? { currency: str(data.currency) } : {}) };
    } catch (err) {
      logger.error({ err, hotelId: hotel.id }, "LiteAPI prebook failed");
      res.status(502).json({ error: "We couldn't reserve this room with the travel provider. Please try again in a moment." });
      return;
    }
  }

  const amount = flightPrice + hotelPrice;
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Invalid booking amount" });
    return;
  }
  const currency = (str(hotel?.currency, flight?.currency, draft.currency) ?? "USD").toLowerCase();
  const contactEmail = String(body.contactEmail);
  const travelers = Array.isArray(body.travelers) ? (body.travelers as unknown[]).map(rec) : [];
  const userId = (await getDbUser(req))?.id ?? null;
  const amountCents = Math.round(amount * 100);
  const [booking] = await db.insert(bookingsTable).values({
    userId,
    status: "payment_pending",
    amountCents,
    currency,
    contactEmail,
    details: {
      draft,
      ...(flight ? { flight } : {}),
      ...(hotel ? { hotel } : {}),
      ...(liteApiPrebook ? { liteApi: liteApiPrebook } : {}),
      travelers,
      payment: { provider: "Stripe", status: "pending", amountCents, currency },
    },
  }).returning();
  if (!booking) {
    res.status(500).json({ error: "Could not create booking" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const returnUrl = checkoutReturnUrl(req, body.returnUrl, booking.id, booking.accessToken);
    const join = returnUrl.includes("?") ? "&" : "?";
    // Hotel totals are locked server-side by LiteAPI prebook. A corresponding
    // Stripe price is created server-side — never from client input.
    const product = await stripe.products.create({
      name: `Safferni stay${str(hotel?.name) ? ` at ${str(hotel?.name)}` : ""}`,
      metadata: { bookingId: booking.id },
    }, { idempotencyKey: `booking-product-${booking.id}` });
    const price = await stripe.prices.create({
      currency,
      unit_amount: amountCents,
      product: product.id,
      metadata: { bookingId: booking.id },
    }, { idempotencyKey: `booking-price-${booking.id}` });
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: contactEmail,
      client_reference_id: booking.id,
      success_url: `${returnUrl}${join}checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}${join}checkout=cancelled`,
      metadata: { bookingId: booking.id, liteApiPrebookId: str(liteApiPrebook?.prebookId) ?? "" },
      line_items: [{ price: price.id, quantity: 1 }],
    }, { idempotencyKey: `booking-checkout-${booking.id}` });
    if (!checkout.url) throw new Error("Stripe returned no checkout URL");
    await db.update(bookingsTable).set({
      details: { ...rec(booking.details), payment: { provider: "Stripe", status: "pending", stripeProductId: product.id, stripePriceId: price.id, checkoutSessionId: checkout.id, expiresAt: checkout.expires_at ? new Date(checkout.expires_at * 1000).toISOString() : undefined } },
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));
    res.json({ bookingId: booking.id, accessToken: booking.accessToken, status: "payment_pending", checkoutUrl: checkout.url });
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Stripe checkout creation failed");
    await db.update(bookingsTable).set({
      status: "payment_failed",
      bookingError: { message: "We couldn't start secure payment checkout. No charge was made." },
      updatedAt: new Date(),
    }).where(eq(bookingsTable.id, booking.id));
    res.status(502).json({ error: "We couldn't start secure payment checkout. No charge was made." });
  }
});

router.post("/bookings/:bookingId/confirm-payment", async (req, res) => {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, String(req.params.bookingId)));
  const dbUser = await getDbUser(req);
  if (!booking || !canViewBooking(dbUser, booking, rec(req.body).token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  try {
    res.json(toApiBooking(await confirmCustomerPayment(booking)));
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Payment verification failed");
    res.status(502).json({ error: "We couldn't verify your payment yet. Please try again shortly." });
  }
});

router.get("/bookings", requireAuth, async (req, res) => {
  const rows = await db.select().from(bookingsTable).where(eq(bookingsTable.userId, req.dbUser!.id)).orderBy(desc(bookingsTable.createdAt));
  res.json({ bookings: rows.map(toApiBooking) });
});

router.get("/bookings/:bookingId", async (req, res) => {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, String(req.params.bookingId)));
  const dbUser = await getDbUser(req);
  if (!booking || !canViewBooking(dbUser, booking, req.query.token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  try {
    if (booking.status === "booking_failed") {
      retryNotificationIfDue(booking).catch((err) => logger.error({ err, bookingId: booking.id }, "Notification retry unexpectedly threw"));
    }
    res.json(toApiBooking(booking));
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Failed to retrieve booking");
    res.json(toApiBooking(booking));
  }
});

export default router;

/** A booking may be viewed by its signed-in owner or anyone holding its secret access token. */
function canViewBooking(dbUser: { id: string } | undefined, booking: Booking, token: unknown): boolean {
  if (tokenMatches(booking, token) || checkoutSessionMatches(booking, token)) return true;
  return Boolean(dbUser && booking.userId && dbUser.id === booking.userId);
}