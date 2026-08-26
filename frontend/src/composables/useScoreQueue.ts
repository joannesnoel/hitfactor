import { ref, watch, type Ref } from 'vue';

// An officer's per-stage working order: an ordered list of registration ids the
// officer plans to score, in the sequence they'll process them (call order).
// Local to this device, persisted per match+stage so it survives a refresh —
// following the localStorage `hf.*` convention (see usePreferredDivision.ts).
// Not synced to other officers/devices by design (v1).

function key(matchId: string, stageId: string): string {
  return `hf.scoreQueue.${matchId}.${stageId}`;
}

function load(matchId: string, stageId: string): string[] {
  try {
    const raw = localStorage.getItem(key(matchId, stageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export interface ScoreQueue {
  /** Ordered registration ids to process. Empty = no queue (default nav). */
  queue: Ref<string[]>;
  setQueue: (ids: string[]) => void;
  clear: () => void;
  remove: (id: string) => void;
  append: (id: string) => void;
  contains: (id: string) => boolean;
}

export function useScoreQueue(matchId: string, stageId: string): ScoreQueue {
  const queue = ref<string[]>(load(matchId, stageId));

  watch(
    queue,
    (v) => {
      try {
        if (v.length) {
          localStorage.setItem(key(matchId, stageId), JSON.stringify(v));
        } else {
          localStorage.removeItem(key(matchId, stageId));
        }
      } catch {
        // storage may be unavailable (private mode) — queue still works in-memory
      }
    },
    { deep: true },
  );

  const setQueue = (ids: string[]) => {
    // De-dupe while preserving order.
    queue.value = Array.from(new Set(ids));
  };
  const clear = () => {
    queue.value = [];
  };
  const remove = (id: string) => {
    queue.value = queue.value.filter((x) => x !== id);
  };
  const append = (id: string) => {
    if (!queue.value.includes(id)) queue.value = [...queue.value, id];
  };
  const contains = (id: string) => queue.value.includes(id);

  return { queue, setQueue, clear, remove, append, contains };
}
