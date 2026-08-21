import { ref, onMounted } from 'vue';
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
    try {
      if (db) {
        const result = await db.get<Match>(
          'SELECT * FROM matches WHERE id = ?',
          [id],
        );
        match.value = normalizeMatch(result);
      } else {
        const response = await api.get<Match>(`/api/matches/${id}`);
        match.value = response.data;
      }
    } catch (err) {
      console.error('Failed to load match:', err);
    } finally {
      loading.value = false;
    }
  }

  async function loadStages(id: string) {
    try {
      if (db) {
        const result = await db.getAll<Stage>(
          'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
          [id],
        );
        stages.value = result.map(normalizeStage);
      } else {
        const response = await api.get<Stage[]>(
          `/api/matches/${id}/stages`,
        );
        stages.value = response.data;
      }
    } catch (err) {
      console.error('Failed to load stages:', err);
    }
  }

  async function loadRegistrations(id: string) {
    try {
      if (db) {
        const result = await db.getAll<Registration>(
          'SELECT * FROM registrations WHERE match_id = ? ORDER BY shooter_name',
          [id],
        );
        registrations.value = result;
      } else {
        // No dedicated REST endpoint for registrations yet; leave empty
        registrations.value = [];
      }
    } catch (err) {
      console.error('Failed to load registrations:', err);
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
