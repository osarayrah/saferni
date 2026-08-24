/**
 * Regression tests for cloud-sync merging.
 *
 * Guards against the sign-in hydration bug where a fresh device (no local
 * trips) could push an empty state and wipe an existing remote account.
 *
 * Run: node --test --experimental-strip-types artifacts/saferni/lib/__tests__/sync.merge.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeTrips } from '../merge.ts';
import type { Trip } from '../../types/travel.ts';

function trip(id: string, updatedAt: string, title = id): Trip {
  return { id, updatedAt, createdAt: updatedAt, title } as unknown as Trip;
}

test('fresh device (no local trips) keeps all remote trips — remote account is not wiped', () => {
  const remote = [trip('a', '2026-07-01T00:00:00Z'), trip('b', '2026-07-02T00:00:00Z')];
  const merged = mergeTrips([], remote);
  assert.deepEqual(merged.map((t) => t.id).sort(), ['a', 'b']);
});

test('union by id: local-only and remote-only trips both survive', () => {
  const merged = mergeTrips([trip('local1', '2026-07-01T00:00:00Z')], [trip('remote1', '2026-07-02T00:00:00Z')]);
  assert.deepEqual(merged.map((t) => t.id).sort(), ['local1', 'remote1']);
});

test('newer updatedAt wins per trip', () => {
  const merged = mergeTrips(
    [trip('a', '2026-07-05T00:00:00Z', 'local-newer'), trip('b', '2026-07-01T00:00:00Z', 'local-older')],
    [trip('a', '2026-07-01T00:00:00Z', 'remote-older'), trip('b', '2026-07-05T00:00:00Z', 'remote-newer')],
  );
  const byId = Object.fromEntries(merged.map((t) => [t.id, (t as unknown as { title: string }).title]));
  assert.equal(byId.a, 'local-newer');
  assert.equal(byId.b, 'remote-newer');
});
