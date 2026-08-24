import { DESTINATIONS, uid } from '@/services/mockData';
import type {
  ActivityItem,
  FlightItinerary,
  FlightOffer,
  HotelOffer,
  ItineraryDay,
  ItineraryItem,
  Trip,
  TripDraft,
  TripPackage,
} from '@/types/travel';

// ---------- Draft helpers ----------

export function emptyDraft(origin: string, currency: string, styles: string[]): TripDraft {
  return { origin, adults: 2, children: 0, currency, styles };
}

export function ensureDates(draft: TripDraft): TripDraft {
  if (draft.departureDate && draft.returnDate) return draft;
  const nights = draft.nights ?? 5;
  const dep = new Date();
  dep.setDate(dep.getDate() + 21);
  const ret = new Date(dep);
  ret.setDate(ret.getDate() + nights);
  return {
    ...draft,
    nights,
    departureDate: draft.departureDate ?? dep.toISOString().slice(0, 10),
    returnDate: draft.returnDate ?? ret.toISOString().slice(0, 10),
  };
}

export function summaryText(draft: TripDraft): string {
  const d = ensureDates(draft);
  const lines = [
    `${d.origin} → ${d.destinationName} (${d.destinationCode})`,
    `${formatDate(d.departureDate!)} – ${formatDate(d.returnDate!)} · ${d.nights} nights`,
    `${d.adults} adult${d.adults > 1 ? 's' : ''}${d.children ? ` · ${d.children} children` : ''}`,
    d.budget ? `Budget: ${d.currency} ${d.budget.toLocaleString()}` : 'Budget: flexible',
  ];
  if (d.styles.length) lines.push(`Style: ${d.styles.slice(0, 4).join(', ')}`);
  return lines.join('\n');
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------- Flight stops ----------
// FlightOffer.totalStops is outbound + inbound stops SUMMED into one number
// (see the server mapping in routes/search.ts) — it's only meaningful as a
// whole-itinerary "has any layovers at all" signal. Anything that needs a
// per-direction stop count (card display, the stops filter) must derive it
// from the segments themselves instead.

/** Stops within a single direction, derived from its segment count. */
export function legStops(itin: FlightItinerary): number {
  return Math.max(0, itin.segments.length - 1);
}

/** Human label for a single direction's stop count: "Direct", "1 stop", "2 stops". */
export function stopsLabel(stops: number): string {
  return stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`;
}

/**
 * Per-direction stops summary for a flight card: "Direct"/"N stops" for a
 * one-way; "Direct"/"N stops each way" when a round trip's two directions
 * match; "X out, Y back" when they differ.
 */
export function stopsSummary(flight: FlightOffer): string {
  const out = legStops(flight.outbound);
  if (!flight.inbound) return stopsLabel(out);
  const back = legStops(flight.inbound);
  if (out === back) return out === 0 ? 'Direct' : `${stopsLabel(out)} each way`;
  return `${stopsLabel(out)} out, ${stopsLabel(back)} back`;
}

/** Per-category progress while a live search streams in. */
export type SearchCategoryStatus = 'loading' | 'done' | 'timeout' | 'error';

/**
 * Which category a Plan chat/search is scoped to. "flights"/"hotels" search
 * only that one category and never assemble a package; "packages" (the
 * default full trip planner) and "general" behave identically.
 */
export type SearchMode = 'flights' | 'hotels' | 'packages' | 'general';

export type SearchResults = {
  draft: TripDraft;
  flights: FlightOffer[];
  hotels: HotelOffer[];
  activities: ActivityItem[];
  packages: TripPackage[];
  /** Absent for instant demo searches; present while a live search is streaming. */
  flightsStatus?: SearchCategoryStatus;
  hotelsStatus?: SearchCategoryStatus;
  mode?: SearchMode;
};

function makePackage(
  draft: TripDraft,
  type: TripPackage['recommendationType'],
  title: string,
  flight: FlightOffer,
  hotel: HotelOffer,
  advantages: string[],
  disadvantages: string[],
): TripPackage {
  // Live prices only: the package total is exactly what the providers charge —
  // no fabricated activity/food/transport estimates are added.
  const total = flight.totalPrice + hotel.totalPrice + (hotel.taxesAndFees ?? 0);
  const travellers = draft.adults + draft.children;
  const budget = draft.budget ?? 0;
  const warnings: TripPackage['warnings'] = [];
  if (flight.baggage.unknown) warnings.push({ code: 'baggage', message: 'Checked baggage info unavailable for this fare.' });
  if (!flight.refundable) warnings.push({ code: 'refund', message: 'Flight fare is non-refundable.' });
  if (budget && total > budget) warnings.push({ code: 'budget', message: `Estimated total exceeds your budget by ${draft.currency} ${(total - budget).toLocaleString()}.` });
  return {
    id: uid('pkg'),
    title,
    recommendationType: type,
    flight,
    hotel,
    estimatedActivitiesTotal: 0,
    estimatedFoodTotal: 0,
    estimatedLocalTransportTotal: 0,
    totalPrice: total,
    currency: draft.currency,
    pricePerTraveller: Math.round(total / travellers),
    budgetDifference: budget ? budget - total : 0,
    score: 0,
    advantages,
    disadvantages,
    warnings,
  };
}

export function buildPackages(draft: TripDraft, flights: FlightOffer[], hotels: HotelOffer[]): TripPackage[] {
  // Packages need both a flight and a hotel; with live-only data one category can be empty.
  if (flights.length === 0 || hotels.length === 0) return [];
  const cheapFlight = flights[0];
  const directEco = flights.find((f) => f.totalStops === 0 && f.cabinClass === 'economy') ?? flights[0];
  const comfyFlight = flights.find((f) => f.cabinClass === 'business') ?? directEco;
  const cheapHotel = hotels[0];
  const midHotel = hotels.find((h) => h.starRating === 4) ?? hotels[Math.min(1, hotels.length - 1)];
  const luxHotel = hotels.find((h) => h.starRating === 5) ?? hotels[hotels.length - 1];

  return [
    makePackage(draft, 'best_overall', 'Best overall', directEco, midHotel,
      ['Direct flights', '4-star hotel with strong guest rating', 'Balanced comfort and price'],
      ['Not the absolute lowest price']),
    makePackage(draft, 'lowest_price', 'Lowest price', cheapFlight, cheapHotel,
      ['Lowest total cost', 'Most budget left for activities'],
      cheapFlight.totalStops > 0 ? ['Includes connections', 'Simpler hotel'] : ['Simpler hotel']),
    makePackage(draft, 'most_comfortable', 'Most comfortable', comfyFlight, luxHotel,
      ['Premium cabin where available', '5-star resort with breakfast', 'Flexible cancellation'],
      ['Highest total price']),
  ];
}

// ---------- Itinerary ----------

export function buildItinerary(draft: TripDraft, pkg: TripPackage, activities: ActivityItem[]): ItineraryDay[] {
  const d = ensureDates(draft);
  const nights = d.nights ?? 5;
  const days: ItineraryDay[] = [];
  const dest = DESTINATIONS.find((x) => x.code === d.destinationCode) ?? DESTINATIONS[0];
  let actIdx = 0;
  const pick = (): ActivityItem => activities[actIdx++ % activities.length];

  for (let i = 0; i <= nights; i++) {
    const date = new Date(d.departureDate + 'T12:00:00');
    date.setDate(date.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    const items: ItineraryItem[] = [];
    let title = `Exploring ${dest.city}`;
    let summary = 'A balanced day of sights, food and downtime.';

    if (i === 0) {
      title = `Arrival in ${dest.city}`;
      summary = 'Land, check in and ease into the trip — nothing rushed today.';
      items.push({
        id: uid('it'), title: `Flight ${d.origin} → ${d.destinationCode}`,
        description: `${pkg.flight.validatingAirline} · arrive and transfer to the hotel.`,
        category: 'flight', timeOfDay: 'morning', locationName: `${dest.city} Airport`,
        latitude: dest.latitude, longitude: dest.longitude, estimatedCost: 0,
        transportationMethod: 'Airport transfer', travelTimeMinutes: 40,
      });
      items.push({
        id: uid('it'), title: `Check in — ${pkg.hotel.name}`,
        description: 'Check-in from 15:00. Drop bags earlier if you arrive before.',
        category: 'hotel', timeOfDay: 'afternoon', locationName: pkg.hotel.address,
        latitude: pkg.hotel.latitude, longitude: pkg.hotel.longitude, estimatedCost: 0,
      });
      items.push({
        id: uid('it'), title: 'Easy neighbourhood dinner',
        description: 'Somewhere within walking distance of the hotel to recover from travel.',
        category: 'food', timeOfDay: 'evening', locationName: `${dest.city} centre`,
        latitude: dest.latitude, longitude: dest.longitude, estimatedCost: 0,
        transportationMethod: 'Walk', travelTimeMinutes: 10,
      });
    } else if (i === nights) {
      title = 'Departure day';
      summary = 'Checkout, one last stroll and the flight home.';
      items.push({
        id: uid('it'), title: `Checkout — ${pkg.hotel.name}`,
        description: 'Checkout by 11:00. Luggage storage available at reception.',
        category: 'hotel', timeOfDay: 'morning', locationName: pkg.hotel.address,
        latitude: pkg.hotel.latitude, longitude: pkg.hotel.longitude, estimatedCost: 0,
      });
      items.push({
        id: uid('it'), title: `Flight ${d.destinationCode} → ${d.origin}`,
        description: 'Head to the airport 2.5 hours before departure.',
        category: 'flight', timeOfDay: 'afternoon', locationName: `${dest.city} Airport`,
        latitude: dest.latitude, longitude: dest.longitude, estimatedCost: 0,
        transportationMethod: 'Airport transfer', travelTimeMinutes: 40,
      });
    } else if (activities.length === 0) {
      // Live data only — no demo activity listings, so middle days stay open
      // for the traveler to plan (no fabricated activity prices).
      title = `Day ${i + 1} in ${dest.city}`;
      summary = 'Open day — plan it your way once you arrive.';
      items.push({
        id: uid('it'), title: `Explore ${dest.city}`,
        description: 'This day is yours to plan — no pre-set schedule.',
        category: 'activity', timeOfDay: 'morning', locationName: `${dest.city} centre`,
        latitude: dest.latitude, longitude: dest.longitude, estimatedCost: 0,
      });
    } else {
      const a1 = pick();
      const a2 = pick();
      title = `${a1.category} day in ${dest.city}`;
      summary = `${a1.title} plus ${a2.title.toLowerCase()}, with time to wander in between.`;
      items.push({
        id: uid('it'), title: a1.title, description: a1.description,
        category: 'activity', timeOfDay: 'morning', locationName: a1.locationName,
        latitude: a1.latitude, longitude: a1.longitude,
        estimatedCost: a1.estimatedCost * (d.adults + d.children),
        transportationMethod: 'Walk / taxi', travelTimeMinutes: 20,
        reservationRequired: a1.reservationRequired,
      });
      items.push({
        id: uid('it'), title: 'Lunch near ' + a1.locationName.split('—')[0].trim(),
        description: 'Local spot — ask your morning guide for a recommendation.',
        category: 'food', timeOfDay: 'afternoon', locationName: `${dest.city} centre`,
        latitude: dest.latitude, longitude: dest.longitude,
        estimatedCost: 0, transportationMethod: 'Walk', travelTimeMinutes: 10,
      });
      items.push({
        id: uid('it'), title: a2.title, description: a2.description,
        category: 'activity', timeOfDay: i % 2 === 0 ? 'afternoon' : 'evening',
        locationName: a2.locationName, latitude: a2.latitude, longitude: a2.longitude,
        estimatedCost: a2.estimatedCost * (d.adults + d.children),
        transportationMethod: 'Taxi', travelTimeMinutes: 15,
        reservationRequired: a2.reservationRequired,
      });
    }
    days.push({
      id: uid('day'),
      dayNumber: i + 1,
      date: iso,
      title,
      summary,
      estimatedCost: items.reduce((s, it) => s + it.estimatedCost, 0),
      items,
    });
  }
  return days;
}

export function regenerateDay(draft: TripDraft, pkg: TripPackage, day: ItineraryDay): ItineraryDay {
  // Live data only — the itinerary is rebuilt without demo activity listings.
  const all = buildItinerary(draft, pkg, []);
  const replacement = all.find((x) => x.dayNumber === day.dayNumber);
  return replacement ? { ...replacement, id: day.id } : day;
}

// ---------- Trip assembly ----------

export function assembleTrip(draft: TripDraft, pkg: TripPackage, activities: ActivityItem[], coverImage: string): Trip {
  const d = ensureDates(draft);
  const dest = DESTINATIONS.find((x) => x.code === d.destinationCode) ?? DESTINATIONS[0];
  const now = new Date().toISOString();
  return {
    id: uid('trip'),
    title: `${dest.city} · ${d.nights} nights`,
    origin: d.origin,
    destinationCode: dest.code,
    destinationName: dest.city,
    country: dest.country,
    departureDate: d.departureDate!,
    returnDate: d.returnDate!,
    // Derived from the actual booked flight offer, not the draft — the
    // offer's inbound leg is the single source of truth for whether this
    // is really a round trip. returnDate above is a stay-end date (needed
    // for hotel nights/itinerary regardless of flight one-way-ness), not
    // proof of a return flight.
    oneWay: !pkg.flight.inbound,
    adults: d.adults,
    children: d.children,
    status: 'planned',
    currency: d.currency,
    budget: d.budget ?? 0,
    estimatedTotal: pkg.totalPrice,
    coverImage: dest.image,
    flight: pkg.flight,
    hotel: pkg.hotel,
    days: buildItinerary(d, pkg, activities),
    // The trip is assembled from the live offers the traveler selected.
    sourceType: pkg.flight.sourceType,
    createdAt: now,
    updatedAt: now,
  };
}

export type BudgetLine = { label: string; amount: number; kind: 'confirmed' | 'estimated' };

export function budgetLines(trip: Trip): BudgetLine[] {
  // Live prices only: the budget shows what the providers actually charge.
  // Day-to-day spending (food, activities, transport) varies too much to
  // fabricate, so it is left to the traveler.
  return [
    { label: 'Flights', amount: trip.flight.totalPrice, kind: 'confirmed' },
    { label: 'Hotel', amount: trip.hotel.totalPrice + (trip.hotel.taxesAndFees ?? 0), kind: 'confirmed' },
  ];
}

export const OVER_BUDGET_TIPS = [
  'Shift travel dates by a few days',
  'Choose a lower hotel category',
  'Select a one-stop flight',
  'Swap paid activities for free ones',
  'Reduce the trip by one night',
  'Travel mid-week instead of weekends',
];
