import { getSyncState, putSyncState, type SyncTrip } from '@workspace/api-client-react';
import type { Trip, UserProfile } from '@/types/travel';

export type SyncState = {
  trips: Trip[];
  opaqueTrips: SyncTrip[];
  preferences: Partial<UserProfile> | null;
  updatedAt: string | null;
};

function toLocalTrip(value: unknown): Trip | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Trip>;
  const requiredStrings: Array<keyof Trip> = [
    'id', 'title', 'origin', 'destinationCode', 'destinationName', 'country',
    'departureDate', 'returnDate', 'status', 'currency', 'coverImage',
    'createdAt', 'updatedAt',
  ];
  if (requiredStrings.some((key) => typeof candidate[key] !== 'string')) return null;
  if (
    typeof candidate.oneWay !== 'boolean' ||
    typeof candidate.adults !== 'number' ||
    typeof candidate.children !== 'number' ||
    typeof candidate.budget !== 'number' ||
    typeof candidate.estimatedTotal !== 'number' ||
    !candidate.flight ||
    !candidate.hotel ||
    !Array.isArray(candidate.days)
  ) {
    return null;
  }
  return candidate as Trip;
}

export async function fetchSyncState(): Promise<SyncState | null> {
  try {
    const state = await getSyncState();
    return {
      ...state,
      trips: state.trips.map(toLocalTrip).filter((trip): trip is Trip => trip !== null),
      opaqueTrips: state.trips.filter((trip) => toLocalTrip(trip) === null),
    };
  } catch {
    return null;
  }
}

export async function pushSyncState(
  trips: Array<Trip | SyncTrip>,
  preferences: Partial<UserProfile> | null,
): Promise<boolean> {
  try {
    await putSyncState({ trips, preferences });
    return true;
  } catch {
    return false;
  }
}

export { mergeTrips } from './merge';
