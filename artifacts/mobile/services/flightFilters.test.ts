import { describe, expect, it } from 'vitest';
import { decideFilterReapplication, isDefaultFilters, matchesAllFilters, matchesStops, shouldEvaluateFilters } from './flightFilters';
import type { FlightFilters } from '@/store/AppContext';
import type { FlightOffer } from '@/types/travel';

function makeLeg(stops: number, airline: string, departureTime: string) {
  return {
    segments: Array.from({ length: stops + 1 }, () => ({ airlineCode: airline, departureTime })),
  };
}

/** `stops` is the outbound leg's stop count. Pass `returnStops` to build a round trip. */
function flight(overrides: {
  stops?: number;
  returnStops?: number;
  airline?: string;
  departureTime?: string;
  refundable?: boolean;
}): FlightOffer {
  const airline = overrides.airline ?? 'TA';
  const outboundStops = overrides.stops ?? 0;
  return {
    id: 'f1',
    validatingAirline: 'Test Air',
    // Server-side totalStops is outbound + inbound summed — kept consistent
    // with the mocked legs, but matchesStops must not read this field.
    totalStops: outboundStops + (overrides.returnStops ?? 0),
    totalPrice: 100,
    totalDurationMinutes: 300,
    currency: 'USD',
    refundable: overrides.refundable ?? false,
    outbound: makeLeg(outboundStops, airline, overrides.departureTime ?? '2026-08-10T09:00:00'),
    ...(overrides.returnStops !== undefined
      ? { inbound: makeLeg(overrides.returnStops, airline, '2026-08-15T09:00:00') }
      : {}),
  } as unknown as FlightOffer;
}

const DEFAULTS: FlightFilters = { stops: 'any', airline: null, departure: null, refundableOnly: false };

describe('matchesStops (per-direction, not the summed round-trip total)', () => {
  it('"1 stop max" passes a round trip with 1 stop in each direction (summed total would be 2)', () => {
    expect(matchesStops(flight({ stops: 1, returnStops: 1 }), 'max1')).toBe(true);
  });

  it('"1 stop max" fails when either direction alone exceeds 1 stop', () => {
    expect(matchesStops(flight({ stops: 0, returnStops: 2 }), 'max1')).toBe(false);
    expect(matchesStops(flight({ stops: 2, returnStops: 0 }), 'max1')).toBe(false);
  });

  it('"nonstop" requires both directions to be direct', () => {
    expect(matchesStops(flight({ stops: 0, returnStops: 0 }), 'nonstop')).toBe(true);
    expect(matchesStops(flight({ stops: 0, returnStops: 1 }), 'nonstop')).toBe(false);
  });

  it('a one-way flight (no inbound) is judged on its single direction only', () => {
    expect(matchesStops(flight({ stops: 1 }), 'max1')).toBe(true);
    expect(matchesStops(flight({ stops: 2 }), 'max1')).toBe(false);
  });

  it('"any" always matches regardless of stops', () => {
    expect(matchesStops(flight({ stops: 3, returnStops: 3 }), 'any')).toBe(true);
  });
});

describe('matchesAllFilters', () => {
  it('matches everything with default filters', () => {
    expect(matchesAllFilters(flight({ stops: 2 }), DEFAULTS)).toBe(true);
  });

  it('applies stops, airline, departure window and refundable together', () => {
    const f = flight({ stops: 0, airline: 'RJ', departureTime: '2026-08-10T08:30:00', refundable: true });
    const filters: FlightFilters = { stops: 'nonstop', airline: 'RJ', departure: 'morning', refundableOnly: true };
    expect(matchesAllFilters(f, filters)).toBe(true);
    expect(matchesAllFilters(flight({ stops: 1, airline: 'RJ', departureTime: '2026-08-10T08:30:00', refundable: true }), filters)).toBe(false);
    expect(matchesAllFilters(flight({ stops: 0, airline: 'XX', departureTime: '2026-08-10T08:30:00', refundable: true }), filters)).toBe(false);
    expect(matchesAllFilters(flight({ stops: 0, airline: 'RJ', departureTime: '2026-08-10T20:00:00', refundable: true }), filters)).toBe(false);
    expect(matchesAllFilters(flight({ stops: 0, airline: 'RJ', departureTime: '2026-08-10T08:30:00', refundable: false }), filters)).toBe(false);
  });
});

describe('decideFilterReapplication', () => {
  it('does nothing without saved filters or with default saved filters', () => {
    expect(decideFilterReapplication([flight({})], null)).toEqual({ action: 'none' });
    expect(decideFilterReapplication([flight({})], DEFAULTS)).toEqual({ action: 'none' });
  });

  it('does nothing when the result set is empty (nothing to judge against)', () => {
    expect(decideFilterReapplication([], { ...DEFAULTS, stops: 'nonstop' })).toEqual({ action: 'none' });
  });

  it('re-applies saved filters when at least one flight still matches', () => {
    const saved: FlightFilters = { ...DEFAULTS, stops: 'nonstop', refundableOnly: true };
    const flights = [flight({ stops: 2 }), flight({ stops: 0, refundable: true })];
    expect(decideFilterReapplication(flights, saved)).toEqual({ action: 'apply', filters: saved });
  });

  it('resets when saved filters would exclude every flight', () => {
    const saved: FlightFilters = { ...DEFAULTS, airline: 'ZZ' };
    const flights = [flight({ airline: 'RJ' }), flight({ airline: 'TA' })];
    expect(decideFilterReapplication(flights, saved)).toEqual({ action: 'reset' });
  });
});

describe('shouldEvaluateFilters (hydration & retry timing)', () => {
  const base = { hydrated: true, status: 'done' as const, flightCount: 3, alreadyEvaluated: false };

  it('evaluates only once storage is hydrated — delayed AsyncStorage load must not consume the draft', () => {
    // Flights finish before saved preferences load: do NOT evaluate (or mark) yet…
    expect(shouldEvaluateFilters({ ...base, hydrated: false })).toBe(false);
    // …then hydration completes and the same draft is still eligible.
    expect(shouldEvaluateFilters(base)).toBe(true);
  });

  it('error/timeout/loading and empty results do not consume the evaluation — a retry can still apply filters', () => {
    expect(shouldEvaluateFilters({ ...base, status: 'error' })).toBe(false);
    expect(shouldEvaluateFilters({ ...base, status: 'timeout' })).toBe(false);
    expect(shouldEvaluateFilters({ ...base, status: 'loading' })).toBe(false);
    expect(shouldEvaluateFilters({ ...base, flightCount: 0 })).toBe(false);
    // Retry succeeds later for the same draft: still eligible.
    expect(shouldEvaluateFilters(base)).toBe(true);
  });

  it('evaluates a draft at most once', () => {
    expect(shouldEvaluateFilters({ ...base, alreadyEvaluated: true })).toBe(false);
  });
});

describe('isDefaultFilters', () => {
  it('detects defaults vs any active filter', () => {
    expect(isDefaultFilters(DEFAULTS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULTS, refundableOnly: true })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULTS, departure: 'night' })).toBe(false);
  });
});
