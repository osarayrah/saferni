import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { SearchTripsBody, SearchTripsResponse, GetHotelDetailResponse } from "@workspace/api-zod";
import { storeOffers, storeOfferContexts, _clearOffersForTesting } from "../lib/offerStore";
import { liteApiConfigured, laGet, laPost, getHotelDetails, _setLiteApiFetchForTesting } from "../lib/liteApi";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

type SearchResult = ReturnType<typeof SearchTripsResponse.parse>;
type FlightOffer = SearchResult["flights"][number];
type HotelOffer = SearchResult["hotels"][number];
type HotelDetail = ReturnType<typeof GetHotelDetailResponse.parse>;

// ---------------------------------------------------------------------------
// Supplier: LiteAPI (Nuitée).
// Hotels: GET /data/hotels (static content) + POST /hotels/rates (live rates),
// merged into HotelOffer. Flights: POST /flights/rates → FlightOffer (search
// only — booking is on hold, see replit.md). Response mapping throughout is
// defensive: offers that don't yield the required fields are skipped, and an
// empty result triggers the client's demo fallback.
// ---------------------------------------------------------------------------

/** Inject a fetch implementation — only for use in tests. */
export function _setFetchForTesting(fn: typeof fetch | null): void {
  _setLiteApiFetchForTesting(fn);
  cache.clear();
  placeCache.clear();
  hotelContentCache.clear();
  _clearOffersForTesting();
}

