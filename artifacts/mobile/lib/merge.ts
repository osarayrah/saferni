import type { Trip } from '../types/travel';

/** Merge local and remote trips: union by id, newer `updatedAt` wins. */
export function mergeTrips(local: Trip[], remote: Trip[]): Trip[] {
  const byId = new Map<string, Trip>();
  for (const t of remote) byId.set(t.id, t);
  for (const t of local) {
    const existing = byId.get(t.id);
    if (!existing || new Date(t.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(t.id, t);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
