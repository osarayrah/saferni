import { legStops } from '@/services/planner';
import type { FlightFilters } from '@/store/AppContext';
import type { FlightOffer } from '@/types/travel';

export type StopsFilter = FlightFilters['stops'];
export type DepartureWindow = NonNullable<FlightFilters['departure']>;

export const DEPARTURE_WINDOWS: { key: DepartureWindow; label: string; from: number; to: number }[] = [
  { key: 'morning', label: 'Morning (5–12)', from: 5, to: 12 },
  { key: 'afternoon', label: 'Afternoon (12–18)', from: 12, to: 18 },
  { key: 'evening', label: 'Evening (18–24)', from: 18, to: 24 },
  { key: 'night', label: 'Night (0–5)', from: 0, to: 5 },
];

/** Local departure hour taken from the ISO string itself (no timezone shifting). */
export function departureHour(iso: string): number | null {
  const m = /T(\d{2}):/.exec(iso);
  return m ? Number(m[1]) : null;
}

// f.totalStops is outbound + inbound summed into one number — not usable
// per-direction (a 1-stop-each-way round trip sums to 2). Derive each
// direction's own stop count from its segments instead, so "Nonstop" and
// "1 stop max" mean "in every direction", not "combined across both".
export const matchesStops = (f: FlightOffer, s: StopsFilter) => {
  if (s === 'any') return true;
  const out = legStops(f.outbound);
  const back = f.inbound ? legStops(f.inbound) : 0;
  return s === 'nonstop' ? out === 0 && back === 0 : Math.max(out, back) <= 1;
};

export const matchesAirline = (f: FlightOffer, a: string | null) =>
  a === null || f.outbound.segments[0]?.airlineCode === a;

export const matchesDeparture = (f: FlightOffer, d: DepartureWindow | null) => {
  if (!d) return true;
  const w = DEPARTURE_WINDOWS.find((x) => x.key === d)!;
  const h = departureHour(f.outbound.segments[0]?.departureTime ?? '');
  return h !== null && h >= w.from && h < w.to;
};

export const matchesRefundable = (f: FlightOffer, r: boolean) => !r || f.refundable;

export const matchesAllFilters = (f: FlightOffer, filters: FlightFilters) =>
  matchesStops(f, filters.stops) &&
  matchesAirline(f, filters.airline) &&
  matchesDeparture(f, filters.departure) &&
  matchesRefundable(f, filters.refundableOnly);

/** True when the filter set is the default (nothing selected). */
export const isDefaultFilters = (filters: FlightFilters) =>
  filters.stops === 'any' && filters.airline === null && filters.departure === null && !filters.refundableOnly;

/**
 * Whether a result set is ready to be evaluated against saved filters.
 * Requires: preference storage hydrated, a terminal successful flight fetch,
 * at least one flight to judge against, and not already evaluated for this draft.
 * Error/timeout/loading states and empty result sets must NOT consume the
 * evaluation — a retry may still deliver flights for the same draft.
 */
export function shouldEvaluateFilters(args: {
  hydrated: boolean;
  status: 'loading' | 'done' | 'error' | 'timeout';
  flightCount: number;
  alreadyEvaluated: boolean;
}): boolean {
  return args.hydrated && args.status === 'done' && args.flightCount > 0 && !args.alreadyEvaluated;
}

/**
 * Decide what to do with saved filters when a new flight result set arrives:
 * re-apply them when at least one flight still matches, otherwise reset.
 */
export function decideFilterReapplication(
  flights: FlightOffer[],
  saved: FlightFilters | null,
): { action: 'none' } | { action: 'apply'; filters: FlightFilters } | { action: 'reset' } {
  if (!saved || isDefaultFilters(saved) || flights.length === 0) return { action: 'none' };
  return flights.some((f) => matchesAllFilters(f, saved)) ? { action: 'apply', filters: saved } : { action: 'reset' };
}
