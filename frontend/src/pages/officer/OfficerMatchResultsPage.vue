<template>
  <q-page padding>
    <div class="row items-center no-wrap q-mb-md">
      <q-btn flat round icon="arrow_back" @click="goBack" />
      <div class="q-ml-sm col" style="min-width: 0">
        <div class="text-h5 text-weight-bold ellipsis">
          {{ matchName || 'Results' }}
        </div>
        <div class="text-caption text-grey">
          Live standings — reflects results as they're computed during scoring.
        </div>
      </div>
      <q-btn flat round icon="refresh" :loading="loading" @click="reload">
        <q-tooltip>Refresh</q-tooltip>
      </q-btn>
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <MatchResultsViewer
        v-if="matchResults.length > 0"
        :match-results="matchResults"
        :stages="stages"
        :organization="organization"
        :load-stage-results="loadStageResults"
      />
      <div v-else class="text-center text-grey q-pa-xl">
        <q-icon name="leaderboard" size="4em" class="q-mb-md" />
        <div class="text-h6">No results computed yet</div>
        <div class="text-caption">
          Ask the match director to compute results, then tap refresh.
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from 'src/boot/axios';
import type {
  Stage,
  MatchResultEntry,
  StageResultEntry,
  Organization,
} from '@hitfactor/shared';
import { DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import MatchResultsViewer from 'src/components/results/MatchResultsViewer.vue';

const route = useRoute();
const router = useRouter();
const matchId = route.params.matchId as string;

const loading = ref(true);
const matchName = ref('');
const organization = ref<Organization>(DEFAULT_ORGANIZATION);
const stages = ref<Stage[]>([]);
const matchResults = ref<MatchResultEntry[]>([]);

// Authenticated endpoints (officers are authorized for their match, and these
// work for private matches — unlike the public results API).
async function loadStageResults(stageId: string): Promise<StageResultEntry[]> {
  try {
    const { data } = await api.get<Array<{ results: StageResultEntry[] }>>(
      `/api/matches/${matchId}/stages/${stageId}/results`,
    );
    return (Array.isArray(data) ? data : []).flatMap((r) => r.results ?? []);
  } catch {
    return [];
  }
}

async function reload() {
  loading.value = true;
  try {
    const { data: m } = await api.get<{
      name?: string;
      organization?: string;
      stages?: Stage[];
    }>(`/api/matches/${matchId}`);
    matchName.value = m.name ?? '';
    if (m.organization) organization.value = m.organization as Organization;
    stages.value = (m.stages ?? [])
      .slice()
      .sort((a, b) => Number(a.stage_number) - Number(b.stage_number));

    const { data: r } = await api.get<Array<{ results: MatchResultEntry[] }>>(
      `/api/matches/${matchId}/results`,
    );
    matchResults.value = (Array.isArray(r) ? r : []).flatMap(
      (x) => x.results ?? [],
    );
  } catch {
    // leave whatever loaded; the empty state covers "nothing computed yet"
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push('/officer/dashboard');
}

onMounted(reload);
</script>
