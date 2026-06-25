<template>
  <q-page class="score-entry-page">
    <!-- Stage Info Header -->
    <q-toolbar class="bg-blue-grey-9 text-white">
      <q-btn flat round dense icon="arrow_back" @click="$router.back()" />
      <q-toolbar-title v-if="stage" class="text-center">
        Stage {{ stage.stage_number }}: {{ stage.name }}
      </q-toolbar-title>
      <SyncStatusIndicator />
    </q-toolbar>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else class="q-pa-md">
      <!-- Shooter Search -->
      <q-select
        v-model="selectedRegistrationId"
        :options="shooterSearchOptions"
        label="Search shooter..."
        use-input
        input-debounce="100"
        emit-value
        map-options
        outlined
        dense
        class="q-mb-sm"
        @filter="filterShooters"
      >
        <template #option="{ itemProps, opt }">
          <q-item v-bind="itemProps">
            <q-item-section>
              <q-item-label>{{ opt.label }}</q-item-label>
              <q-item-label caption>{{ opt.caption }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon
                v-if="opt.scored"
                name="check_circle"
                color="green"
                size="xs"
              />
            </q-item-section>
          </q-item>
        </template>
        <template #no-option>
          <q-item>
            <q-item-section class="text-grey">No shooters found</q-item-section>
          </q-item>
        </template>
      </q-select>

      <!-- Squad Filter -->
      <q-select
        v-model="selectedSquadId"
        :options="squadOptions"
        label="Filter by Squad"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="q-mb-md"
      />

      <!-- Current Shooter -->
      <div class="row items-center no-wrap q-mb-md">
        <q-btn
          round
          flat
          icon="chevron_left"
          :disable="currentShooterIndex <= 0"
          @click="prevShooter"
        />
        <q-card
          flat
          class="current-shooter-card col q-mx-sm text-white text-center"
          :class="existingScore ? 'bg-green-7' : 'bg-primary'"
        >
          <q-card-section class="q-py-sm">
            <div class="row items-center justify-center q-gutter-xs text-caption text-uppercase">
              <q-icon name="my_location" size="14px" />
              <span>Now scoring</span>
              <q-badge
                v-if="existingScore"
                color="white"
                text-color="green-8"
                label="scored"
                class="q-ml-xs"
              />
            </div>
            <div v-if="currentRegistration" class="text-h6 text-weight-bold ellipsis">
              {{ currentRegistration.shooter_name }}
            </div>
            <div v-else class="text-subtitle1 q-py-xs">No shooters registered</div>
            <div v-if="currentRegistration" class="text-caption">
              {{ getDivisionLabel(organization, currentRegistration.division) }}
              · {{ currentRegistration.power_factor }}
              <template v-if="currentRegistration.classification">
                · {{ currentRegistration.classification }}
              </template>
            </div>
            <div class="text-caption current-shooter-meta">
              Shooter {{ currentShooterIndex + 1 }} of {{ filteredRegistrations.length }}
              <span v-if="scoredCount > 0"> · {{ scoredCount }} scored</span>
            </div>
          </q-card-section>
        </q-card>
        <q-btn
          round
          flat
          icon="chevron_right"
          :disable="currentShooterIndex >= filteredRegistrations.length - 1"
          @click="nextShooter"
        />
      </div>

      <q-separator class="q-mb-md" />

      <!-- DQ / DNF Toggles -->
      <div class="row q-gutter-md q-mb-md justify-center">
        <q-toggle
          v-model="form.dqed"
          label="DQ"
          color="red"
          size="lg"
        />
        <q-toggle
          v-model="form.dnf"
          label="DNF"
          color="orange"
          size="lg"
        />
      </div>

      <!-- Per-target paper scoring -->
      <div class="q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf }">
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-subtitle2">Targets ({{ targetCount }})</div>
          <div class="text-caption text-grey">Paper: {{ paperSummary }}</div>
        </div>
        <TargetGrid v-model="targetHits" :rounds="paperRounds" />
      </div>

      <!-- No-shoots / Procedurals -->
      <div
        class="row justify-center q-gutter-md q-mb-md"
        :class="{ 'disabled-section': form.dqed || form.dnf }"
      >
        <ZoneCounter
          label="NS"
          :count="form.no_shoot_count"
          color="#607d8b"
          @update:count="form.no_shoot_count = $event"
        />
        <ZoneCounter
          label="Proc"
          :count="form.procedural_count"
          color="#795548"
          @update:count="form.procedural_count = $event"
        />
      </div>

      <!-- Steel Counters -->
      <div v-if="hasSteel" class="row justify-center q-gutter-md q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf }">
        <ZoneCounter
          label="Steel Hits"
          :count="form.steel_hits"
          color="#4caf50"
          @update:count="form.steel_hits = $event"
        />
        <ZoneCounter
          label="Steel Misses"
          :count="form.steel_misses"
          color="#f44336"
          @update:count="form.steel_misses = $event"
        />
      </div>

      <!-- Time Input -->
      <div :class="{ 'disabled-section': form.dqed || form.dnf }">
        <TimeInput
          :model-value="form.time"
          @update:model-value="form.time = $event"
        />
      </div>

      <!-- Live HF Preview -->
      <q-separator class="q-my-md" />
      <div class="text-center q-mb-md">
        <div class="text-caption text-grey">Hit Factor</div>
        <div class="hf-display text-primary">{{ liveHitFactor }}</div>
        <div class="row justify-center q-gutter-md text-caption text-grey q-mt-xs">
          <span>Raw: {{ liveScore.raw_points }}</span>
          <span>Penalty: {{ liveScore.penalty_points }}</span>
          <span>Total: {{ liveScore.total_points }}</span>
        </div>
      </div>

      <!-- Save Button -->
      <q-btn
        color="primary"
        label="Save Score"
        class="full-width q-mb-md"
        size="xl"
        unelevated
        :disable="!currentRegistration"
        :loading="saving"
        icon="save"
        @click="handleSave"
      />

      <!-- Existing score indicator -->
      <q-banner v-if="existingScore" class="bg-blue-1 q-mt-sm" rounded>
        Score already exists for this shooter. Saving will update it.
      </q-banner>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Stage, Registration, Score, ScoreInput, ScoringType, PowerFactor, Organization } from '@hitfactor/shared';
