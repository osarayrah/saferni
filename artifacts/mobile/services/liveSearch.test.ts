import { describe, expect, it, vi } from 'vitest';
import { createSearchRunner, searchCategory, type CategoryOutcome } from './liveSearch';
import type { TripDraft } from '@/types/travel';

const DRAFT: TripDraft = {
  origin: 'AMM',
  destinationCode: 'CDG',
  destinationName: 'Paris',
  adults: 2,
  children: 0,
  currency: 'USD',
  styles: [],
};

const LIVE = { source: 'live', flights: [{ id: 'f1' }], hotels: [{ id: 'h1' }] };
const MOCK = { source: 'mock', flights: [], hotels: [] };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('searchCategory', () => {
  it('returns live offers for the requested category', async () => {
    const out = await searchCategory(DRAFT, 'flights', 1000, async () => LIVE);
    expect(out).toEqual({ kind: 'done', offers: [{ id: 'f1' }] });
  });

  it('treats a mock/empty response as a retryable error (live prices only)', async () => {
    expect(await searchCategory(DRAFT, 'flights', 1000, async () => MOCK)).toEqual({ kind: 'error' });
    expect(await searchCategory(DRAFT, 'hotels', 1000, async () => ({ source: 'live', flights: [], hotels: [] }))).toEqual({ kind: 'error' });
  });

  it('treats a network failure as an error', async () => {
    expect(await searchCategory(DRAFT, 'flights', 1000, async () => { throw new Error('boom'); })).toEqual({ kind: 'error' });
  });

  it('times out when the request exceeds the limit', async () => {
    vi.useFakeTimers();
    try {
      const slow = deferred<typeof LIVE>();
      const promise = searchCategory(DRAFT, 'flights', 45_000, () => slow.promise);
      await vi.advanceTimersByTimeAsync(45_001);
      expect(await promise).toEqual({ kind: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createSearchRunner', () => {
  it('delivers outcomes independently per category', async () => {
    const runner = createSearchRunner({ timeoutMs: 1000, fetcher: async ({ category }) =>
      category === 'flights' ? LIVE : MOCK });
    const outcomes: Record<string, CategoryOutcome> = {};
    await Promise.all([
      runner.run(DRAFT, 'flights', (o) => { outcomes.flights = o; }),
      runner.run(DRAFT, 'hotels', (o) => { outcomes.hotels = o; }),
    ]);
    expect(outcomes.flights.kind).toBe('done');
    expect(outcomes.hotels.kind).toBe('error');
  });

  it('does not start a duplicate request while one is in flight', async () => {
    const fetcher = vi.fn(async () => LIVE);
    const runner = createSearchRunner({ timeoutMs: 1000, fetcher });
    const slow = deferred<typeof LIVE>();
    fetcher.mockReturnValueOnce(slow.promise as Promise<typeof LIVE>);
    const first = runner.run(DRAFT, 'flights', () => {});
    await runner.run(DRAFT, 'flights', () => {}); // ignored: already running
    slow.resolve(LIVE);
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a late response from a timed-out attempt never reaches apply after a retry succeeds', async () => {
    vi.useFakeTimers();
    try {
      const stale = deferred<typeof LIVE>();
      const fetcher = vi.fn()
        .mockReturnValueOnce(stale.promise) // first attempt: hangs past timeout
        .mockResolvedValueOnce({ source: 'live', flights: [{ id: 'fresh' }], hotels: [] });
      const runner = createSearchRunner({ timeoutMs: 45_000, fetcher });

      const applied: CategoryOutcome[] = [];
      const first = runner.run(DRAFT, 'flights', (o) => applied.push(o));
      await vi.advanceTimersByTimeAsync(45_001);
      await first;
      expect(applied).toEqual([{ kind: 'timeout' }]);

      // User taps Retry: invalidate then run again.
      runner.invalidate('flights');
      await runner.run(DRAFT, 'flights', (o) => applied.push(o));
      expect(applied[1]).toEqual({ kind: 'done', offers: [{ id: 'fresh' }] });

      // The original request finally resolves — it must not call apply again.
      stale.resolve(LIVE);
      await vi.runAllTimersAsync();
      expect(applied).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('an attempt superseded by invalidate does not deliver its outcome', async () => {
    const slow = deferred<typeof LIVE>();
    const runner = createSearchRunner({ timeoutMs: 60_000, fetcher: () => slow.promise });
    const applied: CategoryOutcome[] = [];
    const first = runner.run(DRAFT, 'flights', (o) => applied.push(o));
    runner.invalidate('flights'); // retry pressed before the response lands
    slow.resolve(LIVE);
    await first;
    expect(applied).toEqual([]);
  });
});
