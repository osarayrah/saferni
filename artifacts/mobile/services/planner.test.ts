import { describe, expect, it } from 'vitest';
import { legStops, stopsLabel, stopsSummary } from './planner';
import type { FlightItinerary, FlightOffer } from '@/types/travel';

function itin(stops: number): FlightItinerary {
  return { segments: Array.from({ length: stops + 1 }, () => ({})) } as unknown as FlightItinerary;
}

function oneWay(stops: number): FlightOffer {
  return { outbound: itin(stops) } as unknown as FlightOffer;
}

function roundTrip(outStops: number, backStops: number): FlightOffer {
  return { outbound: itin(outStops), inbound: itin(backStops) } as unknown as FlightOffer;
}

describe('legStops', () => {
  it('derives stops from segment count, never negative', () => {
    expect(legStops(itin(0))).toBe(0);
    expect(legStops(itin(2))).toBe(2);
  });
});

describe('stopsLabel', () => {
  it('labels 0 as Direct and pluralizes stop(s)', () => {
    expect(stopsLabel(0)).toBe('Direct');
    expect(stopsLabel(1)).toBe('1 stop');
    expect(stopsLabel(2)).toBe('2 stops');
  });
});

describe('stopsSummary', () => {
  it('shows a one-way flight by its single direction', () => {
    expect(stopsSummary(oneWay(0))).toBe('Direct');
    expect(stopsSummary(oneWay(2))).toBe('2 stops');
  });

  it('collapses a round trip with matching stops in both directions', () => {
    expect(stopsSummary(roundTrip(0, 0))).toBe('Direct');
    expect(stopsSummary(roundTrip(1, 1))).toBe('1 stop each way');
    expect(stopsSummary(roundTrip(2, 2))).toBe('2 stops each way');
  });

  it('breaks out a round trip whose directions differ, never summing them', () => {
    expect(stopsSummary(roundTrip(1, 2))).toBe('1 stop out, 2 stops back');
    expect(stopsSummary(roundTrip(0, 1))).toBe('Direct out, 1 stop back');
  });
});