import { computeScore, getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import ZoneCounter from 'src/components/scoring/ZoneCounter.vue';
import TargetGrid from 'src/components/scoring/TargetGrid.vue';
import TimeInput from 'src/components/scoring/TimeInput.vue';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';

const route = useRoute();
const $q = useQuasar();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();

const matchId = route.params.matchId as string;
const stageId = route.params.stageId as string;

const loading = ref(true);
const saving = ref(false);
const stage = ref<Stage | null>(null);
const organization = ref<Organization>(DEFAULT_ORGANIZATION);
const allRegistrations = ref<Registration[]>([]);
const squads = ref<{ id: string; squad_number: number; name: string | null }[]>([]);
const existingScores = ref<Score[]>([]);
const selectedSquadId = ref<string | null>(null);
const selectedRegistrationId = ref<string | null>(null);
const currentShooterIndex = ref(0);
const shooterSearchOptions = ref<{ label: string; value: string; caption: string; scored: boolean }[]>([]);

// Per-target paper hits: one ordered array of zones ('a'|'c'|'d'|'m') per target.
const targetHits = ref<string[][]>([]);

const form = reactive({
  no_shoot_count: 0,
  procedural_count: 0,
  steel_hits: 0,
  steel_misses: 0,
  time: 0,
  dqed: false,
  dnf: false,
});

const targetCount = computed(() => stage.value?.number_of_targets ?? 0);
const paperRounds = computed<number[] | null>(() => {
  // PowerSync stores jsonb columns as JSON strings in local SQLite, so this can
  // be a string like "[2, 2, 2]" rather than a parsed array — parse defensively.
  const raw = stage.value?.paper_target_rounds as unknown;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
});

// Aggregate paper zone counts derived from the per-target grid.
const paperCounts = computed(() => {
  const c = { a: 0, c: 0, d: 0, m: 0 };
  for (const t of targetHits.value) {
    for (const h of t) {
      if (h in c) c[h as keyof typeof c]++;
    }
  }
  return c;
});

const paperSummary = computed(() => {
  const c = paperCounts.value;
  const parts = (['a', 'c', 'd', 'm'] as const)
    .filter((z) => c[z])
    .map((z) => `${c[z]}${z.toUpperCase()}`);
  return parts.length ? parts.join('  ') : 'No hits';
});

function freshGrid(): string[][] {
  return Array.from({ length: targetCount.value }, () => [] as string[]);
}

// Rebuild a valid per-target grid from saved aggregate counts (for re-opening an
// existing score — the exact arrangement isn't stored, but the totals, and thus
// the hit factor, are preserved).
function gridFromCounts(counts: {
  alpha_count: number;
  charlie_count: number;
  delta_count: number;
  miss_count: number;
}): string[][] {
  const pool: string[] = [
    ...Array<string>(counts.alpha_count).fill('a'),
    ...Array<string>(counts.charlie_count).fill('c'),
    ...Array<string>(counts.delta_count).fill('d'),
    ...Array<string>(counts.miss_count).fill('m'),
  ];
  const grid = freshGrid();
  let p = 0;
  for (let i = 0; i < grid.length && p < pool.length; i++) {
    const cap = paperRounds.value?.[i] ?? 2;
    while (grid[i].length < cap && p < pool.length) grid[i].push(pool[p++]);
  }
  if (grid.length > 0) {
    while (p < pool.length) grid[grid.length - 1].push(pool[p++]);
  }
  return grid;
}

const hasSteel = computed(() => {
  if (!stage.value) return false;
  return stage.value.number_of_steel > 0;
});

const squadOptions = computed(() => {
  const opts = [{ label: 'All Squads', value: null as string | null }];
  for (const s of squads.value) {
    opts.push({
      label: `Squad ${s.squad_number}${s.name ? ` - ${s.name}` : ''}`,
      value: s.id,
    });
  }
  return opts;
});

const filteredRegistrations = computed(() => {
  if (!selectedSquadId.value) return allRegistrations.value;
  return allRegistrations.value.filter((r) => r.squad_id === selectedSquadId.value);
});

const currentRegistration = computed(() => {
  return filteredRegistrations.value[currentShooterIndex.value] ?? null;
});

const existingScore = computed(() => {
  if (!currentRegistration.value) return null;
  return existingScores.value.find(
    (s) => s.registration_id === currentRegistration.value!.id && s.stage_id === stageId,
  ) ?? null;
});

const currentPowerFactor = computed<PowerFactor>(() => {
  return (currentRegistration.value?.power_factor as PowerFactor) ?? 'Minor';
});

const scoreInput = computed<ScoreInput>(() => ({
  alpha_count: paperCounts.value.a,
  charlie_count: paperCounts.value.c,
  delta_count: paperCounts.value.d,
  miss_count: paperCounts.value.m,
  no_shoot_count: form.no_shoot_count,
  procedural_count: form.procedural_count,
  steel_hits: form.steel_hits,
  steel_misses: form.steel_misses,
  time: form.time,
  power_factor: currentPowerFactor.value,
  dqed: form.dqed,
  dnf: form.dnf,
}));

const liveScore = computed(() => {
  if (!stage.value) return { raw_points: 0, penalty_points: 0, total_points: 0, hit_factor: 0 };
  return computeScore(scoreInput.value, stage.value.scoring_type as ScoringType);
});

const liveHitFactor = computed(() => liveScore.value.hit_factor.toFixed(4));

const scoredCount = computed(() => {
  const stageScoreRegIds = new Set(
    existingScores.value.filter((s) => s.stage_id === stageId).map((s) => s.registration_id),
  );
  return filteredRegistrations.value.filter((r) => stageScoreRegIds.has(r.id)).length;
});

function filterShooters(val: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = val.toLowerCase();
    const scoredRegIds = new Set(
      existingScores.value.filter((s) => s.stage_id === stageId).map((s) => s.registration_id),
    );
    const source = needle
      ? allRegistrations.value.filter(
          (r) =>
            r.shooter_name.toLowerCase().includes(needle) ||
            (r.member_number && r.member_number.toLowerCase().includes(needle)),
        )
      : allRegistrations.value;
    shooterSearchOptions.value = source.map((r) => ({
      label: r.shooter_name,
      value: r.id,
      caption: `${getDivisionLabel(organization.value, r.division)} | ${r.power_factor}${r.member_number ? ` | #${r.member_number}` : ''}`,
      scored: scoredRegIds.has(r.id),
    }));
  });
}

