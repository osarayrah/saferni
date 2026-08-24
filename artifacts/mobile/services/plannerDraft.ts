import type { SearchMode } from '@/services/planner';
import type { ChatMessage, TripDraft } from '@/types/travel';

export const PLANNER_DRAFT_KEY = 'saferni.plannerDraft.v1';

export type SavedPlannerState = {
  messages: ChatMessage[];
  history: { role: 'user' | 'assistant'; content: string }[];
  draft: TripDraft;
  mode?: SearchMode;
};

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storage: StorageLike | null = null;

function getStorage(): StorageLike {
  if (!storage) {
    // Lazy require so tests can inject a fake without pulling in react-native.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    storage = require('@react-native-async-storage/async-storage').default as StorageLike;
  }
  return storage;
}

/** Test seam: inject a fake storage implementation and reset the write queue. */
export function _setStorageForTesting(s: StorageLike | null): void {
  storage = s;
  writeQueue = Promise.resolve();
}

// All writes go through a serialized queue so a slow older setItem can never
// resolve after — and overwrite — a newer one (same pattern as trip persistence).
let writeQueue: Promise<void> = Promise.resolve();

export function savePlannerDraft(state: SavedPlannerState): Promise<void> {
  // Serialize eagerly so the snapshot reflects state at call time, not flush time.
  const raw = JSON.stringify(state);
  writeQueue = writeQueue.then(() => getStorage().setItem(PLANNER_DRAFT_KEY, raw)).catch(() => {});
  return writeQueue;
}

export function clearPlannerDraft(): Promise<void> {
  writeQueue = writeQueue.then(() => getStorage().removeItem(PLANNER_DRAFT_KEY)).catch(() => {});
  return writeQueue;
}

export async function loadPlannerDraft(): Promise<SavedPlannerState | null> {
  try {
    // Wait for any in-flight writes so a save-then-immediate-load (leave the
    // screen right after a message, return quickly) sees the latest snapshot.
    await writeQueue;
    const raw = await getStorage().getItem(PLANNER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlannerState;
    if (!parsed || !Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    return {
      messages: parsed.messages,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      draft: parsed.draft,
      mode: parsed.mode,
    };
  } catch {
    // corrupted storage — start fresh rather than crash
    return null;
  }
}