// ---------------------------------------------------------------------------
// Defensive extraction helpers (supplier responses are loosely typed)
// ---------------------------------------------------------------------------
type Rec = Record<string, unknown>;
function rec(v: unknown): Rec {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(...vals: unknown[]): string | undefined {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v;
  return undefined;
}
function cleanSupplierText(...vals: unknown[]): string | undefined {
  const value = str(...vals);
  if (!value) return undefined;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|li|ul|ol|strong|b|em|i|span|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || undefined;
}
function num(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    // Strict numeric-string parse: reject partially numeric values like "1450junk".
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Flight search: LiteAPI POST /flights/rates → FlightOffer[]. Search only —
// booking (prebook/book) is NOT wired up yet: LiteAPI's /rates/prebook
// returns a server-side 500 for flight offerIds on this sandbox account
// regardless of usePaymentSdk, confirmed live and reported to LiteAPI
// support. FlightOffer.bookingRef is deliberately left unset below; the
// client already gates checkout eligibility on bookingRef presence
// (bookableFlight = trip?.flight?.bookingRef ? trip.flight : null in
// booking/new.tsx), so flights show up in search/packages but can't reach
// checkout — no server-side guard needed for that, it's already correct.
// ---------------------------------------------------------------------------
type MappedSegment = FlightOffer["outbound"]["segments"][number];
type MappedItinerary = FlightOffer["outbound"];

const FLIGHT_MAX_RESULTS = 25;

function minutesBetween(depIso?: string, arrIso?: string): number {
  if (!depIso || !arrIso) return 0;
  const d = Date.parse(depIso);
  const a = Date.parse(arrIso);
  if (Number.isNaN(d) || Number.isNaN(a) || a <= d) return 0;
  return Math.round((a - d) / 60000);
}

function mapFlightSegment(raw: unknown): MappedSegment | null {
  const s = rec(raw);
  const carrier = rec(s.carrier);
  const flightNum = rec(s.flight);
  const departureAirport = str(s.originCode);
  const arrivalAirport = str(s.destinationCode);
  const departureTime = str(s.departureTime);
  const arrivalTime = str(s.arrivalTime);
  if (!departureAirport || !arrivalAirport || !departureTime || !arrivalTime) return null;
  const airlineCode = str(carrier.marketingCode, carrier.operatingCode) ?? "XX";
  const airlineName = str(carrier.marketingName, carrier.operatingName) ?? airlineCode;
  const flightNumber = `${airlineCode}${str(flightNum.marketingNumber, flightNum.operatingNumber) ?? ""}`.trim();
  return {
    departureAirport,
    arrivalAirport,
    departureTime,
    arrivalTime,
    airlineCode,
    airlineName,
    flightNumber,
    // Segment-level duration.minutes checked out against its own ISO8601
    // string in live testing; the journey-level totalDuration/legDurations
    // did NOT (looked like a sandbox data bug) — so itinerary duration below
    // is computed from elapsed time, never trusted from a summary field.
    durationMinutes: num(rec(s.duration).minutes) ?? minutesBetween(departureTime, arrivalTime),
  };
}

function legFromSegments(segments: MappedSegment[]): MappedItinerary | null {
  if (!segments.length) return null;
  const elapsed = minutesBetween(segments[0].departureTime, segments[segments.length - 1].arrivalTime);
  return {
    durationMinutes: elapsed || segments.reduce((s, seg) => s + seg.durationMinutes, 0),
    segments,
  };
}

const CABIN_CLASSES = ["economy", "premium_economy", "business", "first"] as const;
function normalizeCabinClass(raw: unknown): FlightOffer["cabinClass"] {
  const s = (str(raw) ?? "economy").toLowerCase().replace(/\s+/g, "_");
  return (CABIN_CLASSES as readonly string[]).includes(s) ? (s as FlightOffer["cabinClass"]) : "economy";
}

/**
 * LiteAPI gives structured per-bag-type included/paid arrays; our schema
 * wants short human strings. Anything not found leaves unknown: true, same
 * convention as the rest of the mapping (defensive, never fabricated).
 */
function mapFlightBaggage(raw: unknown): FlightOffer["baggage"] {
  const b = rec(raw);
  const included = arr(b.included).map(rec);
  const paid = arr(b.paid).map(rec);
  const describe = (bagType: string): string | undefined => {
    const inc = included.find((x) => str(x.bagType) === bagType);
    if (inc) {
      const w = num(inc.weightKg);
      return `Included${w ? ` (${w}kg)` : ""}`;
    }
    const p = paid.find((x) => str(x.bagType) === bagType);
    if (p) {
      const amt = num(rec(rec(p.pricing).display).amount);
      const cur = str(rec(rec(p.pricing).display).currency) ?? "";
      const w = num(p.weightKg);
      return `From ${amt !== undefined ? `${cur}${amt}` : "extra cost"}${w ? ` (${w}kg)` : ""}`;
    }
    return undefined;
  };
  const cabin = describe("cabin") ?? describe("personal");
  const checked = describe("checked");
  return {
    ...(cabin ? { cabin } : {}),
    ...(checked ? { checked } : {}),
    unknown: !cabin && !checked,
  };
}

/**
 * One journey (a fixed route + schedule) → one FlightOffer, priced from its
 * cheapest offer — the same "one representative price per item" choice
 * mapHotel makes for room types. Known tradeoff: since only the cheapest
 * fare is mapped, cabin-class variety (business/first) is limited to
 * journeys whose cheapest fare already happens to be non-economy; richer
 * per-journey fare options (journey.offers[], plural) aren't mapped — worth
 * revisiting if buildPackages' "most comfortable" pick needs better options.
 */
function mapJourney(raw: unknown, travellers: number, currency: string, now: string): { offer: FlightOffer; offerId: string } | null {
  const j = rec(raw);
  const offer = rec(j.cheapestOffer);
  const offerId = str(offer.offerId);
  if (!offerId) return null;

  const pricing = rec(rec(offer.pricing).display);
  const totalRaw = num(pricing.total);
  if (!totalRaw || totalRaw <= 0) return null;

  const rawSegments = arr(j.segments).map(rec);
  const outboundSegs = rawSegments
    .filter((s) => str(s.direction) !== "INBOUND")
    .map(mapFlightSegment)
    .filter((s): s is MappedSegment => s !== null);
  const inboundSegs = rawSegments
    .filter((s) => str(s.direction) === "INBOUND")
    .map(mapFlightSegment)
    .filter((s): s is MappedSegment => s !== null);
  const outbound = legFromSegments(outboundSegs);
  if (!outbound) return null;
  const inbound = legFromSegments(inboundSegs);

  const totalPrice = Math.round(totalRaw);
  const perPaxAdult = num(rec(rec(pricing.perPassenger).adult).total);
  const pricePerTraveller = Math.round(perPaxAdult ?? totalPrice / Math.max(1, travellers));

  const terms = rec(offer.terms);
  const fareFamily = str(rec(offer.fare).family);
  const segmentFares = arr(offer.segmentFares).map(rec);
  const cabinClass = normalizeCabinClass(str(segmentFares[0]?.cabin) ?? fareFamily);
  const termsSummary = arr(terms.summary).map(rec).map((m) => str(m.message)).filter((m): m is string => Boolean(m)).join(" ");

  // offerId is a long opaque blob — hash it for a compact stable id, same
  // approach the old RouteStack fareSourceCode mapping used.
  const idPart = crypto.createHash("sha1").update(offerId).digest("hex").slice(0, 12);

  return {
    offer: {
      id: `la_fl_${idPart}`,
      provider: "LiteAPI",
      sourceType: "live",
      totalPrice,
      currency: str(pricing.currency) ?? currency,
      pricePerTraveller,
      validatingAirline: outbound.segments[0].airlineName,
      cabinClass,
      outbound,
      ...(inbound ? { inbound } : {}),
      totalDurationMinutes: outbound.durationMinutes + (inbound?.durationMinutes ?? 0),
      totalStops: Math.max(0, outbound.segments.length - 1) + (inbound ? Math.max(0, inbound.segments.length - 1) : 0),
      baggage: mapFlightBaggage(offer.baggage),
      refundable: terms.refundable === true,
      changeable: terms.changeable === true,
      ...(termsSummary ? { fareRulesSummary: termsSummary.slice(0, 300) } : {}),
      lastUpdatedAt: now,
    },
    offerId,
  };
}

async function searchFlights(
  draft: ReturnType<typeof withDates>,
  contexts: Record<string, Rec>,
  now: string,
): Promise<FlightOffer[]> {
  if (!draft.destinationCode) return [];
  const travellers = draft.adults + draft.children;

  // draft.destinationCode is a free-text AI-supplied label since destinations
  // opened up beyond the old fixed city list — it's no longer guaranteed to
  // be a real IATA airport code (unlike draft.origin, which the planner has
  // always been instructed to keep as one). If it isn't a real airport code,
  // LiteAPI simply returns no usable journeys and this degrades to the
  // existing empty-flights fallback — same graceful-failure shape as every
  // other resolution step in this file, not a special case.
  // draft.returnDate is unconditionally backfilled by withDates() (hotels
  // need *some* stay-end date even on a one-way-flight trip), so its mere
  // presence can't tell a one-way flight from a round-trip one — oneWay is
  // the only reliable signal here.
  const legs = [
    { origin: draft.origin, destination: draft.destinationCode, date: draft.departureDate, direction: "OUTBOUND" },
    ...(draft.oneWay
      ? []
      : [{ origin: draft.destinationCode, destination: draft.origin, date: draft.returnDate, direction: "INBOUND" }]),
  ];
  const res = await laPost("/flights/rates", {
    legs,
    adults: draft.adults,
    ...(draft.children ? { children: draft.children } : {}),
    currency: draft.currency,
  });
  const group = rec(arr(res.data)[0]);
  const journeys = arr(group.journeys);

  const byId = new Map<string, FlightOffer>();
  for (const journey of journeys) {
    const mapped = mapJourney(journey, travellers, draft.currency, now);
    if (!mapped) continue;
    const existing = byId.get(mapped.offer.id);
    if (!existing || mapped.offer.totalPrice < existing.totalPrice) {
      byId.set(mapped.offer.id, mapped.offer);
      contexts[mapped.offer.id] = {
        kind: "flight",
        offerId: mapped.offerId,
        origin: draft.origin,
        destination: draft.destinationCode,
        departureDate: draft.departureDate,
        returnDate: draft.returnDate,
        adults: draft.adults,
        children: draft.children,
        currency: draft.currency,
      };
    }
  }
  if (!byId.size) {
    logger.warn(
      { step: "flightsMapping", journeysReturned: journeys.length, rawKeys: Object.keys(res) },
      "search: /flights/rates returned data but the mapping filter kept none of it",
    );
  }
  return [...byId.values()]
    .sort((a, b) => a.totalPrice - b.totalPrice)
    .slice(0, FLIGHT_MAX_RESULTS);
}

// ---------------------------------------------------------------------------
// Hotel mapping: LiteAPI /data/hotels content + /hotels/rates offer → HotelOffer
// ---------------------------------------------------------------------------
type HotelContent = Rec;

function cheapestOffer(rateHotel: Rec): { offerId: string; total: number; currency?: string; roomName?: string; mealPlan?: string; refundable?: boolean; cancellationSummary?: string } | null {
  let best: ReturnType<typeof cheapestOffer> = null;
  for (const rtRaw of arr(rateHotel.roomTypes)) {
    const rt = rec(rtRaw);
    const offerId = str(rt.offerId);
    if (!offerId) continue;
    // Room-type total: offerRetailRate, else the first rate's retailRate total.
    const rates = arr(rt.rates).map(rec);
    const firstRate = rates[0] ?? {};
    const retail = rec(firstRate.retailRate);
    const total = num(
      rec(rt.offerRetailRate).amount,
      rec(arr(retail.total)[0]).amount,
      rec(retail.total).amount,
    );
    if (!total || total <= 0) continue;
    if (best && best.total <= total) continue;
    const currency = str(rec(rt.offerRetailRate).currency, rec(arr(retail.total)[0]).currency, firstRate.currency);
    const cancel = rec(firstRate.cancellationPolicies);
    const refundableTag = str(cancel.refundableTag);
    best = {
      offerId,
      total,
      ...(currency ? { currency } : {}),
      ...(str(firstRate.name) ? { roomName: str(firstRate.name) } : {}),
      ...(str(firstRate.boardName) ? { mealPlan: str(firstRate.boardName) } : {}),
      ...(refundableTag ? { refundable: refundableTag === "RFN" } : {}),
      ...(refundableTag
        ? { cancellationSummary: refundableTag === "RFN" ? "Refundable — see policy at checkout" : "Non-refundable" }
        : {}),
    };
  }
  return best;
}

function mapRoomOptions(rateHotel: Rec, fallbackCurrency: string, mappedRooms: Rec[] = []): HotelOffer["roomOptions"] {
  return arr(rateHotel.roomTypes)
    .map((raw) => {
      const room = rec(raw);
      const id = str(room.offerId);
      const firstRate = rec(arr(room.rates)[0]);
      const mappedRoomId = str(room.mappedRoomId, firstRate.mappedRoomId);
      const roomDetails = mappedRooms.find((candidate) => String(candidate.id ?? "") === mappedRoomId);
      const retail = rec(firstRate.retailRate);
      const total = num(
        rec(room.offerRetailRate).amount,
        rec(arr(retail.total)[0]).amount,
        rec(retail.total).amount,
      );
      // The mapped supplier room name is authoritative and may contain
      // occupancy or bed information needed by the property.
      const name = str(roomDetails?.roomName, firstRate.name, room.name, room.roomName);
      if (!id || !name || total === undefined || total <= 0) return null;
      const currency = str(rec(room.offerRetailRate).currency, rec(arr(retail.total)[0]).currency, firstRate.currency) ?? fallbackCurrency;
      const refundableTag = str(rec(firstRate.cancellationPolicies).refundableTag);
      const roomType = rec(room.roomType);
      const imageSources = [
        ...arr(room.photos),
        ...arr(room.images),
        ...arr(room.roomImages),
        ...arr(roomType.photos),
        ...arr(roomType.images),
        ...arr(roomDetails?.photos),
        ...arr(firstRate.photos),
        ...arr(firstRate.images),
        ...arr(rec(firstRate.room).photos),
        ...arr(rec(firstRate.room).images),
      ];
      const images = [...new Set(mapImageUrls(imageSources))];
      const amenities = mapFacilities(roomDetails?.roomAmenities ?? room.amenities ?? firstRate.amenities);
      const bedTypes = arr(roomDetails?.bedTypes)
        .map((bed) => {
          const value = rec(bed);
          const bedName = str(value.bedType, value.name);
          const quantity = num(value.quantity);
          return bedName ? `${quantity && quantity > 1 ? `${quantity} ` : ""}${bedName}` : undefined;
        })
        .filter((bed): bed is string => Boolean(bed));
      return {
        id,
        name,
        totalPrice: total,
        currency,
        ...(cleanSupplierText(firstRate.description, room.description) ? { description: cleanSupplierText(firstRate.description, room.description) } : {}),
        ...(num(room.maxOccupancy, firstRate.maxOccupancy) !== undefined
          ? { maxOccupancy: num(room.maxOccupancy, firstRate.maxOccupancy) }
          : num(roomDetails?.maxOccupancy) !== undefined
            ? { maxOccupancy: num(roomDetails?.maxOccupancy) }
          : {}),
        ...(cleanSupplierText(roomDetails?.description) ? { description: cleanSupplierText(roomDetails?.description) } : {}),
        ...(num(roomDetails?.roomSizeSquare) !== undefined ? { roomSizeSquare: num(roomDetails?.roomSizeSquare) } : {}),
        ...(str(roomDetails?.roomSizeUnit) ? { roomSizeUnit: str(roomDetails?.roomSizeUnit) } : {}),
        ...(bedTypes.length ? { bedTypes } : {}),
        ...(amenities.length ? { amenities: amenities.slice(0, 12) } : {}),
        ...(images.length ? { images } : {}),
        ...(str(firstRate.boardName) ? { mealPlan: str(firstRate.boardName) } : {}),
        ...(refundableTag ? { refundable: refundableTag === "RFN" } : {}),
      };
    })
    .filter((option): option is NonNullable<typeof option> => option !== null)
    .slice(0, 12);
}

function mapHotel(
  content: HotelContent,
  rateHotel: Rec,
  nights: number,
  currency: string,
  city: string,
  now: string,
): { offer: HotelOffer; offerId: string } | null {
  const hotelId = str(rateHotel.hotelId, content.id);
  const name = str(content.name, rateHotel.name);
  if (!hotelId || !name) return null;
  const best = cheapestOffer(rateHotel);
  if (!best) return null;

  const stars = num(content.stars, content.starRating);
  const images = [
    ...(str(content.main_photo) ? [String(content.main_photo)] : []),
    ...arr(content.images ?? content.photos)
      .map((p) => str(p, rec(p).url))
      .filter((u): u is string => Boolean(u)),
  ].slice(0, 5);
  const mappedRooms = arr(rateHotel.rooms).map(rec);
  const roomOptions = mapRoomOptions(rateHotel, currency, mappedRooms) ?? [];

  const offer: HotelOffer = {
    id: `la_ht_${hotelId}`,
    provider: "LiteAPI",
    sourceType: "live",
    name,
    ...(cleanSupplierText(content.hotelDescription) ? { description: cleanSupplierText(content.hotelDescription)?.slice(0, 500) } : {}),
    starRating: stars ? Math.max(1, Math.min(5, Math.round(stars))) : 3,
    guestRating: num(content.rating, content.guestRating) ?? 0,
    reviewCount: num(content.reviewCount) ?? 0,
    address: str(content.address, rec(content.address).line1) ?? city,
    latitude: num(content.latitude, rec(content.location).latitude) ?? 0,
    longitude: num(content.longitude, rec(content.location).longitude) ?? 0,
    images,
    // /data/hotels exposes numeric facilityIds, not names — leave amenities to
    // any string list the response happens to include.
    amenities: arr(content.amenities ?? content.hotelFacilities)
      .map((a) => str(a, rec(a).name))
      .filter((a): a is string => Boolean(a))
      .slice(0, 8),
    ...(best.roomName ? { roomName: best.roomName } : {}),
    ...(best.mealPlan ? { mealPlan: best.mealPlan } : {}),
    ...(roomOptions.length ? { roomOptions } : {}),
    nightlyPrice: Math.round(best.total / Math.max(1, nights)),
    totalPrice: Math.round(best.total),
    currency: best.currency ?? currency,
    refundable: best.refundable ?? false,
    cancellationSummary: best.cancellationSummary ?? "Cancellation policy shown at booking",
    checkInTime: str(content.checkinCheckoutTimes && rec(content.checkinCheckoutTimes).checkin) ?? "15:00",
    checkOutTime: str(content.checkinCheckoutTimes && rec(content.checkinCheckoutTimes).checkout) ?? "11:00",
    bookingRef: hotelId,
    lastUpdatedAt: now,
  };
  return { offer, offerId: best.offerId };
}

// ---------------------------------------------------------------------------
// Live search with in-memory cache (10 min TTL)
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 10 * 60 * 1000;
const HOTEL_CONTENT_LIMIT = 80;
const HOTEL_MAX_RESULTS = 16;
// A pure cheapest-first cut silently hides every 5-star property whenever
// enough cheaper, lower-star hotels exist — guarantee at least this many of
// the highest-starRating hotels survive the cut regardless of price.
const MIN_TOP_RATED_RESULTS = 2;
const cache = new Map<string, { at: number; flights: FlightOffer[]; hotels: HotelOffer[]; contexts?: Record<string, Rec> }>();

/**
 * Swap the priciest survivors of a cheapest-first cut for the highest-
 * starRating hotels when those didn't already make it in on price alone.
 * Keeps the returned list sorted by price throughout.
 */
function withTopRatedGuaranteed(byPrice: HotelOffer[], maxResults: number): HotelOffer[] {
  const base = byPrice.slice(0, maxResults);
  if (byPrice.length <= maxResults) return base; // nothing was cut, nothing to fix

  const maxStars = Math.max(...byPrice.map((h) => h.starRating));
  const topRated = byPrice.filter((h) => h.starRating === maxStars);
  const missing = topRated.filter((h) => !base.some((b) => b.id === h.id)).slice(0, MIN_TOP_RATED_RESULTS);
  if (!missing.length) return base; // already enough top-rated hotels present

  return base
    .slice(0, base.length - missing.length)
    .concat(missing)
    .sort((a, b) => a.totalPrice - b.totalPrice);
}

type Draft = ReturnType<typeof SearchTripsBody.parse>["draft"];

function withDates(draft: Draft): Draft & { departureDate: string; returnDate: string; nights: number } {
  const nights = draft.nights ?? 5;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  // The planner deliberately keeps unknown dates as empty strings while a
  // traveller is still describing a trip. Empty strings must be treated as
  // absent here — passing them to LiteAPI causes a 400 and leaves the results
  // screen empty even though a useful flexible-date search is possible.
  const departureDate = typeof draft.departureDate === "string" && datePattern.test(draft.departureDate)
    ? draft.departureDate
    : undefined;
  const returnDate = typeof draft.returnDate === "string" && datePattern.test(draft.returnDate)
    ? draft.returnDate
    : undefined;

  if (departureDate && returnDate) return { ...draft, nights, departureDate, returnDate };
  const dep = departureDate
    ? new Date(`${departureDate}T12:00:00Z`)
    : new Date();
  if (!departureDate) dep.setDate(dep.getDate() + 21);
  const ret = new Date(dep);
  ret.setDate(ret.getDate() + nights);
  return {
    ...draft,
    nights,
    departureDate: departureDate ?? dep.toISOString().slice(0, 10),
    returnDate: returnDate ?? ret.toISOString().slice(0, 10),
  };
}

// Any destination LiteAPI has inventory for is bookable — resolve the
// traveler's free-text city (+ best-guess country, from the AI planner) to
// a LiteAPI place via /data/places, then pass that placeId straight through
// to /data/hotels and /hotels/rates (both accept it directly, no need to
// extract city/country strings ourselves).
//
// Same-named cities collide worldwide (Cairo, Egypt vs Cairo, GA, USA;
// Cambridge UK vs MA vs Ontario; Valencia, Spain vs Venezuela; Georgetown
// exists in a dozen countries) and /data/places has no country/region
// filter param — the only lever is biasing the query text with the country
// and then picking the best of the (still possibly noisy) candidates it
// returns. No city or country is ever hardcoded here: the country comes
// from the live conversation, everything else comes from LiteAPI's own
// response fields.
const placeCache = new Map<string, { at: number; placeId: string | null }>();
const PLACE_CACHE_TTL_MS = 60 * 60 * 1000;

// Diacritic-insensitive fold so "Valencia" matches "València", "Zurich"
// matches "Zürich", etc. — a plain .includes() would silently miss these
// and fall through to the noisier unfiltered candidate pool every time.
const COMBINING_DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(COMBINING_DIACRITICS_RE, "").toLowerCase();
}

// LiteAPI's formattedAddress is inconsistent about country form — full names
// for most countries ("Egypt", "Spain") but common abbreviations for others
// ("UK", "USA"). Deriving an acronym mechanically from a multi-word country
// name (no per-country table) lets "United Kingdom" still match a "UK"
// address without hardcoding that pairing.
function countryAcronym(country: string): string | null {
  const words = country.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? words.map((w) => w[0]).join("") : null;
}

async function resolvePlaceId(cityName: string, country?: string): Promise<string | null> {
  const key = `${cityName.trim().toLowerCase()}|${(country ?? "").trim().toLowerCase()}`;
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < PLACE_CACHE_TTL_MS) return hit.placeId;

  const query = country ? `${cityName}, ${country}` : cityName;
  const res = await laGet("/data/places", { textQuery: query, type: "locality" });
  const places = arr(res.data ?? res.places).map(rec);

  // Prefer candidates whose name actually matches what was asked for —
  // guards against unrelated places the fuzzy text search pulls in
  // alongside a country hint (e.g. an unrelated Spanish village showing up
  // for "Valencia, Spain"). Diacritic-folded so accents don't break the match.
  const cityFold = foldDiacritics(cityName.trim());
  const nameMatches = places.filter((p) => foldDiacritics(str(p.displayName) ?? "").includes(cityFold));
  const pool = nameMatches.length ? nameMatches : places;

  const countryFold = country ? foldDiacritics(country.trim()) : undefined;
  const acronymFold = country ? (countryAcronym(country) ? foldDiacritics(countryAcronym(country)!) : undefined) : undefined;
  const best =
    (countryFold && pool.find((p) => {
      const addr = foldDiacritics(str(p.formattedAddress) ?? "");
      return addr.includes(countryFold) || (acronymFold && addr.includes(acronymFold));
    })) ||
    // No country hint (or no match among name-matches): fall back to a
    // genuine locality rather than trusting an arbitrary first result —
    // defensive re-check even though /data/places is already asked for
    // type=locality.
    pool.find((p) => arr(p.types).includes("locality")) ||
    pool[0];

  const placeId = str(best?.placeId) ?? null;
  if (!placeId) {
    logger.warn(
      { step: "resolvePlaceId", cityName, country, query, placesReturned: places.length, rawKeys: Object.keys(res) },
      "search: place resolution returned no usable placeId",
    );
  }
  placeCache.set(key, { at: Date.now(), placeId });
  return placeId;
}