// When shooter selected via search, jump to that shooter in the list
watch(selectedRegistrationId, (regId) => {
  if (!regId) return;
  const idx = filteredRegistrations.value.findIndex((r) => r.id === regId);
  if (idx >= 0) {
    currentShooterIndex.value = idx;
  }
});

// Load existing score when shooter changes
watch(currentRegistration, (reg) => {
  if (!reg) return;
  const existing = existingScores.value.find(
    (s) => s.registration_id === reg.id && s.stage_id === stageId,
  );
  if (existing) {
    targetHits.value = gridFromCounts(existing);
    form.no_shoot_count = existing.no_shoot_count;
    form.procedural_count = existing.procedural_count;
    form.steel_hits = existing.steel_hits;
    form.steel_misses = existing.steel_misses;
    form.time = existing.time;
    form.dqed = existing.dqed;
    form.dnf = existing.dnf;
  } else {
    resetForm();
  }
});

function resetForm() {
  targetHits.value = freshGrid();
  form.no_shoot_count = 0;
  form.procedural_count = 0;
  form.steel_hits = 0;
  form.steel_misses = 0;
  form.time = 0;
  form.dqed = false;
  form.dnf = false;
}

function prevShooter() {
  if (currentShooterIndex.value > 0) {
    currentShooterIndex.value--;
  }
}

