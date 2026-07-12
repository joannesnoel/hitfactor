<template>
  <q-page padding>
    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="match">
      <!-- Match Header -->
      <div class="row items-center no-wrap q-mb-md">
        <q-btn flat round icon="arrow_back" @click="$router.back()" />
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

      <!-- Match Info -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row q-gutter-md">
            <q-chip icon="star" :label="`Level ${match.level}`" />
            <q-chip
              :icon="match.registration_open ? 'check_circle' : 'cancel'"
              :label="match.registration_open ? 'Registration Open' : 'Registration Closed'"
              :color="match.registration_open ? 'green' : 'grey'"
              text-color="white"
            />
          </div>
          <div v-if="match.description" class="q-mt-sm text-grey-8">
            {{ match.description }}
          </div>
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
              </q-card-section>
            </q-card>
          </div>
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Match, Stage, Score, MatchResultEntry, StageResultEntry, Division, PowerFactor, Classification } from '@hitfactor/shared';
import { POWER_FACTORS, CLASSIFICATIONS, getDivisionsForOrg, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth.store';
import MatchResultsViewer from 'src/components/results/MatchResultsViewer.vue';

const route = useRoute();
const $q = useQuasar();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();
const matchId = route.params.id as string;

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

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return 'grey';
    case 'registration': return 'blue';
    case 'active': return 'green';
    case 'scoring': return 'orange';
    case 'final': return 'purple';
    default: return 'grey';
  }
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

onMounted(async () => {
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  try {
    // Load match
    const matchRow = await db.get<Match>('SELECT * FROM matches WHERE id = ?', [matchId]);
    match.value = {
      ...matchRow,
      registration_open: Boolean(matchRow.registration_open),
    } as Match;

    // Load stages
    stages.value = await db.getAll<Stage>(
      'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
      [matchId],
    );

    // Check if registered
    if (authStore.user) {
      const regs = await db.getAll<{ id: string }>(
        'SELECT id FROM registrations WHERE match_id = ? AND user_id = ?',
        [matchId, authStore.user.id],
      );
      isRegistered.value = regs.length > 0;

      // Load own scores
      if (isRegistered.value) {
        const myReg = await db.getAll<{ id: string }>(
          'SELECT id FROM registrations WHERE match_id = ? AND user_id = ?',
          [matchId, authStore.user.id],
        );
        if (myReg.length > 0) {
          myScores.value = await db.getAll<Score>(
            'SELECT * FROM scores WHERE match_id = ? AND registration_id = ?',
            [matchId, myReg[0].id],
          );
        }
      }
    }

    // Load match results
    try {
      const resultRows = await db.getAll<{ results: string }>(
        'SELECT results FROM match_results WHERE match_id = ?',
        [matchId],
      );
      matchResults.value = resultRows.flatMap((r) => JSON.parse(r.results) as MatchResultEntry[]);
    } catch {
      matchResults.value = [];
    }

    // For matches the shooter isn't registered in, PowerSync only syncs the
    // match row (not stages/results). Those are public, so fill the gaps from
    // the public API so any match's results are viewable.
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
  } finally {
    loading.value = false;
  }
});
</script>
