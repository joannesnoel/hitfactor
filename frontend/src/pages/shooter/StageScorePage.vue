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
          <div class="row items-center q-mb-md">
            <div class="text-h6">Your Score</div>
            <q-space />
            <q-badge
              :color="myScore.power_factor === 'Major' ? 'deep-orange' : 'blue'"
              :label="myScore.power_factor"
            />
          </div>
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

          <!-- Where you lost: accuracy vs speed vs the winner -->
          <div v-if="lossBreakdown" class="q-mt-md">
            <div class="text-subtitle2 text-weight-medium q-mb-sm">
              Where you lost this stage
              <span class="text-caption text-grey-7">(vs the winner)</span>
            </div>
            <div class="row items-center q-mb-sm">
              <div class="col-3 col-sm-2 text-caption">Accuracy</div>
              <div class="col">
                <q-linear-progress
                  :value="Math.min(1, lossBreakdown.accuracy)"
                  color="teal"
                  track-color="teal-1"
                  size="14px"
                  rounded
                />
              </div>
              <div class="col-auto q-pl-sm text-caption text-weight-medium" style="min-width: 96px; text-align: right">
                {{ (lossBreakdown.accuracy * 100).toFixed(0) }}%<span
                  v-if="lossBreakdown.pointsDown > 0"
                  class="text-grey-7"
                > · {{ lossBreakdown.pointsDown }} pts</span>
              </div>
            </div>
            <div class="row items-center">
              <div class="col-3 col-sm-2 text-caption">Speed</div>
              <div class="col">
                <q-linear-progress
                  :value="Math.min(1, lossBreakdown.speed)"
                  color="deep-orange"
                  track-color="deep-orange-1"
                  size="14px"
                  rounded
                />
              </div>
              <div class="col-auto q-pl-sm text-caption text-weight-medium" style="min-width: 96px; text-align: right">
                {{ (lossBreakdown.speed * 100).toFixed(0) }}%<span
                  v-if="lossBreakdown.timeBehind > 0"
                  class="text-grey-7"
                > · {{ lossBreakdown.timeBehind.toFixed(2) }}s</span>
              </div>
            </div>
            <q-banner dense class="bg-blue-1 rounded-borders q-mt-sm">
              <template #avatar><q-icon name="lightbulb" color="amber-8" /></template>
              <span v-if="lossBreakdown.dominant === 'speed'">
                <b>Speed</b> cost you the most here — at the winner's pace you'd have
                scored ~{{ (lossBreakdown.accuracy * 100).toFixed(0) }}%
                <span class="text-positive">(+{{ lossBreakdown.gainIfSpeed.toFixed(0) }}%)</span>.
              </span>
              <span v-else>
                <b>Accuracy</b> cost you the most here — with the winner's points you'd
                have scored ~{{ (lossBreakdown.speed * 100).toFixed(0) }}%
                <span class="text-positive">(+{{ lossBreakdown.gainIfAccuracy.toFixed(0) }}%)</span>.
              </span>
            </q-banner>
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Stage, Score, StageResultEntry, Organization } from '@hitfactor/shared';
import { DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import StageResultsTable from 'src/components/results/StageResultsTable.vue';

const route = useRoute();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();

const matchId = route.params.id as string;
const stageId = route.params.stageId as string;

const loading = ref(true);
const stage = ref<Stage | null>(null);
const myScore = ref<Score | null>(null);
const myDivision = ref<string | null>(null);
const stageResults = ref<StageResultEntry[]>([]);
const organization = ref<Organization>(DEFAULT_ORGANIZATION);

// stage_results holds one entry-set per division plus a cross-division 'combined'
// pool, all flattened together. Scope to the shooter's own division so the winner
// and placement reflect their division — not another division or the combined pool.
const divisionResults = computed(() => {
  const div = myDivision.value ?? myScore.value?.division ?? null;
  return stageResults.value.filter(
    (r) => !r.combined && (!div || r.division === div)
  );
});

const stageWinner = computed(
  () => divisionResults.value.find((r) => r.place === 1) ?? null
);

const myStageResult = computed(() => {
  if (!myScore.value) return null;
  return (
    divisionResults.value.find(
      (r) => r.registration_id === myScore.value!.registration_id
    ) ?? null
  );
});

// When you're not the stage winner, split the gap into accuracy vs speed against
// the winner. Identity: stage% = accuracy × speed. The "what-if" gains are exact
// — matching the winner's pace makes stage% = accuracy×100; matching the winner's
// points makes it speed×100 — so the bigger gain is the bigger opportunity.
const lossBreakdown = computed(() => {
  const me = myStageResult.value;
  const w = stageWinner.value;
  if (!me || !w || me.place === 1 || me.dqed || me.dnf) return null;
  if (me.time <= 0 || w.time <= 0 || w.total_points <= 0) return null;
  const accuracy = me.total_points / w.total_points; // your points ÷ winner's
  const speed = w.time / me.time; // winner's time ÷ yours
  const stagePct = me.stage_percentage;
  return {
    accuracy,
    speed,
    pointsDown: Math.max(0, w.total_points - me.total_points),
    timeBehind: Math.max(0, me.time - w.time),
    gainIfSpeed: Math.max(0, accuracy * 100 - stagePct),
    gainIfAccuracy: Math.max(0, speed * 100 - stagePct),
    dominant: accuracy <= speed ? 'accuracy' : 'speed',
  };
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
  db = await whenPowerSyncReady();
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
      const myRegs = await db.getAll<{ id: string; division: string }>(
        'SELECT id, division FROM registrations WHERE match_id = ? AND user_id = ?',
        [matchId, authStore.user.id],
      );
      if (myRegs.length > 0) {
        myDivision.value = myRegs[0].division;
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