function nextShooter() {
  if (currentShooterIndex.value < filteredRegistrations.value.length - 1) {
    currentShooterIndex.value++;
  }
}

async function handleSave() {
  if (!db || !currentRegistration.value || !stage.value || !authStore.user) return;

  saving.value = true;
  try {
    const computed = computeScore(scoreInput.value, stage.value.scoring_type as ScoringType);
    const now = new Date().toISOString();
    const existing = existingScore.value;

    if (existing) {
      // Update existing score
      await db.execute(
        `UPDATE scores SET
          alpha_count = ?, charlie_count = ?, delta_count = ?, miss_count = ?,
          no_shoot_count = ?, procedural_count = ?, steel_hits = ?, steel_misses = ?,
          time = ?, raw_points = ?, penalty_points = ?, total_points = ?,
          hit_factor = ?, dqed = ?, dnf = ?, modified_at = ?, modified_by = ?
        WHERE id = ?`,
        [
          paperCounts.value.a, paperCounts.value.c, paperCounts.value.d, paperCounts.value.m,
          form.no_shoot_count, form.procedural_count, form.steel_hits, form.steel_misses,
          form.time, computed.raw_points, computed.penalty_points, computed.total_points,
          computed.hit_factor, form.dqed ? 1 : 0, form.dnf ? 1 : 0, now, authStore.user.id,
          existing.id,
        ],
      );
    } else {
      // Insert new score
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO scores (
          id, match_id, stage_id, registration_id, shooter_name, division,
          power_factor, alpha_count, charlie_count, delta_count, miss_count,
          no_shoot_count, procedural_count, steel_hits, steel_misses,
          time, raw_points, penalty_points, total_points, hit_factor,
          scored_by, scored_at, verified, dqed, dnf
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, matchId, stageId, currentRegistration.value.id,
          currentRegistration.value.shooter_name, currentRegistration.value.division,
          currentRegistration.value.power_factor,
          paperCounts.value.a, paperCounts.value.c, paperCounts.value.d, paperCounts.value.m,
          form.no_shoot_count, form.procedural_count, form.steel_hits, form.steel_misses,
          form.time, computed.raw_points, computed.penalty_points, computed.total_points,
          computed.hit_factor, authStore.user.id, now, 0, form.dqed ? 1 : 0, form.dnf ? 1 : 0,
        ],
      );
    }

    // Reload existing scores
    const scores = await db.getAll<Score>(
      'SELECT * FROM scores WHERE match_id = ? AND stage_id = ?',
      [matchId, stageId],
    );
    existingScores.value = scores;

    $q.notify({ type: 'positive', message: 'Score saved!', position: 'top' });

    // Auto-advance to next shooter
    if (currentShooterIndex.value < filteredRegistrations.value.length - 1) {
      currentShooterIndex.value++;
    }
  } catch (err) {
    console.error('Save score error:', err);
    $q.notify({ type: 'negative', message: 'Failed to save score', position: 'top' });
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  // PowerSync connects asynchronously after login; inject('powerSyncDb') only
  // ever yields the boot-time null, so wait for the real connected db here.
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  try {
    // Load stage
    const stageRow = await db.get<Stage>(
      'SELECT * FROM stages WHERE id = ?',
      [stageId],
    );
    stage.value = {
      ...stageRow,
      stage_number: Number(stageRow.stage_number),
      min_rounds: Number(stageRow.min_rounds),
      max_points: Number(stageRow.max_points),
      number_of_targets: Number(stageRow.number_of_targets),
      number_of_steel: Number(stageRow.number_of_steel),
      number_of_no_shoots: Number(stageRow.number_of_no_shoots),
      fixed_time: stageRow.fixed_time != null ? Number(stageRow.fixed_time) : null,
      is_classifier: Boolean(stageRow.is_classifier),
    } as Stage;

    // Initialise an empty per-target grid for the loaded stage.
    targetHits.value = freshGrid();

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

    // Load squads
    squads.value = await db.getAll(
      'SELECT * FROM squads WHERE match_id = ? ORDER BY squad_number',
      [matchId],
    );

    // Load existing scores for this stage
    existingScores.value = await db.getAll<Score>(
      'SELECT * FROM scores WHERE match_id = ? AND stage_id = ?',
      [matchId, stageId],
    );

    // Initial registrations load
    allRegistrations.value = await db.getAll<Registration>(
      'SELECT * FROM registrations WHERE match_id = ? ORDER BY shooter_name',
      [matchId],
    );

    // Watch for new registrations syncing in (e.g. shooters registering during match)
    db.watch(
      'SELECT * FROM registrations WHERE match_id = ? ORDER BY shooter_name',
      [matchId],
      {
        onResult: (result) => { allRegistrations.value = result.rows?._array ?? []; },
      },
    );

    // Watch for score changes from other officers
    db.watch(
      'SELECT * FROM scores WHERE match_id = ? AND stage_id = ?',
      [matchId, stageId],
      {
        onResult: (result) => { existingScores.value = result.rows?._array ?? []; },
      },
    );
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.score-entry-page {
  max-width: 600px;
  margin: 0 auto;
}

.disabled-section {
  opacity: 0.4;
  pointer-events: none;
}

.current-shooter-card {
  border-radius: 12px;
  min-width: 0;
}

.current-shooter-meta {
  opacity: 0.8;
}
</style>
