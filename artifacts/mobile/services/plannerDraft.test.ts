import { afterEach, describe, expect, it } from 'vitest';
import {
  PLANNER_DRAFT_KEY,
  _setStorageForTesting,
  clearPlannerDraft,
  loadPlannerDraft,
  savePlannerDraft,
  type SavedPlannerState,
} from './plannerDraft';
import type { TripDraft } from '@/types/travel';

function makeState(n: number): SavedPlannerState {
  return {
    messages: [{ id: `m${n}`, role: 'user', content: `msg ${n}` }],
    history: [{ role: 'user', content: `msg ${n}` }],
    draft: { destinationName: `dest ${n}` } as unknown as TripDraft,
  };
}

type Deferred = { resolve: () => void };

function makeFakeStorage(opts?: { delaySetItem?: boolean }) {
  const store = new Map<string, string>();
  const pendingWrites: { key: string; value: string; deferred: Deferred }[] = [];
  return {
    store,
    pendingWrites,
    async getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): Promise<void> {
      if (opts?.delaySetItem) {
        return new Promise<void>((resolve) => {
          pendingWrites.push({
            key,
            value,
            deferred: {
              resolve: () => {
                store.set(key, value);
                resolve();
              },
            },
          });
        });
      }
      store.set(key, value);
      return Promise.resolve();
    },
    async removeItem(key: string) {
      store.delete(key);
    },
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  _setStorageForTesting(null);
});

describe('plannerDraft persistence', () => {
  it('round-trips a saved conversation', async () => {
    const storage = makeFakeStorage();
    _setStorageForTesting(storage);
    await savePlannerDraft(makeState(1));
    const loaded = await loadPlannerDraft();
    expect(loaded).not.toBeNull();
    expect(loaded!.messages[0].content).toBe('msg 1');
    expect(loaded!.history).toHaveLength(1);
  });

  it('clearPlannerDraft removes the saved draft', async () => {
    const storage = makeFakeStorage();
    _setStorageForTesting(storage);
    await savePlannerDraft(makeState(1));
    await clearPlannerDraft();
    expect(await loadPlannerDraft()).toBeNull();
  });

  it('serializes writes so a slow older write cannot overwrite a newer one', async () => {
    const storage = makeFakeStorage({ delaySetItem: true });
    _setStorageForTesting(storage);
    const p1 = savePlannerDraft(makeState(1));
    const p2 = savePlannerDraft(makeState(2));
    await flush();
    // Only the first write should have started — the second waits in the queue.
    expect(storage.pendingWrites).toHaveLength(1);
    storage.pendingWrites[0].deferred.resolve();
    await p1;
    await flush();
    expect(storage.pendingWrites).toHaveLength(2);
    // Resolve the second (newer) write.
    storage.pendingWrites[1].deferred.resolve();
    await p2;
    const loaded = await loadPlannerDraft();
    expect(loaded!.messages[0].content).toBe('msg 2');
  });

  it('a clear queued after a save wins even if the save is slow', async () => {
    const storage = makeFakeStorage({ delaySetItem: true });
    _setStorageForTesting(storage);
    const p1 = savePlannerDraft(makeState(1));
    const p2 = clearPlannerDraft();
    await flush();
    storage.pendingWrites[0].deferred.resolve();
    await p1;
    await p2;
    expect(storage.store.has(PLANNER_DRAFT_KEY)).toBe(false);
  });

  it('snapshot is taken at call time, not flush time', async () => {
    const storage = makeFakeStorage({ delaySetItem: true });
    _setStorageForTesting(storage);
    const state = makeState(1);
    const p = savePlannerDraft(state);
    // Mutating after the call must not affect what gets written.
    state.messages[0].content = 'mutated';
    await flush();
    storage.pendingWrites[0].deferred.resolve();
    await p;
    const loaded = await loadPlannerDraft();
    expect(loaded!.messages[0].content).toBe('msg 1');
  });

  it('load waits for an in-flight save and returns the latest snapshot', async () => {
    const storage = makeFakeStorage({ delaySetItem: true });
    _setStorageForTesting(storage);
    savePlannerDraft(makeState(1));
    // Load starts while the save is still in flight (user leaves right after
    // a message and returns immediately).
    const loadPromise = loadPlannerDraft();
    await flush();
    expect(storage.pendingWrites).toHaveLength(1);
    storage.pendingWrites[0].deferred.resolve();
    const loaded = await loadPromise;
    expect(loaded).not.toBeNull();
    expect(loaded!.messages[0].content).toBe('msg 1');
  });

  it('returns null for corrupted or empty stored data', async () => {
    const storage = makeFakeStorage();
    _setStorageForTesting(storage);
    storage.store.set(PLANNER_DRAFT_KEY, 'not json{');
    expect(await loadPlannerDraft()).toBeNull();
    storage.store.set(PLANNER_DRAFT_KEY, JSON.stringify({ messages: [] }));
    expect(await loadPlannerDraft()).toBeNull();
  });

  it('write errors do not poison the queue', async () => {
    const storage = makeFakeStorage();
    let fail = true;
    _setStorageForTesting({
      ...storage,
      setItem: (key: string, value: string) => {
        if (fail) return Promise.reject(new Error('disk full'));
        return storage.setItem(key, value);
      },
    });
    await savePlannerDraft(makeState(1)); // fails silently
    fail = false;
    await savePlannerDraft(makeState(2));
    const loaded = await loadPlannerDraft();
    expect(loaded!.messages[0].content).toBe('msg 2');
  });
});
