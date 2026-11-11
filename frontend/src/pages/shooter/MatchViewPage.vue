<template>
  <q-page padding>
    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="match">
      <!-- Match Header -->
      <div class="row items-center no-wrap q-mb-md">
        <q-btn flat round icon="arrow_back" aria-label="Back" @click="goBack" />
        <div class="col q-ml-sm" style="min-width: 0">
          <div class="text-h5 text-weight-bold ellipsis">{{ match.name }}</div>
          <div class="text-grey ellipsis">
            {{ formatDate(match.start_date) }} | {{ match.location }}
          </div>
        </div>
        <q-badge
          :color="matchStatusColor(match.status)"
          :label="matchStatusLabel(match.status)"
          class="match-status-badge q-ml-sm"
        />
      </div>

      <!-- What you are in this match -->
      <div v-if="isHost || isScorer || isRegistered" class="row items-center q-gutter-xs q-mb-md">
        <q-chip v-if="isHost" dense color="teal" text-color="white" icon="manage_accounts" label="Host" />
        <q-chip v-if="isScorer" dense color="indigo" text-color="white" icon="sports_score" label="Scorer" />
        <q-chip v-if="isRegistered" dense color="positive" text-color="white" icon="check_circle" label="You're in" />
        <q-space />
        <q-btn
          v-if="isHost"
          color="teal"
          unelevated
          no-caps
          icon="tune"
          label="Manage match"
          :to="`/shooter/host/matches/${match.id}`"
        />
      </div>

      <!-- Description (only real content — org/level/registration chips removed
           as clutter). -->
      <q-card v-if="match.description" flat bordered class="q-mb-md">
        <q-card-section class="text-grey-8">
          {{ match.description }}
        </q-card-section>
      </q-card>

      <!-- Register Button -->
      <q-btn
        v-if="match.registration_open && !isRegistered"
        color="primary"
        icon="how_to_reg"
        label="Register for this Match"
        class="full-width q-mb-md"
        unelevated
        @click="showRegisterDialog = true"
      />

      <!-- Tabs -->
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey q-mb-md"
        active-color="primary"
        indicator-color="primary"
        narrow-indicator
        align="left"
      >
        <q-tab name="stages" label="Stages" />
        <q-tab name="results" label="Results" />
        <q-tab v-if="isRegistered" name="analysis" label="My analysis" />
      </q-tabs>

      <q-tab-panels v-model="activeTab" animated>
        <!-- Stages Tab -->
        <q-tab-panel name="stages">
          <div class="q-gutter-md">
            <q-card
              v-for="s in stages"
              :key="s.id"
              flat
              bordered
              class="cursor-pointer"
              @click="$router.push(`/shooter/matches/${match.id}/stages/${s.id}`)"
            >
              <q-card-section>
                <div class="row items-center justify-between">
                  <div>
                    <div class="text-subtitle1 text-weight-bold">
                      Stage {{ s.stage_number }}: {{ s.name }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ scoringLabel(s.scoring_type) }} | {{ s.min_rounds }} rounds | {{ s.max_points }} pts
                    </div>
                  </div>
                  <q-icon name="chevron_right" color="grey" />
                </div>
                <!-- Show own score preview if available -->
                <div v-if="getMyStageScore(s.id)" class="q-mt-sm">
                  <q-chip
                    dense
                    color="primary"
                    text-color="white"
                    :label="`HF: ${getMyStageScore(s.id)!.hit_factor.toFixed(4)}`"
                  />
                </div>
                <!-- Scorers and the host: score this stage, with progress -->
                <div v-if="canScore" class="row items-center q-mt-sm">
                  <q-linear-progress
                    :value="scoredFraction(s.id)"
                    color="teal"
                    track-color="grey-3"
                    rounded
                    size="8px"
                    class="col q-mr-sm"
                  />
                  <span class="text-caption text-grey-7 q-mr-sm">
                    {{ scoredCount(s.id) }}/{{ registrationCount }} scored
                  </span>
                  <q-btn
                    color="teal"
                    unelevated
                    dense
                    no-caps
                    icon="sports_score"
                    label="Score"
                    @click.stop="$router.push(`/shooter/matches/${match.id}/score/${s.id}`)"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-tab-panel>

        <!-- My analysis: how the match went for me, stage by stage -->
        <q-tab-panel v-if="isRegistered" name="analysis">
          <MatchAnalysis
            :match-id="match.id"
            :match-name="match.name"
            :match-date="match.start_date"
            :organization="match.organization"
          />
        </q-tab-panel>

        <!-- Results Tab -->
        <q-tab-panel name="results">
          <MatchResultsViewer
            v-if="matchResults.length > 0"
            :match-results="matchResults"
            :stages="stages"
            :organization="match?.organization"
            :default-division="myDivision"
            :load-stage-results="loadStageResults"
          />
          <div v-else class="text-center text-grey q-pa-lg">
            Results not yet available
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <!-- Registration Dialog -->
    <q-dialog v-model="showRegisterDialog" :maximized="$q.screen.lt.sm">
      <q-card style="min-width: 350px">
        <q-card-section class="text-h6">Register for Match</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="regForm.shooter_name" label="Name" outlined dense />
          <q-input v-model="regForm.member_number" label="Member Number" outlined dense />
          <q-select
            v-model="regForm.division"
            :options="divisionOptions"
            label="Division"
            emit-value
            map-options
            outlined
            dense
          />
          <q-select
            v-model="regForm.power_factor"
            :options="pfOptions"
            label="Power Factor"
            emit-value
            map-options
            outlined
            dense
          />
          <q-select
            v-model="regForm.classification"
            :options="classOptions"
            label="Classification"
            emit-value
            map-options
            outlined
            dense
            clearable
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Register" unelevated @click="handleRegister" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Match, Stage, Score, MatchResultEntry, StageResultEntry, Division, PowerFactor, Classification } from '@hitfactor/shared';
import { POWER_FACTORS, CLASSIFICATIONS, getDivisionsForOrg, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';
import { matchStatusLabel, matchStatusColor } from 'src/composables/matchStatus';
import { useGoBack } from 'src/composables/useGoBack';
import MatchResultsViewer from 'src/components/results/MatchResultsViewer.vue';
import MatchAnalysis from 'src/components/analysis/MatchAnalysis.vue';

const route = useRoute();
const $q = useQuasar();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();
const matchId = route.params.id as string;
const goBack = useGoBack('/shooter/dashboard');

const loading = ref(true);
const match = ref<Match | null>(null);
const stages = ref<Stage[]>([]);
const myScores = ref<Score[]>([]);
const matchResults = ref<MatchResultEntry[]>([]);
// The shooter's own division (first entry) — the default for the results selector.
const myDivision = computed(() => myScores.value[0]?.division);

async function loadStageResults(
  stageId: string,
): Promise<StageResultEntry[]> {
  if (db) {
    const rows = await db.getAll<{ results: string }>(
      'SELECT results FROM stage_results WHERE stage_id = ?',
      [stageId],
    );
    const local = rows.flatMap((r) => JSON.parse(r.results) as StageResultEntry[]);
    if (local.length > 0) return local;
  }
  // Not a participant → results aren't synced locally. They're public, so fetch.
  try {
    const { data } = await api.get<Array<{ results: StageResultEntry[] }>>(
      `/api/public/matches/${matchId}/stages/${stageId}/results`,
    );
    return (Array.isArray(data) ? data : []).flatMap((r) => r.results ?? []);
  } catch {
    return [];
  }
}
const activeTab = ref('stages');
const showRegisterDialog = ref(false);
const isRegistered = ref(false);

const regForm = reactive<{
  shooter_name: string;
  member_number: string;
  division: Division;
  power_factor: PowerFactor;
  classification: Classification | undefined;
}>({
  shooter_name: authStore.user?.display_name ?? '',
  member_number: authStore.user?.member_number ?? '',
  division: (authStore.user?.default_division as Division) ?? 'production',
  power_factor: 'Minor',
  classification: (authStore.user?.classification as Classification) ?? undefined,
});

const divisionOptions = computed(() =>
  getDivisionsForOrg(match.value?.organization ?? DEFAULT_ORGANIZATION).map(
    (d) => ({ label: d.label, value: d.key })
  )
);
const pfOptions = POWER_FACTORS.map((p) => ({ label: p, value: p }));
const classOptions = CLASSIFICATIONS.map((c) => ({ label: c, value: c }));

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function scoringLabel(type: string): string {
  switch (type) {
    case 'comstock': return 'Comstock';
    case 'virginia_count': return 'Virginia Count';
    case 'fixed_time': return 'Fixed Time';
    default: return type;
  }
}

function getMyStageScore(stageId: string): Score | undefined {
  return myScores.value.find((s) => s.stage_id === stageId);
}

async function handleRegister() {
  try {
    await api.post(`/api/matches/${matchId}/registrations`, {
      shooter_name: regForm.shooter_name,
      member_number: regForm.member_number || undefined,
      division: regForm.division,
      power_factor: regForm.power_factor,
      classification: regForm.classification,
    });
    isRegistered.value = true;
    $q.notify({ type: 'positive', message: 'Registered successfully!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Registration failed' });
  }
}

// Load stages / registration / own scores / results — all via getAll (safe on
// empty). Falls back to the public API for a public match whose stages/results
// aren't synced locally (a private match simply no-ops that fallback).
async function loadDetails(): Promise<void> {
  if (!db) return;

  stages.value = await db.getAll<Stage>(
    'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
    [matchId],
  );

  if (authStore.user) {
    const regs = await db.getAll<{ id: string }>(
      'SELECT id FROM registrations WHERE match_id = ? AND user_id = ?',
      [matchId, authStore.user.id],
    );
    isRegistered.value = regs.length > 0;
    if (regs.length > 0) {
      myScores.value = await db.getAll<Score>(
        'SELECT * FROM scores WHERE match_id = ? AND registration_id = ?',
        [matchId, regs[0].id],
      );
    }
  }

  try {
    const resultRows = await db.getAll<{ results: string }>(
      'SELECT results FROM match_results WHERE match_id = ?',
      [matchId],
    );
    matchResults.value = resultRows.flatMap((r) => JSON.parse(r.results) as MatchResultEntry[]);
  } catch {
    matchResults.value = [];
  }

  if (stages.value.length === 0 || matchResults.value.length === 0) {
    try {
      if (stages.value.length === 0) {
        const { data } = await api.get<Match & { stages: Stage[] }>(
          `/api/public/matches/${matchId}`,
        );
        if (!match.value) {
          match.value = { ...data, registration_open: Boolean(data.registration_open) } as Match;
        }
        stages.value = data.stages ?? [];
        stagesFromApi = (data.stages ?? []).length > 0;
      }
      if (matchResults.value.length === 0) {
        const { data } = await api.get<Array<{ results: MatchResultEntry[] }>>(
          `/api/public/matches/${matchId}/results`,
        );
        matchResults.value = (Array.isArray(data) ? data : []).flatMap(
          (r) => r.results ?? [],
        );
      }
    } catch {
      // leave whatever we have
    }
  }
}

const watchAbort = new AbortController();
// True when the match host (or an admin) made this user an official of the match.
const isScorer = ref(false);
// True when the stage list came from the public API rather than the local db.
let stagesFromApi = false;
// The creator of a private match is its host (mirrors the server's isMatchHost).
const isHost = computed(
  () =>
    !!match.value?.is_private &&
    match.value.created_by === authStore.user?.id,
);
// Hosts and scorers can enter scores for any stage.
const canScore = computed(
  () => isHost.value || (isScorer.value && match.value?.status !== 'final'),
);
// Per-stage scoring progress (scores entered vs shooters registered).
const stageScoreCounts = ref<Record<string, number>>({});
const registrationCount = ref(0);
function scoredCount(stageId: string): number {
  return stageScoreCounts.value[stageId] ?? 0;
}
function scoredFraction(stageId: string): number {
  return registrationCount.value ? Math.min(1, scoredCount(stageId) / registrationCount.value) : 0;
}

onMounted(async () => {
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  // Reactive: a just-joined match may not be in the local DB yet — a one-shot
  // db.get would throw "Result set is empty" and leave a blank page. Watch the
  // match row so the view populates as soon as the join syncs down.
  db.watch(
    'SELECT * FROM matches WHERE id = ?',
    [matchId],
    {
      onResult: (res) => {
        const row = (res.rows?._array as Match[] | undefined)?.[0];
        if (row) {
          match.value = {
            ...row,
            registration_open: Boolean(row.registration_open),
            is_private: Boolean(row.is_private),
          } as Match;
          void loadDetails().finally(() => {
            loading.value = false;
          });
        } else if (!match.value) {
          // Not synced yet. A public match can be filled from the API; a private
          // one will arrive via sync shortly and re-fire this watch (keep the
          // spinner until then rather than flashing a blank page).
          void loadDetails().then(() => {
            if (match.value || stages.value.length > 0) loading.value = false;
          });
        }
      },
      onError: () => {
        loading.value = false;
      },
    },
    { signal: watchAbort.signal },
  );

  // Reactive: an assignment may sync in after the page opens (or be removed).
  db.watch(
    'SELECT 1 FROM match_officers WHERE match_id = ? AND user_id = ? LIMIT 1',
    [matchId, authStore.user?.id ?? ''],
    {
      onResult: (res) => {
        isScorer.value = (res.rows?._array?.length ?? 0) > 0;
      },
    },
    { signal: watchAbort.signal },
  );

  // Stages are watched too, so a stage the host adds, edits or removes (even
  // while offline, once it syncs) shows up here without reopening the page. An
  // empty local result doesn't wipe a list that was filled from the public API.
  db.watch(
    'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
    [matchId],
    {
      onResult: (res) => {
        const rows = (res.rows?._array as Stage[] | undefined) ?? [];
        if (rows.length > 0 || !stagesFromApi) stages.value = rows;
      },
    },
    { signal: watchAbort.signal },
  );

  // Scoring progress for hosts/scorers: live counts as scores sync/save.
  db.watch(
    'SELECT stage_id, COUNT(*) AS c FROM scores WHERE match_id = ? GROUP BY stage_id',
    [matchId],
    {
      onResult: (res) => {
        const rows = (res.rows?._array as Array<{ stage_id: string; c: number }> | undefined) ?? [];
        stageScoreCounts.value = Object.fromEntries(rows.map((r) => [r.stage_id, Number(r.c)]));
      },
    },
    { signal: watchAbort.signal },
  );
  db.watch(
    'SELECT COUNT(*) AS c FROM registrations WHERE match_id = ?',
    [matchId],
    {
      onResult: (res) => {
        registrationCount.value = Number((res.rows?._array as Array<{ c: number }> | undefined)?.[0]?.c ?? 0);
      },
    },
    { signal: watchAbort.signal },
  );

  // Results are computed server-side after the match row last changed, so the
  // watch above never re-fires for them. Watch match_results directly so the
  // Results tab fills in as soon as standings sync down (no leave-and-return).
  db.watch(
    'SELECT results FROM match_results WHERE match_id = ?',
    [matchId],
    {
      onResult: (res) => {
        const rows = (res.rows?._array as Array<{ results: string }> | undefined) ?? [];
        if (rows.length === 0) return; // keep any public-API fallback we already have
        try {
          matchResults.value = rows.flatMap((r) => JSON.parse(r.results) as MatchResultEntry[]);
        } catch {
          /* malformed row — leave current results */
        }
      },
    },
    { signal: watchAbort.signal },
  );
});

onUnmounted(() => watchAbort.abort());
</script>
