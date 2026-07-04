<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="match">
      <!-- Header -->
      <div class="row items-center no-wrap q-mb-md">
        <q-btn flat round icon="arrow_back" @click="back" />
        <div class="col q-ml-sm" style="min-width: 0">
          <div class="text-h5 text-weight-bold ellipsis">{{ match.name }}</div>
          <div class="text-grey ellipsis">
            {{ formatDate(match.start_date) }} | {{ match.location }}
          </div>
        </div>
        <q-badge
          :color="statusColor(match.status)"
          :label="match.status"
          class="match-status-badge q-ml-sm"
        />
      </div>

      <!-- Info -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row q-gutter-md">
            <q-chip icon="star" :label="`Level ${match.level}`" />
            <q-chip icon="flag" :label="match.organization" />
          </div>
          <div v-if="match.description" class="q-mt-sm text-grey-8">
            {{ match.description }}
          </div>
        </q-card-section>
      </q-card>

      <!-- Results -->
      <div class="text-h6 q-mb-sm">Results</div>
      <MatchResultsViewer
        v-if="matchResults.length > 0"
        :match-results="matchResults"
        :stages="stages"
        :organization="match.organization"
        :load-stage-results="loadStageResults"
      />
      <div v-else class="text-center text-grey q-pa-lg">
        Results not yet available
      </div>
    </template>

    <div v-else class="text-center text-grey q-pa-xl">
      <q-icon name="search_off" size="3em" class="q-mb-md" />
      <div>Match not found</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from 'src/boot/axios';
import type {
  Match,
  Stage,
  MatchResultEntry,
  StageResultEntry,
} from '@hitfactor/shared';
import MatchResultsViewer from 'src/components/results/MatchResultsViewer.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();

const loading = ref(true);
const match = ref<Match | null>(null);
const stages = ref<Stage[]>([]);
const matchResults = ref<MatchResultEntry[]>([]);

function back(): void {
  void router.push('/public/matches');
}

async function loadStageResults(
  stageId: string,
): Promise<StageResultEntry[]> {
  try {
    const { data } = await api.get<Array<{ results: StageResultEntry[] }>>(
      `/api/public/matches/${props.id}/stages/${stageId}/results`,
    );
    return (Array.isArray(data) ? data : []).flatMap((r) => r.results ?? []);
  } catch {
    return [];
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'grey',
    registration: 'blue',
    active: 'green',
    scoring: 'orange',
    final: 'purple',
    archived: 'grey-7',
  };
  return map[status] ?? 'grey';
}

onMounted(async () => {
  try {
    const { data } = await api.get<Match & { stages: Stage[] }>(
      `/api/public/matches/${props.id}`,
    );
    match.value = data;
    stages.value = data.stages ?? [];

    const resp = await api.get<Array<{ results: MatchResultEntry[] }>>(
      `/api/public/matches/${props.id}/results`,
    );
    matchResults.value = (Array.isArray(resp.data) ? resp.data : []).flatMap(
      (r) => r.results ?? [],
    );
  } catch {
    match.value = null;
  } finally {
    loading.value = false;
  }
});
</script>
