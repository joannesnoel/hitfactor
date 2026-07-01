<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">Results</div>
        <q-btn
          color="primary"
          icon="calculate"
          label="Compute Results"
          unelevated
          :loading="computing"
          @click="computeResults"
        />
      </div>

      <MatchResultsViewer
        v-if="matchResults.length > 0"
        :match-results="matchResults"
        :stages="stages"
        :organization="match?.organization"
        :load-stage-results="loadStageResults"
      />
      <div v-else class="text-center text-grey q-pa-xl">
        <q-icon name="leaderboard" size="4em" class="q-mb-md" />
        <div>No results computed yet</div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import type { Ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import type {
  Stage,
  MatchResultEntry,
  StageResultEntry,
  Match,
} from '@hitfactor/shared';
import MatchResultsViewer from 'src/components/results/MatchResultsViewer.vue';

const $q = useQuasar();

const ctx = inject<{
  match: Ref<Match | null>;
  stages: Ref<Stage[]>;
  matchId: string;
  loading: Ref<boolean>;
}>('matchContext')!;

const { match, stages, matchId, loading } = ctx;

const computing = ref(false);
const matchResults = ref<MatchResultEntry[]>([]);

async function loadMatchResults(): Promise<MatchResultEntry[]> {
  try {
    // The endpoint returns one row per division ({ division, results: [...] });
    // flatten into a single list — MatchStandings filters by a division selector.
    const response = await api.get<Array<{ results: MatchResultEntry[] }>>(
      `/api/matches/${matchId}/results`,
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.flatMap((r) => r.results ?? []);
  } catch {
    return [];
  }
}

async function loadStageResults(
  stageId: string,
): Promise<StageResultEntry[]> {
  try {
    const response = await api.get<Array<{ results: StageResultEntry[] }>>(
      `/api/matches/${matchId}/stages/${stageId}/results`,
    );
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.flatMap((r) => r.results ?? []);
  } catch {
    return [];
  }
}

onMounted(async () => {
  matchResults.value = await loadMatchResults();
});

async function computeResults() {
  computing.value = true;
  try {
    await api.post(`/api/matches/${matchId}/results/compute`);
    matchResults.value = await loadMatchResults();
    $q.notify({ type: 'positive', message: 'Results computed!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to compute results' });
  } finally {
    computing.value = false;
  }
}
</script>