// Static hotel content rarely changes — cache it per place.
const hotelContentCache = new Map<string, { at: number; hotels: HotelContent[] }>();
const HOTEL_CONTENT_TTL_MS = 60 * 60 * 1000;

async function fetchHotelContent(placeId: string): Promise<HotelContent[]> {
  const hit = hotelContentCache.get(placeId);
  if (hit && Date.now() - hit.at < HOTEL_CONTENT_TTL_MS) return hit.hotels;
  const res = await laGet("/data/hotels", { placeId, limit: HOTEL_CONTENT_LIMIT });
  const hotels = arr(res.data ?? res.hotels).map(rec);
  if (!hotels.length) {
    logger.warn(
      { step: "fetchHotelContent", placeId, rawKeys: Object.keys(res) },
      "search: /data/hotels returned no hotel content for this place",
    );
  }
  hotelContentCache.set(placeId, { at: Date.now(), hotels });
  return hotels;
}

type SearchCategory = "flights" | "hotels" | "all";
async function liveSearch(
  draft: ReturnType<typeof withDates>,
  category: SearchCategory,
): Promise<{ flights: FlightOffer[]; hotels: HotelOffer[]; contexts: Record<string, Rec> }> {
  const now = new Date().toISOString();
  // Per-offer booking context — the hotel offerId here feeds prebook at checkout.
  const contexts: Record<string, Rec> = {};

  const flightsPromise =
    category === "hotels" ? Promise.resolve([] as FlightOffer[]) : searchFlights(draft, contexts, now);

  const hotelsPromise = category === "flights" ? Promise.resolve([] as HotelOffer[]) : (async () => {
    const city = draft.destinationName;
    if (!city) return [];
    const placeId = await resolvePlaceId(city, draft.destinationCountry);
    if (!placeId) return [];
    const content = await fetchHotelContent(placeId);
    if (!content.length) return [];
    const contentById = new Map<string, HotelContent>();
    for (const h of content) {
      const id = str(h.id, h.hotelId);
      if (id) contentById.set(id, h);
    }

    const ratesRes = await laPost("/hotels/rates", {
      hotelIds: [...contentById.keys()],
      checkin: draft.departureDate,
      checkout: draft.returnDate,
      occupancies: [
        {
          adults: draft.adults,
          // LiteAPI wants child ages; the draft only carries a count, so use a
          // mid-range placeholder age.
          ...(draft.children ? { children: Array.from({ length: draft.children }, () => 10) } : {}),
        },
      ],
      currency: draft.currency,
      // Draft has no nationality field; default is configurable per deployment.
      guestNationality: process.env.LITEAPI_GUEST_NATIONALITY ?? "US",
      // Ask LiteAPI to return mapped room metadata and photos for each rate.
      roomMapping: true,
    });
    const rateHotels = arr(ratesRes.data ?? ratesRes.hotels).map(rec);

    const byId = new Map<string, HotelOffer>();
    for (const rateHotel of rateHotels) {
      const hotelId = str(rateHotel.hotelId);
      if (!hotelId) continue;
      const mapped = mapHotel(contentById.get(hotelId) ?? {}, rateHotel, draft.nights, draft.currency, city, now);
      if (!mapped) continue;
      const existing = byId.get(mapped.offer.id);
      if (!existing || mapped.offer.totalPrice < existing.totalPrice) {
        byId.set(mapped.offer.id, mapped.offer);
        contexts[mapped.offer.id] = {
          kind: "hotel",
          offerId: mapped.offerId,
          hotelId,
          checkIn: draft.departureDate,
          checkOut: draft.returnDate,
          adults: draft.adults,
          children: draft.children,
          currency: draft.currency,
        };
      }
    }
    if (!byId.size) {
      logger.warn(
        {
          step: "ratesMapping",
          placeId,
          hotelIdsRequested: contentById.size,
          rateHotelsReturned: rateHotels.length,
          rawKeys: Object.keys(ratesRes),
        },
        "search: /hotels/rates returned data but the mapping filter kept none of it",
      );
    }
    const byPrice = [...byId.values()].sort((a, b) => a.totalPrice - b.totalPrice);
    return withTopRatedGuaranteed(byPrice, HOTEL_MAX_RESULTS);
  })();

  // A failure in one category must not discard live results from the other.
  const [flightsSettled, hotelsSettled] = await Promise.allSettled([flightsPromise, hotelsPromise]);
  if (flightsSettled.status === "rejected") {
    // Only thrown below when hotels also failed (so the route's mock
    // fallback still kicks in) — but always logged, otherwise a flights-only
    // failure here silently degrades to an empty result with zero trace.
    logger.error({ err: flightsSettled.reason }, "search: flight search failed");
  }
  if (flightsSettled.status === "rejected" && hotelsSettled.status === "rejected") {
    throw flightsSettled.reason;
  }
  if (hotelsSettled.status === "rejected") throw hotelsSettled.reason;
  return {
    flights: flightsSettled.status === "fulfilled" ? flightsSettled.value : [],
    hotels: hotelsSettled.value,
    contexts,
  };
}

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------
router.post("/search", searchLimiter, async (req, res) => {
  const parsed = SearchTripsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid search request" });
    return;
  }
  const draft = withDates(parsed.data.draft);
  if (!draft.destinationCode) {
    res.status(400).json({ message: "Missing destination" });
    return;
  }

  if (!liteApiConfigured()) {
    res.json({ flights: [], hotels: [], source: "mock" as const });
    return;
  }

  const category: "flights" | "hotels" | "all" = parsed.data.category ?? "all";
  const cacheKey = [
    draft.origin, draft.destinationCode, draft.destinationName, draft.destinationCountry,
    draft.departureDate, draft.returnDate, draft.oneWay, draft.adults, draft.children, draft.currency, category,
  ].join("|");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    // Refresh the bookable-offer snapshots so checkout can price from them.
    storeOffers(hit.flights, hit.hotels);
    if (hit.contexts) storeOfferContexts(hit.contexts);
    res.json({
      flights: hit.flights.map((f) => ({ ...f, sourceType: "cached" as const })),
      hotels: hit.hotels.map((h) => ({ ...h, sourceType: "cached" as const })),
      source: "cached" as const,
    });
    return;
  }

  try {
    const { flights, hotels, contexts } = await liveSearch(draft, category);
    if (!flights.length && !hotels.length) {
      // Nothing usable came back (or the response shape wasn't recognized) —
      // let the client fall back to demo data instead of an empty screen.
      res.json({ flights: [], hotels: [], source: "mock" as const });
      return;
    }
    cache.set(cacheKey, { at: Date.now(), flights, hotels, contexts });
    // Snapshot offers server-side: bookings are priced from these, never from
    // prices the client sends back.
    storeOffers(flights, hotels);
    storeOfferContexts(contexts);
    res.json({ flights, hotels, source: "live" as const });
  } catch (err) {
    req.log.error({ err }, "search: travel API request failed");
    // Serve stale cache if we have it, otherwise signal demo fallback.
    if (hit) {
      storeOffers(hit.flights, hit.hotels);
      if (hit.contexts) storeOfferContexts(hit.contexts);
      res.json({
        flights: hit.flights.map((f) => ({ ...f, sourceType: "cached" as const })),
        hotels: hit.hotels.map((h) => ({ ...h, sourceType: "cached" as const })),
        source: "cached" as const,
      });
      return;
    }
    res.json({ flights: [], hotels: [], source: "mock" as const });
  }
});

