import { computed, onMounted, onUnmounted, ref } from 'vue';
import { assemblePerfBundles, computeShooterPerformance } from '@hitfactor/shared';
import type { PerfSourceRows, ShooterPerformance } from '@hitfactor/shared';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';

/**
 * The signed-in shooter's career analytics across every match they've shot —
 * hosted and private matches included — computed on the phone from the synced
 * results, so it works offline and updates live as scores and results arrive.
 */
export function useMyPerformance() {
  const auth = useAuthStore();
  const abort = new AbortController();
  const loading = ref(true);

  const registrations = ref<PerfSourceRows['registrations']>([]);
  const matches = ref<PerfSourceRows['matches']>([]);
  const stages = ref<PerfSourceRows['stages']>([]);
  const stageResults = ref<PerfSourceRows['stageResults']>([]);
  const matchResults = ref<PerfSourceRows['matchResults']>([]);

  function rows<T>(res: { rows?: { _array?: unknown[] } }): T[] {
    return (res.rows?._array as T[] | undefined) ?? [];
  }

  onMounted(async () => {
    const db = await whenPowerSyncReady();
    const uid = auth.user?.id;
    if (!db || !uid) {
      loading.value = false;
      return;
    }
    const opts = { signal: abort.signal };
    const mine = '(SELECT match_id FROM registrations WHERE user_id = ?)';
    db.watch(
      'SELECT id, match_id, division FROM registrations WHERE user_id = ?',
      [uid],
      {
        onResult: (r) => {
          registrations.value = rows(r);
          loading.value = false;
        },
        onError: () => (loading.value = false),
      },
      opts,
    );
    db.watch(
      `SELECT id, name, start_date, organization FROM matches WHERE id IN ${mine}`,
      [uid],
      { onResult: (r) => (matches.value = rows(r)) },
      opts,
    );
    db.watch(
      `SELECT id, match_id, stage_number, max_points FROM stages WHERE match_id IN ${mine}`,
      [uid],
      { onResult: (r) => (stages.value = rows(r)) },
      opts,
    );
    db.watch(
      `SELECT match_id, stage_id, division, results FROM stage_results WHERE match_id IN ${mine}`,
      [uid],
      { onResult: (r) => (stageResults.value = rows(r)) },
      opts,
    );
    db.watch(
      `SELECT match_id, division, results FROM match_results WHERE match_id IN ${mine}`,
      [uid],
      { onResult: (r) => (matchResults.value = rows(r)) },
      opts,
    );
    // Don't spin forever if nothing has synced yet.
    setTimeout(() => (loading.value = false), 4000);
  });
  onUnmounted(() => abort.abort());

  const perf = computed<ShooterPerformance>(() =>
    computeShooterPerformance(
      assemblePerfBundles({
        registrations: registrations.value,
        matches: matches.value,
        stages: stages.value,
        stageResults: stageResults.value,
        matchResults: matchResults.value,
      }),
    ),
  );

  return { perf, loading };
}
