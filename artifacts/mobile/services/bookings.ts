import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBooking, getBooking, listBookings } from '@workspace/api-client-react';
import type { CreateBookingRequest, Booking } from '@workspace/api-client-react';

const KEY = 'saferni.bookings.v2';
const LEGACY_KEY = 'saferni.bookingIds.v1';

type LocalBookingRef = { id: string; token: string };

/** Booking refs (id + secret access token) created on this device for secure booking retrieval. */
export async function loadLocalBookingRefs(): Promise<LocalBookingRef[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (x): x is LocalBookingRef =>
            !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.token === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

async function rememberBookingRef(ref: LocalBookingRef): Promise<void> {
  const refs = await loadLocalBookingRefs();
  if (!refs.some((r) => r.id === ref.id)) {
    await AsyncStorage.setItem(KEY, JSON.stringify([ref, ...refs].slice(0, 50)));
  }
}

async function findLocalToken(bookingId: string): Promise<string | undefined> {
  const refs = await loadLocalBookingRefs();
  return refs.find((r) => r.id === bookingId)?.token;
}

export async function startBooking(
  req: CreateBookingRequest,
): Promise<{ bookingId: string; accessToken: string; status: string }> {
  const res = await createBooking(req);
  await rememberBookingRef({ id: res.bookingId, token: res.accessToken });
  return res;
}

/** Fetch a booking; sends this device's stored access token when required. */
export async function fetchBooking(bookingId: string): Promise<Booking> {
  const token = await findLocalToken(bookingId);
  return getBooking(bookingId, token ? { token } : undefined);
}

/** Fetch the authenticated user's bookings plus locally stored booking references. */
export async function fetchMyBookings(signedIn: boolean): Promise<Booking[]> {
  const results = new Map<string, Booking>();
  if (signedIn) {
    try {
      const { bookings } = await listBookings();
      for (const b of bookings) results.set(b.id, b);
    } catch {
      // fall through to local ids
    }
  }
  const refs = await loadLocalBookingRefs();
  const local = await Promise.allSettled(refs.map((r) => getBooking(r.id, { token: r.token })));
  for (const r of local) {
    if (r.status === 'fulfilled') results.set(r.value.id, r.value);
  }
  // Bookings saved before access tokens existed can no longer be fetched by a
  // Clean up the legacy key so we stop carrying dead references.
  AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
  return [...results.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
