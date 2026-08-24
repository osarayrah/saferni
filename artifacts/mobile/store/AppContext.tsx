import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter, type SyncTrip } from '@workspace/api-client-react';
import { fetchSyncState, mergeTrips, pushSyncState } from '@/lib/sync';
import { uid } from '@/services/mockData';
import type { SearchResults } from '@/services/planner';
import type { ItineraryDay, SavedOffer, Trip, UserProfile } from '@/types/travel';
import type { Language } from '@/services/i18n';

const PROFILE_KEY = 'saferni.profile.v1';
const TRIPS_KEY = 'saferni.trips.v1';
const FLIGHT_FILTERS_KEY = 'saferni.flightFilters.v1';
const SAVED_OFFERS_KEY = 'saferni.savedOffers.v1';
const LANGUAGE_KEY = 'saferni.language.v1';

export type FlightFilters = {
  stops: 'any' | 'nonstop' | 'max1';
  airline: string | null;
  departure: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  refundableOnly: boolean;
};

const DEFAULT_PROFILE: UserProfile = {
  firstName: '',
  homeCity: 'Amman',
  homeAirport: 'AMM',
  currency: 'USD',
  travelStyles: [],
  onboarded: false,
};

type AppContextValue = {
  ready: boolean;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  trips: Trip[];
  saveTrip: (trip: Trip) => void;
  updateTrip: (id: string, patch: Partial<Trip> | ((t: Trip) => Partial<Trip>)) => void;
  updateTripDays: (id: string, days: ItineraryDay[]) => void;
  deleteTrip: (id: string) => void;
  duplicateTrip: (id: string) => Trip | null;
  search: SearchResults | null;
  setSearch: React.Dispatch<React.SetStateAction<SearchResults | null>>;
  syncStatus: SyncStatus;
  flightFilters: FlightFilters | null;
  saveFlightFilters: (filters: FlightFilters | null) => void;
  savedOffers: SavedOffer[];
  saveOffer: (offer: Omit<SavedOffer, 'savedAt'>) => void;
  unsaveOffer: (id: string) => void;
  isOfferSaved: (id: string) => boolean;
  language: Language;
  setLanguage: (language: Language) => void;
};

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState<SearchResults | null>(null);
  const [flightFilters, setFlightFilters] = useState<FlightFilters | null>(null);
  const [savedOffers, setSavedOffers] = useState<SavedOffer[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');
  const [language, setLanguageState] = useState<Language>('en');
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    (async () => {
      try {
        const [p, t, ff, so, lang] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(TRIPS_KEY),
          AsyncStorage.getItem(FLIGHT_FILTERS_KEY),
          AsyncStorage.getItem(SAVED_OFFERS_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY),
        ]);
        if (p) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(p) });
        if (t) setTrips(JSON.parse(t));
        if (ff) setFlightFilters(JSON.parse(ff));
        if (so) setSavedOffers(JSON.parse(so));
        if (lang === 'ar' || lang === 'en') setLanguageState(lang);
      } catch {
        // corrupted storage — start fresh rather than crash
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
  }, []);

  const persistProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Functional updates + a serialized write queue so rapid mutations
  // (e.g. quick checkbox taps) never clobber each other in state or storage.
  const writeQueue = React.useRef<Promise<void>>(Promise.resolve());
  const persistTrips = useCallback((update: (prev: Trip[]) => Trip[]) => {
    setTrips((prev) => {
      const next = update(prev);
      writeQueue.current = writeQueue.current
        .then(() => AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(next)))
        .catch(() => {});
      return next;
    });
  }, []);

  // --- Cloud sync -----------------------------------------------------------
  // Initial pull + merge when the user signs in; afterwards every local change
  // is pushed (debounced) so other devices pick it up on their next pull.
  const hydratedFromCloud = useRef(false);
  // The API intentionally treats trips as opaque records. Keep records a
  // newer/older app cannot render in the next upload so syncing this device
  // never erases another client's data.
  const opaqueTripsRef = useRef<SyncTrip[]>([]);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-current snapshots so the sign-in merge reads real local state
  // synchronously instead of relying on setState updater timing.
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (!ready) return;
    if (!isSignedIn) {
      hydratedFromCloud.current = false;
      opaqueTripsRef.current = [];
      setSyncStatus('off');
      return;
    }
    let cancelled = false;
    (async () => {
      setSyncStatus('syncing');
      try {
        const remote = await fetchSyncState();
        if (cancelled) return;
        if (!remote) {
          setSyncStatus('error');
          return;
        }
        // Merge synchronously from the current local snapshots, then set,
        // persist, and push those exact merged values.
        const mergedTrips = mergeTrips(tripsRef.current, remote.trips ?? []);
        const localTripIds = new Set(mergedTrips.map((trip) => trip.id));
        opaqueTripsRef.current = (remote.opaqueTrips ?? []).filter(
          (trip) => !localTripIds.has(trip.id),
        );
        const mergedProfile: UserProfile = remote.preferences
          ? { ...DEFAULT_PROFILE, ...profileRef.current, ...remote.preferences }
          : { ...profileRef.current };
        setTrips(mergedTrips);
        writeQueue.current = writeQueue.current
          .then(() => AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(mergedTrips)))
          .catch(() => {});
        setProfile(mergedProfile);
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile)).catch(() => {});
        const ok = await pushSyncState(
          [...mergedTrips, ...opaqueTripsRef.current],
          mergedProfile,
        );
        if (cancelled) return;
        hydratedFromCloud.current = true;
        setSyncStatus(ok ? 'synced' : 'error');
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !hydratedFromCloud.current) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      setSyncStatus('syncing');
      const ok = await pushSyncState(
        [...trips, ...opaqueTripsRef.current],
        profile,
      ).catch(() => false);
      setSyncStatus(ok ? 'synced' : 'error');
    }, 1500);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, profile, isSignedIn]);

  const saveFlightFilters = useCallback((filters: FlightFilters | null) => {
    setFlightFilters(filters);
    if (filters) {
      AsyncStorage.setItem(FLIGHT_FILTERS_KEY, JSON.stringify(filters)).catch(() => {});
    } else {
      AsyncStorage.removeItem(FLIGHT_FILTERS_KEY).catch(() => {});
    }
  }, []);

  // Local-device-only for v1 — bookmarks don't round-trip through /api/sync yet.
  const persistSavedOffers = useCallback((update: (prev: SavedOffer[]) => SavedOffer[]) => {
    setSavedOffers((prev) => {
      const next = update(prev);
      AsyncStorage.setItem(SAVED_OFFERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveOffer = useCallback(
    (offer: Omit<SavedOffer, 'savedAt'>) => {
      persistSavedOffers((prev) =>
        prev.some((o) => o.id === offer.id) ? prev : [{ ...offer, savedAt: new Date().toISOString() }, ...prev],
      );
    },
    [persistSavedOffers],
  );

  const unsaveOffer = useCallback(
    (id: string) => {
      persistSavedOffers((prev) => prev.filter((o) => o.id !== id));
    },
    [persistSavedOffers],
  );

  const isOfferSaved = useCallback((id: string) => savedOffers.some((o) => o.id === id), [savedOffers]);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      persistProfile({ ...profile, ...patch });
    },
    [profile, persistProfile],
  );

  const saveTrip = useCallback(
    (trip: Trip) => {
      persistTrips((prev) => [trip, ...prev.filter((t) => t.id !== trip.id)]);
    },
    [persistTrips],
  );

  const updateTrip = useCallback(
    (id: string, patch: Partial<Trip> | ((t: Trip) => Partial<Trip>)) => {
      persistTrips((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch), updatedAt: new Date().toISOString() }
            : t,
        ),
      );
    },
    [persistTrips],
  );

  const updateTripDays = useCallback(
    (id: string, days: ItineraryDay[]) => {
      persistTrips((prev) => prev.map((t) => (t.id === id ? { ...t, days, updatedAt: new Date().toISOString() } : t)));
    },
    [persistTrips],
  );

  const deleteTrip = useCallback(
    (id: string) => {
      persistTrips((prev) => prev.filter((t) => t.id !== id));
    },
    [persistTrips],
  );

  const duplicateTrip = useCallback(
    (id: string): Trip | null => {
      const src = trips.find((t) => t.id === id);
      if (!src) return null;
      const copy: Trip = {
        ...src,
        id: uid('trip'),
        title: `${src.title} (copy)`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persistTrips((prev) => [copy, ...prev]);
      return copy;
    },
    [trips, persistTrips],
  );

  const value = useMemo(
    () => ({
      ready,
      profile,
      updateProfile,
      trips,
      saveTrip,
      updateTrip,
      updateTripDays,
      deleteTrip,
      duplicateTrip,
      search,
      setSearch,
      syncStatus,
      flightFilters,
      saveFlightFilters,
      savedOffers,
      saveOffer,
      unsaveOffer,
      isOfferSaved,
      language,
      setLanguage,
    }),
    [
      ready,
      profile,
      updateProfile,
      trips,
      saveTrip,
      updateTrip,
      updateTripDays,
      deleteTrip,
      duplicateTrip,
      search,
      syncStatus,
      flightFilters,
      saveFlightFilters,
      savedOffers,
      saveOffer,
      unsaveOffer,
      isOfferSaved,
      language,
      setLanguage,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
