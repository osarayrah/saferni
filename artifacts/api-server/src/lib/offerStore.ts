import { SearchTripsResponse } from "@workspace/api-zod";

type SearchResult = ReturnType<typeof SearchTripsResponse.parse>;
export type StoredFlightOffer = SearchResult["flights"][number];
export type StoredHotelOffer = SearchResult["hotels"][number];

/**
 * Server-side store of search offers, keyed by offer id.
 *
 * Bookings are priced ONLY from offers recorded here — never from prices or
 * offer details sent by the client — so a tampered request can't change what
 * the traveler is charged. Offers live slightly longer than the search cache
 * so a traveler who browses for a while can still check out.
 */
const OFFER_TTL_MS = 30 * 60 * 1000;

type Entry<T> = { at: number; offer: T };
const flightOffers = new Map<string, Entry<StoredFlightOffer>>();
const hotelOffers = new Map<string, Entry<StoredHotelOffer>>();

/**
 * Provider booking context captured at search time — for LiteAPI hotels this
 * carries the rate `offerId` (plus stay parameters) that prebook needs at
 * checkout, beyond the mapped offer itself.
 */
export type OfferContext = Record<string, unknown>;
const offerContexts = new Map<string, Entry<OfferContext>>();

function sweep(): void {
  const cutoff = Date.now() - OFFER_TTL_MS;
  for (const [id, e] of flightOffers) if (e.at < cutoff) flightOffers.delete(id);
  for (const [id, e] of hotelOffers) if (e.at < cutoff) hotelOffers.delete(id);
  for (const [id, e] of offerContexts) if (e.at < cutoff) offerContexts.delete(id);
}

export function storeOfferContexts(contexts: Record<string, OfferContext>): void {
  const at = Date.now();
  for (const [id, ctx] of Object.entries(contexts)) offerContexts.set(id, { at, offer: ctx });
}

export function getOfferContext(id: string): OfferContext | undefined {
  return fresh(offerContexts.get(id));
}

export function storeOffers(flights: readonly StoredFlightOffer[], hotels: readonly StoredHotelOffer[]): void {
  sweep();
  const at = Date.now();
  for (const f of flights) flightOffers.set(f.id, { at, offer: f });
  for (const h of hotels) hotelOffers.set(h.id, { at, offer: h });
}

function fresh<T>(entry: Entry<T> | undefined): T | undefined {
  if (!entry || Date.now() - entry.at > OFFER_TTL_MS) return undefined;
  return entry.offer;
}

export function getStoredFlightOffer(id: string): StoredFlightOffer | undefined {
  return fresh(flightOffers.get(id));
}

export function getStoredHotelOffer(id: string): StoredHotelOffer | undefined {
  return fresh(hotelOffers.get(id));
}

/** Reset the store — only for use in tests. */
export function _clearOffersForTesting(): void {
  flightOffers.clear();
  hotelOffers.clear();
  offerContexts.clear();
}
