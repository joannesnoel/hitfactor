<template>
  <q-page padding>
    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="stage">
      <div class="row items-center q-mb-md">
        <q-btn flat round icon="arrow_back" @click="$router.back()" />
        <div class="q-ml-sm">
          <div class="text-h5 text-weight-bold">
            Stage {{ stage.stage_number }}: {{ stage.name }}
          </div>
          <div class="text-caption text-grey">
            {{ scoringLabel(stage.scoring_type) }} | {{ stage.min_rounds }} rounds | {{ stage.max_points }} max pts
          </div>
        </div>
      </div>

      <!-- My Score -->
      <q-card v-if="myScore" class="q-mb-lg">
        <q-card-section>
          <div class="text-h6 q-mb-md">Your Score</div>
          <div class="row q-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="text-center q-mb-md">
                <div class="text-caption text-grey">Hit Factor</div>
                <div class="hf-display text-primary">{{ myScore.hit_factor.toFixed(4) }}</div>
              </div>
              <div class="row q-gutter-sm justify-center">
                <q-chip dense :label="`A: ${myScore.alpha_count}`" color="green" text-color="white" />
                <q-chip dense :label="`C: ${myScore.charlie_count}`" color="orange" text-color="white" />
                <q-chip dense :label="`D: ${myScore.delta_count}`" color="red" text-color="white" />
                <q-chip dense :label="`M: ${myScore.miss_count}`" color="purple" text-color="white" />
              </div>
              <div v-if="myScore.no_shoot_count > 0 || myScore.procedural_count > 0" class="row q-gutter-sm justify-center q-mt-xs">
                <q-chip v-if="myScore.no_shoot_count > 0" dense :label="`NS: ${myScore.no_shoot_count}`" color="blue-grey" text-color="white" />
                <q-chip v-if="myScore.procedural_count > 0" dense :label="`Proc: ${myScore.procedural_count}`" color="brown" text-color="white" />
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <q-list dense>
                <q-item>
                  <q-item-section>Time</q-item-section>
                  <q-item-section side>{{ myScore.time.toFixed(2) }}s</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>Raw Points</q-item-section>
                  <q-item-section side>{{ myScore.raw_points }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>Penalties</q-item-section>
                  <q-item-section side class="text-red">{{ myScore.penalty_points }}</q-item-section>
                </q-item>
                <q-item>
                  <q-item-section class="text-weight-bold">Total Points</q-item-section>
                  <q-item-section side class="text-weight-bold">{{ myScore.total_points }}</q-item-section>
                </q-item>
                <q-separator />
                <q-item v-if="(myScore.steel_hits + myScore.steel_misses) > 0">
                  <q-item-section>Steel</q-item-section>
                  <q-item-section side>{{ myScore.steel_hits }}/{{ myScore.steel_hits + myScore.steel_misses }}</q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- No Score -->
      <q-banner v-else class="bg-blue-1 q-mb-lg" rounded>
        No score recorded yet for this stage.
      </q-banner>

      <!-- Comparison to Stage Winner -->
      <q-card v-if="stageResults.length > 0" class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">Stage Winner Comparison</div>
          <div v-if="stageWinner" class="row q-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Stage Winner</div>
              <div class="text-subtitle1 text-weight-bold">{{ stageWinner.shooter_name }}</div>
              <div class="text-h6 text-green">HF: {{ stageWinner.hit_factor.toFixed(4) }}</div>
            </div>
            <div v-if="myStageResult" class="col-12 col-sm-6">
              <div class="text-caption text-grey">Your Stage %</div>
              <div class="text-h5 text-weight-bold text-primary">
                {{ myStageResult.stage_percentage.toFixed(2) }}%
              </div>
              <div class="text-caption text-grey">Place: {{ myStageResult.place }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Full Stage Results -->
      <div v-if="stageResults.length > 0">
        <div class="text-h6 q-mb-md">Stage Results</div>
        <StageResultsTable :results="stageResults" :organization="organization" />
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { useRoute } from 'vue-router';
import type { PowerSyncDatabase } from '@powersync/web';
import type { Stage, Score, StageResultEntry, Organization } from '@hitfactor/shared';
import { DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import StageResultsTable from 'src/components/results/StageResultsTable.vue';

const route = useRoute();
const db = inject<PowerSyncDatabase>('powerSyncDb');
const authStore = useAuthStore();

const matchId = route.params.id as string;
const stageId = route.params.stageId as string;

const loading = ref(true);
const stage = ref<Stage | null>(null);
const myScore = ref<Score | null>(null);
const stageResults = ref<StageResultEntry[]>([]);
const organization = ref<Organization>(DEFAULT_ORGANIZATION);

const stageWinner = computed(() => {
  return stageResults.value.find((r) => r.place === 1) ?? null;
});

const myStageResult = computed(() => {
  if (!authStore.user) return null;
  // Find my registration ID
  return stageResults.value.find((r) => {
    if (myScore.value) {
      return r.registration_id === myScore.value.registration_id;
    }
    return false;
  }) ?? null;
});

function scoringLabel(type: string): string {
  switch (type) {
    case 'comstock': return 'Comstock';
    case 'virginia_count': return 'Virginia Count';
    case 'fixed_time': return 'Fixed Time';
    default: return type;
  }
}

onMounted(async () => {
  if (!db) {
    loading.value = false;
    return;
  }

  try {
    // Load stage
    const stageRow = await db.get<Stage>('SELECT * FROM stages WHERE id = ?', [stageId]);
    stage.value = {
      ...stageRow,
      stage_number: Number(stageRow.stage_number),
      min_rounds: Number(stageRow.min_rounds),
      max_points: Number(stageRow.max_points),
      is_classifier: Boolean(stageRow.is_classifier),
    } as Stage;

    // Load match organization (for division labels)
    try {
      const matchRow = await db.get<{ organization: string }>(
        'SELECT organization FROM matches WHERE id = ?',
        [matchId],
      );
      if (matchRow?.organization) {
        organization.value = matchRow.organization as Organization;
      }
    } catch {
      // keep default organization
    }

    // Load my score
    if (authStore.user) {
      const myRegs = await db.getAll<{ id: string }>(
        'SELECT id FROM registrations WHERE match_id = ? AND user_id = ?',
        [matchId, authStore.user.id],
      );
      if (myRegs.length > 0) {
        const scoreRows = await db.getAll<Score>(
          'SELECT * FROM scores WHERE stage_id = ? AND registration_id = ?',
          [stageId, myRegs[0].id],
        );
        myScore.value = scoreRows[0] ?? null;
      }
    }

    // Load stage results
    try {
      const resultRows = await db.getAll<{ results: string }>(
        'SELECT results FROM stage_results WHERE stage_id = ?',
        [stageId],
      );
      stageResults.value = resultRows.flatMap((r) => JSON.parse(r.results) as StageResultEntry[]);
    } catch {
      stageResults.value = [];
    }
  } finally {
    loading.value = false;
  }
});
</script>
