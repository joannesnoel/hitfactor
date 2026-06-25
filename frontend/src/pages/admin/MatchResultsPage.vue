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

      <MatchStandings
        v-if="matchResults.length > 0"
        :results="matchResults"
        :stages="stages"
        :organization="match?.organization"
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
import type { Stage, MatchResultEntry, Match } from '@hitfactor/shared';
import MatchStandings from 'src/components/results/MatchStandings.vue';

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
    const response = await api.get(`/api/matches/${matchId}/results`);
    return response.data?.results ?? [];
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
    await api.post(`/api/matches/${matchId}/compute-results`);
    matchResults.value = await loadMatchResults();
    $q.notify({ type: 'positive', message: 'Results computed!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to compute results' });
  } finally {
    computing.value = false;
  }
}
</script>