// ---------------------------------------------------------------------------
// GET /api/hotels/:hotelId/detail — lazy, detail-screen-only enrichment:
// real photos, room types, guest reviews. Deliberately not part of
// /search — most search results are never opened, so fetching 150 hotel
// photos and reviews for every one of them up front would be wasteful.
// Best-effort like the rest of this file: content the supplier doesn't have
// yields an empty array, never a 500.
// ---------------------------------------------------------------------------
const HOTEL_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const hotelDetailCache = new Map<string, { at: number; detail: HotelDetail }>();

function mapImageUrls(raw: unknown): string[] {
  return arr(raw)
    .map((p) => {
      const image = rec(p);
      return str(p, image.url, image.imageUrl, image.originalUrl, image.src, image.path);
    })
    .filter((url): url is string => Boolean(url));
}

function mapHotelImages(raw: unknown): HotelDetail["images"] {
  return arr(raw)
    .map((p, index) => {
      const image = rec(p);
      const url = str(p, image.url, image.imageUrl, image.originalUrl, image.src, image.path);
      return url ? { url, ...(str(image.caption) ? { caption: str(image.caption) } : {}), order: num(image.order) ?? index } : null;
    })
    .filter((image): image is NonNullable<typeof image> => image !== null)
    .sort((a, b) => a.order - b.order);
}

