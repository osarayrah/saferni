import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, bookingsTable, type Booking } from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { laBookPost } from "../lib/liteApi";
import { logger } from "../lib/logger";
import { getStoredFlightOffer, getStoredHotelOffer, getOfferContext } from "../lib/offerStore";
import { sendAndRecordNotification, retryNotificationIfDue } from "../lib/bookingOutbox";
import { getDbUser, requireAuth } from "../middlewares/requireAuth";

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

function tokenMatches(booking: Booking, provided: unknown): boolean {
  if (typeof provided !== "string" || !provided) return false;
  const a = Buffer.from(booking.accessToken);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
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

// ---------------------------------------------------------------------------
// Supplier fulfillment (LiteAPI) — runs after the booking request is accepted.
// ---------------------------------------------------------------------------

/**
 * Flight fulfillment seam. LiteAPI flight access is not approved yet, so no
 * live flight offer carries a bookable reference and this only fires for
 * legacy rows; it reports a clean failure (manual support follow-up) instead
 * of silently dropping the leg. Implement against LiteAPI's flight booking
 * endpoints here when access lands — callers need no other change.
 */
async function placeFlightBooking(_booking: Booking, _flight: Rec, _travelers: Rec[]): Promise<{ confirmed: boolean; reference?: string; raw?: Rec; error?: string }> {
  return { confirmed: false, error: "Flight booking is not yet available with the current travel supplier." };
}

/**
 * Book a prebooked hotel rate. LiteAPI is settled from the account wallet,
 * so the book call uses the WALLET method.
 */
async function placeHotelBooking(booking: Booking, travelers: Rec[]): Promise<{ confirmed: boolean; reference?: string; raw?: Rec; error?: string }> {
  const details = rec(booking.details);
  const prebookId = str(rec(details.liteApi).prebookId);
  if (!prebookId) {
    return { confirmed: false, error: "Hotel booking is missing its prebook reference." };
  }
  const first = travelers.find((t) => str(t.firstName)) ?? {};
  const holder = {
    firstName: str(first.firstName) ?? "Guest",
    lastName: str(first.lastName) ?? "Guest",
    email: booking.contactEmail,
  };
  const guestList = travelers.length ? travelers : [holder as Rec];
  const res = rec(
    await laBookPost("/rates/book", {
      prebookId,
      holder,
      guests: guestList.map((t) => ({
        occupancyNumber: 1,
        firstName: str(t.firstName) ?? holder.firstName,
        lastName: str(t.lastName) ?? holder.lastName,
        email: booking.contactEmail,
      })),
      payment: { method: "WALLET" },
      // Idempotency: LiteAPI dedupes on clientReference, so a retried
      // fulfillment can't double-book.
      clientReference: booking.id,
    }),
  );
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

async function placeSupplierBookings(booking: Booking): Promise<void> {
  const details = rec(booking.details);
  const flight = rec(details.flight);
  const hotel = rec(details.hotel);
  const travelers = Array.isArray(details.travelers) ? details.travelers.map(rec) : [];

  let flightConfirmation: Rec | null = null;
  let hotelConfirmation: Rec | null = null;
  const errors: string[] = [];

  if (str(flight.bookingRef)) {
    try {
      const result = await placeFlightBooking(booking, flight, travelers);
      if (result.confirmed && result.reference) {
        flightConfirmation = { confirmed: true, reference: result.reference, provider: "LiteAPI", ...(result.raw ? { raw: result.raw } : {}) };
      } else {
        errors.push(result.error ?? "Flight booking was not confirmed by the provider.");
        flightConfirmation = { confirmed: false, ...(result.raw ? { raw: result.raw } : {}) };
      }
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
  const confirmed =
    [flightConfirmation, hotelConfirmation].filter((c) => c && c.confirmed === true).length;
  const status = requested > 0 && confirmed === requested ? "booked" : "booking_failed";

  const errorMessage = errors.join(" ");
  // Set notificationState: "pending" atomically with the status transition so a
  // process restart can always find and retry any unsent notification.
  const [updatedRow] = await db
    .update(bookingsTable)
    .set({
      status,
      flightConfirmation,
      hotelConfirmation,
      bookingError: status === "booking_failed"
        ? {
            message: errorMessage,
            notificationState: "pending",
            partiallyConfirmed: confirmed > 0,
            flightConfirmed: flightConfirmation ? flightConfirmation.confirmed === true : undefined,
            hotelConfirmed: hotelConfirmation ? hotelConfirmation.confirmed === true : undefined,
          }
        : (errors.length ? { message: errorMessage } : null),
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, booking.id))
    .returning();

  if (status === "booking_failed" && updatedRow) {
    logger.error({ bookingId: booking.id, errors }, "Supplier booking incomplete");
    await sendAndRecordNotification(updatedRow, {
      bookingId: booking.id,
      contactEmail: booking.contactEmail,
      amountCents: booking.amountCents,
      currency: booking.currency,
      errors,
      partiallyConfirmed: confirmed > 0,
      flightConfirmed: flightConfirmation ? flightConfirmation.confirmed === true : undefined,
      hotelConfirmed: hotelConfirmation ? hotelConfirmation.confirmed === true : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
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

  // Price ONLY from offers the server itself returned from search. The client
  // sends offer ids; every price, currency, and provider reference comes from
  // the server-side snapshot, so a tampered request can never change the amount.
  const flight = str(flightReq.id) ? getStoredFlightOffer(String(flightReq.id)) ?? null : null;
  const hotel = str(hotelReq.id) ? getStoredHotelOffer(String(hotelReq.id)) ?? null : null;
  if ((str(flightReq.id) && !flight) || (str(hotelReq.id) && !hotel)) {
    res.status(409).json({
      error: "These offers have expired. Please run a new search to get fresh prices before booking.",
    });
    return;
  }

  if (!str(flight?.bookingRef) && !str(hotel?.bookingRef)) {
    res.status(400).json({ error: "Nothing bookable selected — offers are missing booking references." });
    return;
  }

  const flightPrice = flight?.totalPrice ?? 0;
  let hotelPrice = hotel?.totalPrice ?? 0;

  // Server-side price check: prebook the hotel rate with LiteAPI. Prebook
  // locks the rate, returns its final price, and yields the prebookId needed
  // for supplier fulfillment.
  let liteApiPrebook: Rec | null = null;
  if (hotel && str(hotel.bookingRef)) {
    const ctx = getOfferContext(hotel.id) ?? {};
    const offerId = str(ctx.offerId);
    if (!offerId) {
      res.status(409).json({
        error: "These offers have expired. Please run a new search to get fresh prices before booking.",
      });
      return;
    }
    try {
      const pre = rec(await laBookPost("/rates/prebook", { offerId, usePaymentSdk: false }));
      const data = rec(pre.data ?? pre);
      const prebookId = str(data.prebookId);
      if (!prebookId) throw new Error("LiteAPI prebook returned no prebookId");
      const livePrice = num(data.price, rec(data.price).amount, data.totalAmount);
      if (livePrice && livePrice > 0) hotelPrice = livePrice;
      liteApiPrebook = {
        prebookId,
        offerId,
        ...(livePrice ? { price: livePrice } : {}),
        ...(str(data.currency) ? { currency: str(data.currency) } : {}),
      };
    } catch (err) {
      logger.error({ err, hotelId: hotel.id }, "LiteAPI prebook failed");
      res.status(502).json({
        error: "We couldn't reserve this room with the travel provider. Please try again in a moment.",
      });
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

  // Insert the booking record — amountCents is priced from server-stored
  // offers plus the prebook price check, never from client input.
  const [booking] = await db
    .insert(bookingsTable)
    .values({
      userId,
      status: "paid",
      amountCents: Math.round(amount * 100),
      currency,
      contactEmail,
      details: {
        draft,
        ...(flight ? { flight } : {}),
        ...(hotel ? { hotel } : {}),
        ...(liteApiPrebook ? { liteApi: liteApiPrebook } : {}),
        travelers,
      },
    })
    .returning();

  if (!booking) {
    res.status(500).json({ error: "Could not create booking" });
    return;
  }

  // LiteAPI is settled from the account wallet. Fulfill immediately and
  // return the access token so guest users can track the result.
  await placeSupplierBookings(booking);
  const [fresh] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id));
  res.json({
    bookingId: booking.id,
    accessToken: booking.accessToken,
    status: fresh?.status ?? "booking_failed",
  });
});

router.get("/bookings", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.userId, req.dbUser!.id))
    .orderBy(desc(bookingsTable.createdAt));
  res.json({ bookings: rows.map(toApiBooking) });
});

router.get("/bookings/:bookingId", async (req, res) => {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, String(req.params.bookingId)));

  // Require the secret access token (or being the signed-in owner). Respond
  // 404 either way so booking IDs can't be probed for existence.
  const dbUser = await getDbUser(req);
  if (!booking || !canViewBooking(dbUser, booking, req.query.token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  try {
    // Recovery: if a booking_failed notification was never sent (e.g. due to a
    // process restart between the status update and the notification attempt),
    // retry it now. Fire-and-ignore — failure is already recorded in DB state.
    if (booking.status === "booking_failed") {
      retryNotificationIfDue(booking).catch((err) =>
        logger.error({ err, bookingId: booking.id }, "Notification retry unexpectedly threw"),
      );
    }
    res.json(toApiBooking(booking));
  } catch (err) {
    logger.error({ err, bookingId: booking.id }, "Failed to finalize booking");
    res.json(toApiBooking(booking));
  }
});

export default router;

/** A booking may be viewed by its signed-in owner or anyone holding its secret access token. */
function canViewBooking(dbUser: { id: string } | undefined, booking: Booking, token: unknown): boolean {
  if (tokenMatches(booking, token)) return true;
  return Boolean(dbUser && booking.userId && dbUser.id === booking.userId);
}
