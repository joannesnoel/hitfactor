<template>
  <div>
    <!-- Overall vs per-stage selector -->
    <q-tabs
      v-model="selected"
      dense
      class="text-grey q-mb-md"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
      align="left"
      inline-label
    >
      <q-tab name="overall" icon="leaderboard" label="Overall" />
      <q-tab
        v-for="s in sortedStages"
        :key="s.id"
        :name="s.id"
        :label="`Stage ${s.stage_number}`"
      />
    </q-tabs>

    <!-- Overall match standings -->
    <MatchStandings
      v-if="selected === 'overall'"
      :results="matchResults"
      :stages="stages"
      :organization="organization"
    />

    <!-- Single-stage results -->
    <template v-else>
      <div v-if="loadingStage" class="flex flex-center q-pa-lg">
        <q-spinner color="primary" size="2em" />
      </div>
      <StageResultsTable
        v-else-if="currentStageResults.length > 0"
        :results="currentStageResults"
        :organization="organization"
      />
      <div v-else class="text-center text-grey q-pa-lg">
        No results for this stage yet
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type {
  MatchResultEntry,
  StageResultEntry,
  Stage,
  Organization,
} from '@hitfactor/shared';
import { DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import MatchStandings from 'src/components/results/MatchStandings.vue';
import StageResultsTable from 'src/components/results/StageResultsTable.vue';

const props = withDefaults(
  defineProps<{
    matchResults: MatchResultEntry[];
    stages: Stage[];
    organization?: Organization;
    // Provided by the parent so admin (REST) and shooter (PowerSync) each load
    // a stage's results their own way. Returns entries across all divisions.
    loadStageResults: (stageId: string) => Promise<StageResultEntry[]>;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const selected = ref<string>('overall');
const loadingStage = ref(false);
const currentStageResults = ref<StageResultEntry[]>([]);
const cache = new Map<string, StageResultEntry[]>();

const sortedStages = computed(() =>
  props.stages.slice().sort((a, b) => a.stage_number - b.stage_number)
);

watch(selected, async (stageId) => {
  if (stageId === 'overall') return;
  if (cache.has(stageId)) {
    currentStageResults.value = cache.get(stageId) ?? [];
    return;
  }
  loadingStage.value = true;
  try {
    const results = await props.loadStageResults(stageId);
    cache.set(stageId, results);
    currentStageResults.value = results;
  } finally {
    loadingStage.value = false;
  }
});
</script>
