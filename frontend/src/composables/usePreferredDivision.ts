import { ref, watch } from 'vue';

// A single sticky division choice shared across every results view and persisted
// across sessions, so a shooter's division selection carries over between stages,
// matches, and reloads instead of resetting to the alphabetically-first division.
const KEY = 'hf.preferredDivision';
const preferred = ref<string>(localStorage.getItem(KEY) ?? '');

watch(preferred, (v) => {
  // Persist real divisions only — 'combined' is a transient cross-division view.
  if (v && v !== 'combined') localStorage.setItem(KEY, v);
});

/**
 * Shared, persisted preferred division. Bind a selector's v-model through this
 * (or call remember()) so the choice sticks.
 */
export function usePreferredDivision() {
  const remember = (division: string) => {
    // 'combined' is a per-view cross-division ranking — don't let it become the
    // sticky preference; keep remembering the shooter's real division.
    if (division && division !== 'combined') preferred.value = division;
  };
  return { preferred, remember };
}

/**
 * Pick the initial division for a view: the sticky preference if it's available
 * here, else the shooter's own division (`fallback`, e.g. their registration),
 * else the first available. Never returns something not in `available`.
 */
export function pickInitialDivision(
  available: string[],
  fallback?: string
): string {
  if (available.includes(preferred.value)) return preferred.value;
  if (fallback && available.includes(fallback)) return fallback;
  return available[0] ?? '';
}