function firstPopulatedArray(value: Rec, keys: string[]): unknown[] {
  for (const key of keys) {
    const candidate = arr(value[key]);
    if (candidate.length) return candidate;
  }
  return [];
}

function mapRoomTypes(raw: unknown): HotelDetail["rooms"] {
  return arr(raw)
    .map(rec)
    .map((r) => {
      const id = str(r.id);
      const name = str(r.roomName);
      if (!id || !name) return null;
      const photos = mapImageUrls(r.photos);
      const maxOccupancy = num(r.maxOccupancy);
      return {
        id,
        name,
         ...(cleanSupplierText(r.description) ? { description: cleanSupplierText(r.description) } : {}),
        photos,
        ...(maxOccupancy ? { maxOccupancy } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

function mapFacilities(raw: unknown): string[] {
  return arr(raw)
    .map((facility) => {
      if (typeof facility === "string") return facility.trim();
      const value = rec(facility);
      return str(value.name, value.facilityName);
    })
    .filter((facility): facility is string => Boolean(facility));
}

function mapCancellation(hotelData: Rec): HotelDetail["cancellation"] | undefined {
  const policies = rec(hotelData.cancellationPolicies);
  const info = rec(arr(policies.cancelPolicyInfos)[0]);
  const refundableTag = str(hotelData.refundableTag, policies.refundableTag)?.toUpperCase();
  const refundable = refundableTag === "RFN";
  const deadline = str(info.cancelTime, info.deadline);
  const amountData = rec(info.amount);
  const amount = num(info.amount, info.amountAfterCancel, amountData.amount, amountData.value);
  const currency = str(info.currency, amountData.currency, hotelData.currency);

  if (!refundable && !deadline && amount === undefined) return undefined;
  return {
    refundable,
    ...(deadline ? { deadline } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(currency ? { currency } : {}),
  };
}

function mapSentiment(raw: unknown): HotelDetail["sentiment"] {
  const s = rec(raw);
  const categories = arr(s.categories)
    .map(rec)
    .map((c) => {
      const name = str(c.name);
      const rating = num(c.rating);
      const description = str(c.description);
      return name && rating !== undefined && description ? { name, rating, description } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (!categories.length) return undefined;
  return {
    categories,
    pros: arr(s.pros).map((p) => str(p)).filter((p): p is string => Boolean(p)),
    cons: arr(s.cons).map((p) => str(p)).filter((p): p is string => Boolean(p)),
  };
}

// Many reviews come back with every free-text field blank (confirmed live) —
// only worth showing ones that actually say something.
function mapReviews(raw: unknown): HotelDetail["reviews"] {
  return arr(raw)
    .map(rec)
    .map((r) => {
      const name = str(r.name);
      const country = str(r.country);
      const averageScore = num(r.averageScore);
      const date = str(r.date);
      if (!name || !country || averageScore === undefined || !date) return null;
      const headline = str(r.headline);
      const pros = str(r.pros);
      const cons = str(r.cons);
      if (!headline && !pros && !cons) return null; // nothing worth reading
      return {
        name,
        country,
        averageScore,
        date,
        ...(headline ? { headline } : {}),
        ...(pros ? { pros } : {}),
        ...(cons ? { cons } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 6);
}

router.get("/hotels/:hotelId/detail", async (req, res) => {
  // Search offers are intentionally namespaced for the client (`la_ht_...`),
  // while LiteAPI detail and review endpoints require the raw supplier ID.
  const hotelId = req.params.hotelId.replace(/^la_ht_/, "");
  const hit = hotelDetailCache.get(hotelId);
  if (hit && Date.now() - hit.at < HOTEL_DETAIL_CACHE_TTL_MS) {
    res.json(hit.detail);
    return;
  }

  const empty: HotelDetail = { images: [], rooms: [], reviews: [] };
  if (!liteApiConfigured()) {
    res.json(empty);
    return;
  }

  const [hotelSettled, reviewsSettled] = await Promise.allSettled([
    getHotelDetails(hotelId),
    laGet("/data/reviews", { hotelId, limit: 20 }),
  ]);

  if (hotelSettled.status === "rejected") {
    req.log.warn({ err: hotelSettled.reason, hotelId }, "hotel detail: /data/hotel failed");
  }
  if (reviewsSettled.status === "rejected") {
    req.log.warn({ err: reviewsSettled.reason, hotelId }, "hotel detail: /data/reviews failed");
  }

  const hotelData = hotelSettled.status === "fulfilled" ? rec(rec(hotelSettled.value).data ?? hotelSettled.value) : {};
  const reviewsData = reviewsSettled.status === "fulfilled" ? rec(reviewsSettled.value) : {};

  const location = rec(hotelData.location);
  const checkinCheckoutTimes = rec(hotelData.checkinCheckoutTimes);
  const sentiment = mapSentiment(hotelData.sentiment_analysis);
  const cancellation = mapCancellation(hotelData);
  const detailImageSources = [
    ...(str(hotelData.main_photo, hotelData.mainPhoto) ? [str(hotelData.main_photo, hotelData.mainPhoto)!] : []),
    ...firstPopulatedArray(hotelData, ["hotelImages", "images", "photos"]),
  ];
  const importantInformation = [
    cleanSupplierText(hotelData.hotelImportantInformation),
    ...arr(hotelData.hotelImportantInformation).map((item) => cleanSupplierText(item)).filter((item): item is string => Boolean(item)),
  ].filter((item, index, values) => Boolean(item) && values.indexOf(item) === index).join("\n");
  const detail: HotelDetail = {
    ...(str(hotelData.hotelName, hotelData.name) ? { name: str(hotelData.hotelName, hotelData.name) } : {}),
    ...(cleanSupplierText(hotelData.hotelDescription, hotelData.description) ? { description: cleanSupplierText(hotelData.hotelDescription, hotelData.description) } : {}),
    ...(str(hotelData.address, hotelData.hotelAddress) ? { address: str(hotelData.address, hotelData.hotelAddress) } : {}),
    ...(str(hotelData.city, location.city) ? { city: str(hotelData.city, location.city) } : {}),
    ...(str(hotelData.country, location.country) ? { country: str(hotelData.country, location.country) } : {}),
    ...(num(location.latitude, hotelData.latitude) !== undefined ? { latitude: num(location.latitude, hotelData.latitude) } : {}),
    ...(num(location.longitude, hotelData.longitude) !== undefined ? { longitude: num(location.longitude, hotelData.longitude) } : {}),
    ...(num(hotelData.starRating, hotelData.stars) !== undefined ? { starRating: num(hotelData.starRating, hotelData.stars) } : {}),
    ...(num(hotelData.rating, hotelData.guestRating) !== undefined ? { rating: num(hotelData.rating, hotelData.guestRating) } : {}),
    ...(num(hotelData.reviewCount, hotelData.reviewsCount) !== undefined ? { reviewCount: num(hotelData.reviewCount, hotelData.reviewsCount) } : {}),
    ...(str(checkinCheckoutTimes.checkin) ? { checkinTime: str(checkinCheckoutTimes.checkin) } : {}),
    ...(str(checkinCheckoutTimes.checkout) ? { checkoutTime: str(checkinCheckoutTimes.checkout) } : {}),
    ...(importantInformation ? { importantInformation } : {}),
    ...(mapFacilities(hotelData.facilities ?? hotelData.hotelFacilities).length
      ? { facilities: mapFacilities(hotelData.facilities ?? hotelData.hotelFacilities) }
      : {}),
    ...(cancellation ? { cancellation } : {}),
    images: mapHotelImages(detailImageSources),
    rooms: mapRoomTypes(firstPopulatedArray(hotelData, ["rooms", "roomTypes"])),
    reviews: mapReviews(firstPopulatedArray(reviewsData, ["data", "reviews", "items"])),
    ...(sentiment ? { sentiment } : {}),
  };
  hotelDetailCache.set(hotelId, { at: Date.now(), detail });
  res.json(detail);
});

export default router;
