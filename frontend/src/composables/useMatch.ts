import { ref, onMounted, onUnmounted } from 'vue';
import type { PowerSyncDatabase } from '@powersync/web';
import { api } from 'src/boot/axios';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type {
  Match,
  Stage,
  Registration,
  Score,
  StageResultEntry,
  MatchResultEntry,
} from '@hitfactor/shared';

export function useMatch(matchId?: string) {
  // Obtained in onMounted via whenPowerSyncReady(); inject('powerSyncDb') only
  // ever yields the boot-time null, which silently forced the (incomplete) REST
  // fallback and left registrations/scores empty.
  let db: PowerSyncDatabase | null = null;
  const matches = ref<Match[]>([]);
  const match = ref<Match | null>(null);
  const stages = ref<Stage[]>([]);
  const registrations = ref<Registration[]>([]);
  const scores = ref<Score[]>([]);
  const loading = ref(false);

  // Reactive queries keep data live as it syncs (offline-first). Track each
  // watch's AbortController so a repeated load (e.g. StageSetupPage re-reads
  // stages after every edit) replaces its watch instead of stacking a new one,
  // and so they're all torn down when the consumer unmounts.
  const watchControllers: Record<string, AbortController | undefined> = {};
  function watchRows<T>(
    key: string,
    query: string,
    params: unknown[],
    apply: (rows: T[]) => void,
  ) {
    watchControllers[key]?.abort();
    const ctrl = new AbortController();
    watchControllers[key] = ctrl;
    db!.watch(
      query,
      params,
      {
        onResult: (result) => apply((result.rows?._array as T[] | undefined) ?? []),
        onError: () => {
          loading.value = false;
        },
      },
      { signal: ctrl.signal },
    );
  }
  onUnmounted(() => {
    Object.values(watchControllers).forEach((c) => c?.abort());
  });

  async function loadMatches() {
    loading.value = true;
    if (db) {
      // Reactive: a one-shot query here races the initial PowerSync sync (the
      // match hasn't landed in the local DB yet on first load) and shows an
      // empty list. db.watch re-emits as matches sync in.
      db.watch('SELECT * FROM matches ORDER BY start_date DESC', [], {
        onResult: (result) => {
          matches.value = (
            (result.rows?._array as Match[] | undefined) ?? []
          ).map(normalizeMatch);
          loading.value = false;
        },
        onError: () => {
          loading.value = false;
        },
      });
    } else {
      try {
        const response = await api.get<Match[]>('/api/matches');
        matches.value = response.data;
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        loading.value = false;
      }
    }
  }

  async function loadMatch(id: string) {
    loading.value = true;
    if (db) {
      // Reactive: a one-shot db.get here races the initial sync — a
      // just-created match hasn't replicated into the local DB yet, and db.get
      // THROWS on an empty result. A watch re-emits when the row syncs in, so
      // the page recovers on its own instead of needing a manual refresh.
      watchRows<Match>('match', 'SELECT * FROM matches WHERE id = ?', [id], (rows) => {
        match.value = rows[0] ? normalizeMatch(rows[0]) : null;
        loading.value = false;
      });
    } else {
      try {
        const response = await api.get<Match>(`/api/matches/${id}`);
        match.value = response.data;
      } catch (err) {
        console.error('Failed to load match:', err);
      } finally {
        loading.value = false;
      }
    }
  }

  async function loadStages(id: string) {
    if (db) {
      // Reactive so newly-added stages (and the host overview's stage list)
      // appear as they sync, without a manual reload.
      watchRows<Stage>(
        'stages',
        'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
        [id],
        (rows) => {
          stages.value = rows.map(normalizeStage);
        },
      );
    } else {
      try {
        const response = await api.get<Stage[]>(`/api/matches/${id}/stages`);
        stages.value = response.data;
      } catch (err) {
        console.error('Failed to load stages:', err);
      }
    }
  }

  async function loadRegistrations(id: string) {
    if (db) {
      // Reactive so the host sees the shooter count climb as guests join.
      watchRows<Registration>(
        'registrations',
        'SELECT * FROM registrations WHERE match_id = ? ORDER BY shooter_name',
        [id],
        (rows) => {
          registrations.value = rows;
        },
      );
    } else {
      // No dedicated REST endpoint for registrations yet; leave empty
      registrations.value = [];
    }
  }

  async function loadScores(id: string, stageId?: string) {
    try {
      if (db) {
        let query = 'SELECT * FROM scores WHERE match_id = ?';
        const params: string[] = [id];
        if (stageId) {
          query += ' AND stage_id = ?';
          params.push(stageId);
        }
        const result = await db.getAll<Score>(query, params);
        scores.value = result;
      } else {
        scores.value = [];
      }
    } catch (err) {
      console.error('Failed to load scores:', err);
    }
  }

  async function loadStageResults(
    id: string,
    stageId: string,
  ): Promise<StageResultEntry[]> {
    try {
      if (db) {
        const result = await db.get<{ results: string }>(
          'SELECT results FROM stage_results WHERE match_id = ? AND stage_id = ?',
          [id, stageId],
        );
        return JSON.parse(result.results) as StageResultEntry[];
      } else {
        const response = await api.get(
          `/api/matches/${id}/stages/${stageId}/results`,
        );
        return response.data?.results ?? [];
      }
    } catch {
      return [];
    }
  }

  async function loadMatchResults(
    id: string,
  ): Promise<MatchResultEntry[]> {
    try {
      if (db) {
        const result = await db.getAll<{ results: string }>(
          'SELECT results FROM match_results WHERE match_id = ?',
          [id],
        );
        return result.flatMap(
          (r) => JSON.parse(r.results) as MatchResultEntry[],
        );
      } else {
        const response = await api.get(`/api/matches/${id}/results`);
        return response.data?.results ?? [];
      }
    } catch {
      return [];
    }
  }

  function normalizeMatch(row: Record<string, unknown>): Match {
    return {
      ...row,
      registration_open: Boolean(row.registration_open),
      is_private: Boolean(row.is_private),
      max_shooters:
        row.max_shooters != null ? Number(row.max_shooters) : null,
    } as Match;
  }

  function normalizeStage(row: Record<string, unknown>): Stage {
    return {
      ...row,
      stage_number: Number(row.stage_number),
      min_rounds: Number(row.min_rounds),
      max_points: Number(row.max_points),
      number_of_targets: Number(row.number_of_targets),
      number_of_steel: Number(row.number_of_steel),
      number_of_no_shoots: Number(row.number_of_no_shoots),
      fixed_time: row.fixed_time != null ? Number(row.fixed_time) : null,
      is_classifier: Boolean(row.is_classifier),
    } as Stage;
  }

  onMounted(async () => {
    db = await whenPowerSyncReady();
    if (matchId) {
      await Promise.all([
        loadMatch(matchId),
        loadStages(matchId),
        loadRegistrations(matchId),
      ]);
    } else {
      await loadMatches();
    }
  });

  return {
    matches,
    match,
    stages,
    registrations,
    scores,
    loading,
    loadMatches,
    loadMatch,
    loadStages,
    loadRegistrations,
    loadScores,
    loadStageResults,
    loadMatchResults,
  };
}
