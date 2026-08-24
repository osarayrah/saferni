import { searchTrips } from '@workspace/api-client-react';
import type { TripDraft } from '@/types/travel';

export type SearchCategory = 'flights' | 'hotels';

export type CategoryOutcome =
  | { kind: 'done'; offers: unknown[] }
  | { kind: 'timeout' }
  | { kind: 'error' };

type Fetcher = (body: { draft: TripDraft; category: SearchCategory }) => Promise<{
  source: string;
  flights: unknown[];
  hotels: unknown[];
}>;

/**
 * Run one category search with a hard timeout. Live prices only: a mock or
 * empty response is a retryable error, never silently substituted data.
 * The timeout timer is always cleared, and a response arriving after the
 * timeout is discarded by the race.
 */
export async function searchCategory(
  draft: TripDraft,
  category: SearchCategory,
  timeoutMs: number,
  fetcher: Fetcher = searchTrips as unknown as Fetcher,
): Promise<CategoryOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      fetcher({ draft, category }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('search-timeout')), timeoutMs);
      }),
    ]);
    if (res.source !== 'mock' && res[category].length > 0) {
      return { kind: 'done', offers: res[category] };
    }
    return { kind: 'error' };
  } catch (err) {
    return err instanceof Error && err.message === 'search-timeout' ? { kind: 'timeout' } : { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-category search runner with attempt generations: each `run` claims a new
 * attempt id, and an outcome is only delivered if no newer attempt (retry) has
 * started since. This makes retry immune to stale responses from superseded
 * requests.
 */
export function createSearchRunner(options?: { timeoutMs?: number; fetcher?: Fetcher }) {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const attempts: Record<SearchCategory, number> = { flights: 0, hotels: 0 };
  const running: Record<SearchCategory, boolean> = { flights: false, hotels: false };

  return {
    async run(
      draft: TripDraft,
      category: SearchCategory,
      apply: (outcome: CategoryOutcome) => void,
    ): Promise<void> {
      if (running[category]) return;
      running[category] = true;
      const attempt = ++attempts[category];
      try {
        const outcome = await searchCategory(draft, category, timeoutMs, options?.fetcher);
        // Deliver only if this is still the latest attempt for the category.
        if (attempt === attempts[category]) apply(outcome);
      } finally {
        if (attempt === attempts[category]) running[category] = false;
      }
    },
    /** Marks any in-flight attempt as superseded and clears the running flag. */
    invalidate(category: SearchCategory): void {
      attempts[category]++;
      running[category] = false;
    },
  };
}
