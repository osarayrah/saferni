import { FlightCard, HotelCard, PackageCard, money } from '@/components/travel';
import { Card, Chip, EmptyState, FadeIn, Row, Segmented } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { DESTINATIONS } from '@/services/mockData';
import { useApp, type FlightFilters } from '@/store/AppContext';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { assembleTrip, buildPackages, formatDate, type SearchCategoryStatus, type SearchResults } from '@/services/planner';
import { createSearchRunner } from '@/services/liveSearch';
import type { FlightOffer, HotelOffer } from '@/types/travel';
import { Feather } from '@expo/vector-icons';
import {
  DEPARTURE_WINDOWS,
  decideFilterReapplication,
  shouldEvaluateFilters,
  matchesAirline,
  matchesDeparture,
  matchesRefundable,
  matchesStops,
  type DepartureWindow,
  type StopsFilter,
} from '@/services/flightFilters';

type SortMode = 'Recommended' | 'Cheapest' | 'Fastest';

type StarsFilter = 3 | 4 | 5 | null;

type Category = 'flights' | 'hotels';

export default function ResultsScreen() {
  const c = useColors();
  const router = useRouter();
  const { ready, search, setSearch, saveTrip, flightFilters, saveFlightFilters } = useApp();
  // A flights/hotels-only mode never gets offers in the other category (see
  // onSearch in the Plan tab), so the tab picker is scoped to just that one —
  // "packages"/"general" (or no mode at all, e.g. a very old cached search)
  // behave exactly like before.
  const mode = search?.mode ?? 'packages';
  const segmentOptions = mode === 'flights' ? ['Flights'] : mode === 'hotels' ? ['Hotels'] : ['Packages', 'Flights', 'Hotels'];
  const [tab, setTab] = useState<string>(mode === 'flights' ? 'Flights' : mode === 'hotels' ? 'Hotels' : 'Packages');
  const [sort, setSort] = useState<SortMode>('Recommended');
  const [stops, setStops] = useState<StopsFilter>('any');
  const [airline, setAirline] = useState<string | null>(null);
  const [departure, setDeparture] = useState<DepartureWindow | null>(null);
  const [refundableOnly, setRefundableOnly] = useState<boolean>(false);
  const [stars, setStars] = useState<StarsFilter>(null);
  const [priceTier, setPriceTier] = useState<PriceTier>(null);
  const [filtersNotice, setFiltersNotice] = useState<string | null>(null);

  // Persist the traveler's explicit filter choices so the next search remembers them.
  const persistFilters = useCallback(
    (patch: Partial<FlightFilters>) => {
      const next: FlightFilters = { stops, airline, departure, refundableOnly, ...patch };
      if (next.stops === 'any' && next.airline === null && next.departure === null && !next.refundableOnly) {
        saveFlightFilters(null);
      } else {
        saveFlightFilters(next);
      }
    },
    [stops, airline, departure, refundableOnly, saveFlightFilters],
  );

  const chooseStops = (s: StopsFilter) => {
    setStops(s);
    setFiltersNotice(null);
    persistFilters({ stops: s });
  };
  const chooseAirline = (a: string | null) => {
    setAirline(a);
    setFiltersNotice(null);
    persistFilters({ airline: a });
  };
  const chooseDeparture = (d: DepartureWindow | null) => {
    setDeparture(d);
    setFiltersNotice(null);
    persistFilters({ departure: d });
  };
  const chooseRefundable = (r: boolean) => {
    setRefundableOnly(r);
    setFiltersNotice(null);
    persistFilters({ refundableOnly: r });
  };

  // ---------------------------------------------------------------------
  // Streaming search runner: flights and hotels are fetched independently
  // so each list appears as soon as its request finishes. The runner tracks
  // per-category attempt generations, so a stale response from a superseded
  // (timed-out or retried) request can never overwrite newer state.
  // ---------------------------------------------------------------------
  const runnerRef = useRef(createSearchRunner({ timeoutMs: SEARCH_TIMEOUT_MS }));

  const runCategory = useCallback(
    (category: Category, draft: SearchResults['draft']) => {
      const statusKey = category === 'flights' ? 'flightsStatus' : 'hotelsStatus';
      runnerRef.current.run(draft, category, (outcome) => {
        setSearch((prev) => {
          if (!prev || prev.draft !== draft) return prev; // a newer search replaced this one
          // Live prices only — an empty or mock response is a retryable
          // failure, but it must not discard live results from the other category.
          const status: SearchCategoryStatus = outcome.kind === 'done' ? 'done' : outcome.kind;
          const next: SearchResults = { ...prev, [statusKey]: status };
          if (outcome.kind === 'done') {
            (next as Record<Category, unknown>)[category] = outcome.offers as (FlightOffer | HotelOffer)[];
          }
          if (next.flightsStatus === 'done' && next.hotelsStatus === 'done') {
            next.packages = buildPackages(next.draft, next.flights, next.hotels);
          }
          return next;
        });
      });
    },
    [setSearch],
  );

  useEffect(() => {
    if (!search) return;
    if (search.flightsStatus === 'loading') runCategory('flights', search.draft);
    if (search.hotelsStatus === 'loading') runCategory('hotels', search.draft);
  }, [search, runCategory]);

  const retry = useCallback(
    (category: Category) => {
      // Supersede any in-flight attempt before the effect starts a fresh one.
      runnerRef.current.invalidate(category);
      setSearch((prev) =>
        prev ? { ...prev, [category === 'flights' ? 'flightsStatus' : 'hotelsStatus']: 'loading' } : prev,
      );
    },
    [setSearch],
  );

  // Airlines present in the result set (code → name), price-sorted order preserved.
  const airlines = useMemo(() => {
    if (!search) return [];
    const seen = new Map<string, string>();
    for (const f of search.flights) {
      const code = f.outbound.segments[0]?.airlineCode ?? 'XX';
      if (!seen.has(code)) seen.set(code, f.validatingAirline);
    }
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }, [search]);

  const hasFlightFilters = stops !== 'any' || airline !== null || departure !== null || refundableOnly;
  const resetFlightFilters = () => {
    setStops('any');
    setAirline(null);
    setDeparture(null);
    setRefundableOnly(false);
    setFiltersNotice(null);
    saveFlightFilters(null);
  };

  // -----------------------------------------------------------------------
  // Re-apply the last-used filters once per search when flights arrive.
  // If they'd exclude every flight, start clean (locally AND in storage)
  // and tell the traveler why.
  // -----------------------------------------------------------------------
  const appliedForDraft = useRef<SearchResults['draft'] | null>(null);

  // A new search clears any leftover notice, even before flights arrive.
  useEffect(() => {
    setFiltersNotice(null);
  }, [search?.draft]);

  useEffect(() => {
    // Wait for AsyncStorage hydration (`ready`) and a terminal, non-empty
    // flight result before consuming the one evaluation per draft — an
    // error/timeout/empty response may still be retried for the same draft.
    if (!search) return;
    if (
      !shouldEvaluateFilters({
        hydrated: ready,
        status: search.flightsStatus ?? 'done',
        flightCount: search.flights.length,
        alreadyEvaluated: appliedForDraft.current === search.draft,
      })
    ) {
      return;
    }
    appliedForDraft.current = search.draft;
    const decision = decideFilterReapplication(search.flights, flightFilters);
    if (decision.action === 'apply') {
      setStops(decision.filters.stops);
      setAirline(decision.filters.airline);
      setDeparture(decision.filters.departure);
      setRefundableOnly(decision.filters.refundableOnly);
    } else if (decision.action === 'reset') {
      setStops('any');
      setAirline(null);
      setDeparture(null);
      setRefundableOnly(false);
      saveFlightFilters(null);
      setFiltersNotice("Your last-used filters didn't match any of these flights, so they were reset.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, flightFilters]);

  const flights = useMemo(() => {
    if (!search) return [];
    const list = search.flights.filter(
      (f) =>
        matchesStops(f, stops) &&
        matchesAirline(f, airline) &&
        matchesDeparture(f, departure) &&
        matchesRefundable(f, refundableOnly)
    );
    if (sort === 'Cheapest') list.sort((a, b) => a.totalPrice - b.totalPrice);
    if (sort === 'Fastest') list.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
    return list;
  }, [search, sort, stops, airline, departure, refundableOnly]);

  // Faceted counts: for each option, count flights matching all OTHER active filters plus that option.
  const flightCounts = useMemo(() => {
    const all = search?.flights ?? [];
    const countStops = (s: StopsFilter) =>
      all.filter((f) => matchesStops(f, s) && matchesAirline(f, airline) && matchesDeparture(f, departure) && matchesRefundable(f, refundableOnly)).length;
    const countAirline = (a: string | null) =>
      all.filter((f) => matchesStops(f, stops) && matchesAirline(f, a) && matchesDeparture(f, departure) && matchesRefundable(f, refundableOnly)).length;
    const countDeparture = (d: DepartureWindow | null) =>
      all.filter((f) => matchesStops(f, stops) && matchesAirline(f, airline) && matchesDeparture(f, d) && matchesRefundable(f, refundableOnly)).length;
    return {
      stops: {
        any: countStops('any'),
        nonstop: countStops('nonstop'),
        max1: countStops('max1'),
      } as Record<StopsFilter, number>,
      airline: new Map<string | null, number>([
        [null, countAirline(null)],
        ...airlines.map((a) => [a.code, countAirline(a.code)] as [string | null, number]),
      ]),
      departure: new Map<DepartureWindow | null, number>([
        [null, countDeparture(null)],
        ...DEPARTURE_WINDOWS.map((w) => [w.key, countDeparture(w.key)] as [DepartureWindow | null, number]),
      ]),
    };
  }, [search, airlines, stops, airline, departure, refundableOnly]);

  // Price-tier thresholds derived from the full hotel result set (thirds of the price spread).
  const priceTiers = useMemo(() => {
    if (!search || search.hotels.length === 0) return null;
    const prices = search.hotels.map((h) => h.totalPrice).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    if (max <= min) return null;
    const step = (max - min) / 3;
    return { budgetMax: min + step, midMax: min + 2 * step, currency: search.hotels[0].currency };
  }, [search]);

  const hasHotelFilters = stars !== null || priceTier !== null || refundableOnly;
  const resetHotelFilters = () => {
    setStars(null);
    setPriceTier(null);
    // Refundable is shared with the flight filters — keep the persisted
    // flight preference in sync with what's now visible on screen.
    chooseRefundable(false);
  };

  const hotels = useMemo(() => {
    if (!search) return [];
    let list = [...search.hotels];
    if (refundableOnly) list = list.filter((h) => h.refundable);
    if (stars !== null) list = list.filter((h) => (stars === 5 ? h.starRating === 5 : h.starRating >= stars));
    if (priceTier && priceTiers) {
      list = list.filter((h) =>
        priceTier === 'budget' ? h.totalPrice <= priceTiers.budgetMax
        : priceTier === 'mid' ? h.totalPrice > priceTiers.budgetMax && h.totalPrice <= priceTiers.midMax
        : h.totalPrice > priceTiers.midMax
      );
    }
    if (sort === 'Cheapest') list.sort((a, b) => a.totalPrice - b.totalPrice);
    if (sort === 'Fastest') list.sort((a, b) => b.guestRating - a.guestRating);
    return list;
  }, [search, sort, stars, priceTier, priceTiers, refundableOnly]);

  if (!search) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="search" title="No search yet" message="Start a plan in the AI planner and your results will show up here." />
      </View>
    );
  }

  const { draft, packages, activities } = search;
  const dest = DESTINATIONS.find((d) => d.code === draft.destinationCode) ?? DESTINATIONS[0];
  const flightsPending = search.flightsStatus !== undefined && search.flightsStatus !== 'done';
  const hotelsPending = search.hotelsStatus !== undefined && search.hotelsStatus !== 'done';
  const searchInProgress = flightsPending || hotelsPending;

  const choosePackage = (pkgId: string) => {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const trip = assembleTrip(draft, pkg, activities, dest.image);
    saveTrip(trip);
    router.replace({ pathname: '/trip/[tripId]', params: { tripId: trip.id } });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: 'Georgia', fontSize: 25, color: c.foreground, letterSpacing: -0.3 }}>
          {draft.origin} → {draft.destinationName}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: 14 }}>
          {formatDate(draft.departureDate!)}
          {draft.oneWay ? ' · One-way' : ` – ${formatDate(draft.returnDate!)}`} · {draft.adults + draft.children} travellers
          {draft.budget ? ` · budget ${money(draft.budget, draft.currency)}` : ''}
        </Text>
      </View>


      {searchInProgress ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.foreground }}>
            Searching live prices
          </Text>
          {mode !== 'hotels' ? (
            <CategoryProgressRow
              category="flights"
              status={search.flightsStatus ?? 'done'}
              count={search.flights.length}
              onRetry={() => retry('flights')}
            />
          ) : null}
          {mode !== 'flights' ? (
            <CategoryProgressRow
              category="hotels"
              status={search.hotelsStatus ?? 'done'}
              count={search.hotels.length}
              onRetry={() => retry('hotels')}
            />
          ) : null}
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            A first-time search can take up to 30 seconds. Results appear below as each search finishes.
          </Text>
        </Card>
      ) : null}

      <Segmented options={segmentOptions} value={tab} onChange={setTab} />

      {tab !== 'Packages' ? (
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {(['Recommended', 'Cheapest', 'Fastest'] as SortMode[]).map((s) => (
            <Chip key={s} small label={s === 'Fastest' && tab === 'Hotels' ? 'Top rated' : s} selected={sort === s} onPress={() => setSort(s)} />
          ))}
          <Chip small label="Refundable" selected={refundableOnly} onPress={() => chooseRefundable(!refundableOnly)} />
        </Row>
      ) : null}

      {tab === 'Flights' ? (
        <View style={{ gap: 10 }}>
          {filtersNotice ? (
            <Row style={{ gap: 8 }}>
              <Feather name="info" size={14} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontSize: 12.5, flex: 1 }}>{filtersNotice}</Text>
            </Row>
          ) : null}
          <FilterRow label="Stops">
            <Chip small label={`Any (${flightCounts.stops.any})`} selected={stops === 'any'} onPress={() => chooseStops('any')} />
            <Chip
              small
              label={`Nonstop (${flightCounts.stops.nonstop})`}
              selected={stops === 'nonstop'}
              disabled={stops !== 'nonstop' && flightCounts.stops.nonstop === 0}
              onPress={() => chooseStops('nonstop')}
            />
            <Chip
              small
              label={`1 stop max (${flightCounts.stops.max1})`}
              selected={stops === 'max1'}
              disabled={stops !== 'max1' && flightCounts.stops.max1 === 0}
              onPress={() => chooseStops('max1')}
            />
          </FilterRow>
          {airlines.length > 1 ? (
            <FilterRow label="Airline">
              <Chip small label={`All (${flightCounts.airline.get(null) ?? 0})`} selected={airline === null} onPress={() => chooseAirline(null)} />
              {airlines.map((a) => {
                const n = flightCounts.airline.get(a.code) ?? 0;
                return (
                  <Chip
                    key={a.code}
                    small
                    label={`${a.name} (${n})`}
                    selected={airline === a.code}
                    disabled={airline !== a.code && n === 0}
                    onPress={() => chooseAirline(airline === a.code ? null : a.code)}
                  />
                );
              })}
            </FilterRow>
          ) : null}
          <FilterRow label="Departs">
            <Chip small label={`Anytime (${flightCounts.departure.get(null) ?? 0})`} selected={departure === null} onPress={() => chooseDeparture(null)} />
            {DEPARTURE_WINDOWS.map((w) => {
              const n = flightCounts.departure.get(w.key) ?? 0;
              return (
                <Chip
                  key={w.key}
                  small
                  label={`${w.label} (${n})`}
                  selected={departure === w.key}
                  disabled={departure !== w.key && n === 0}
                  onPress={() => chooseDeparture(departure === w.key ? null : w.key)}
                />
              );
            })}
          </FilterRow>
          {hasFlightFilters ? (
            <Row style={{ gap: 8 }}>
              <Chip small label="Reset filters" selected={false} onPress={resetFlightFilters} />
            </Row>
          ) : null}
        </View>
      ) : null}

      {tab === 'Hotels' ? (
        <View style={{ gap: 10 }}>
          <FilterRow label="Stars">
            <Chip small label="Any" selected={stars === null} onPress={() => setStars(null)} />
            {([3, 4, 5] as const).map((s) => (
              <Chip
                key={s}
                small
                label={s === 5 ? '5★' : `${s}★+`}
                selected={stars === s}
                onPress={() => setStars(stars === s ? null : s)}
              />
            ))}
          </FilterRow>
          {priceTiers ? (
            <FilterRow label="Price">
              <Chip small label="Any" selected={priceTier === null} onPress={() => setPriceTier(null)} />
              <Chip
                small
                label={`Under ${money(Math.round(priceTiers.budgetMax), priceTiers.currency)}`}
                selected={priceTier === 'budget'}
                onPress={() => setPriceTier(priceTier === 'budget' ? null : 'budget')}
              />
              <Chip
                small
                label={`${money(Math.round(priceTiers.budgetMax), priceTiers.currency)}–${money(Math.round(priceTiers.midMax), priceTiers.currency)}`}
                selected={priceTier === 'mid'}
                onPress={() => setPriceTier(priceTier === 'mid' ? null : 'mid')}
              />
              <Chip
                small
                label={`Over ${money(Math.round(priceTiers.midMax), priceTiers.currency)}`}
                selected={priceTier === 'premium'}
                onPress={() => setPriceTier(priceTier === 'premium' ? null : 'premium')}
              />
            </FilterRow>
          ) : null}
        </View>
      ) : null}

      {tab === 'Packages' ? (
        packages.length === 0 ? (
          searchInProgress ? (
            <EmptyState icon="package" title="Building your packages" message="Packages are assembled once flights and hotels are in." />
          ) : (
            <EmptyState icon="package" title="No packages yet" message="We couldn't put packages together for this search." />
          )
        ) : (
          <View style={{ gap: 16 }}>
            {packages.map((p) => (
              <FadeIn key={p.id}>
                <PackageCard pkg={p} budget={draft.budget} onSelect={() => choosePackage(p.id)} />
              </FadeIn>
            ))}
          </View>
        )
      ) : tab === 'Flights' ? (
        flights.length === 0 ? (
          flightsPending ? (
            <EmptyState icon="send" title="Searching flights" message="Live flight results will appear here as soon as they're ready." />
          ) : (
            <EmptyState
              icon="send"
              title="No flights match"
              message={hasFlightFilters ? 'Your filters exclude every flight in these results.' : 'No flight offers came back for this search.'}
              {...(hasFlightFilters ? { actionLabel: 'Reset filters', onAction: resetFlightFilters } : {})}
            />
          )
        ) : (
          <View style={{ gap: 12 }}>
            {flights.map((f) => (
              <FadeIn key={f.id}>
                <FlightCard flight={f} onPress={() => router.push({ pathname: '/flight/[offerId]', params: { offerId: f.id } })} />
              </FadeIn>
            ))}
          </View>
        )
      ) : hotels.length === 0 ? (
        hotelsPending ? (
          <EmptyState icon="home" title="Searching hotels" message="Live hotel results will appear here as soon as they're ready." />
        ) : (
          <EmptyState
            icon="home"
            title="No hotels match"
            message={hasHotelFilters ? 'Your filters exclude every hotel in these results.' : 'No hotel offers came back for this search.'}
            {...(hasHotelFilters ? { actionLabel: 'Reset filters', onAction: resetHotelFilters } : {})}
          />
        )
      ) : (
        <View style={{ gap: 12 }}>
          {hotels.map((h) => (
            <FadeIn key={h.id}>
              <HotelCard hotel={h} onPress={() => router.push({ pathname: '/hotel/[offerId]', params: { offerId: h.id } })} />
            </FadeIn>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingMark: {
    width: 16,
    height: 16,
    borderRadius: 5,
    opacity: 0.8,
  },
  retryBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});

const STAGE_MESSAGES: Record<Category, string[]> = {
  flights: ['Searching 400+ flights…', 'Comparing fares and airlines…', 'Almost there — ranking the best flights…'],
  hotels: ['Checking hotels…', 'Finding the best room rates…', 'Almost there — ranking the best stays…'],
};

const SEARCH_TIMEOUT_MS = 45_000;

/** One progress row per category: spinner + staged message, check when done, retry on timeout. */
function CategoryProgressRow({
  category,
  status,
  count,
  onRetry,
}: {
  category: Category;
  status: SearchCategoryStatus;
  count: number;
  onRetry: () => void;
}) {
  const c = useColors();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (status !== 'loading') return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGE_MESSAGES[category].length - 1)), 9000);
    return () => clearInterval(t);
  }, [status, category]);

  if (status === 'timeout' || status === 'error') {
    return (
      <FadeIn key={status}>
        <Row style={{ gap: 10 }}>
          <Feather name="alert-triangle" size={16} color={c.warning} />
          <Text style={{ color: c.foreground, fontSize: 13.5, flex: 1 }}>
            {status === 'timeout'
              ? `${category === 'flights' ? 'Flight search' : 'Hotel search'} is taking longer than expected.`
              : `Couldn't get live ${category === 'flights' ? 'flight' : 'hotel'} prices right now.`}
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button" style={[styles.retryBtn, { borderColor: c.primary }]}>
            <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Retry</Text>
          </Pressable>
        </Row>
      </FadeIn>
    );
  }
  if (status === 'done') {
    return (
      <FadeIn key="done">
        <Row style={{ gap: 10 }}>
          <Feather name="check-circle" size={16} color={c.success} />
          <Text style={{ color: c.mutedForeground, fontSize: 13.5 }}>
            {count} {category === 'flights' ? 'flight' : 'hotel'} option{count === 1 ? '' : 's'} found
          </Text>
        </Row>
      </FadeIn>
    );
  }
  return (
    <Row style={{ gap: 10 }}>
      <View style={[styles.loadingMark, { backgroundColor: c.primary }]} />
      <FadeIn key={stage}>
        <Text style={{ color: c.foreground, fontSize: 13.5 }}>{STAGE_MESSAGES[category][stage]}</Text>
      </FadeIn>
    </Row>
  );
}

type PriceTier = 'budget' | 'mid' | 'premium' | null;

// Label sits on its own line above the chip row so a wrapped 2nd/3rd line of
// chips still lines up under the label instead of hanging flush-left the way
// an inline fixed-width label + flexWrap row would.
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
      <Row style={{ flexWrap: 'wrap', gap: 8 }}>{children}</Row>
    </View>
  );
}
