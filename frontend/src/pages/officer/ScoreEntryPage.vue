<template>
  <q-page class="score-entry-page">
    <!-- The stage title + back button live in the shared app header (see
         usePageHeader), so there's no secondary toolbar here. -->

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Not assigned to score this stage -->
    <div v-else-if="!authorized" class="q-pa-md">
      <q-banner class="bg-orange-1 text-orange-10" rounded>
        <template #avatar><q-icon name="lock" color="orange-9" /></template>
        You're not assigned to score this stage. Ask a match admin to add you as
        an officer for it, then reopen this page.
      </q-banner>
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

      <!-- Pinned while scrolling: working order + current shooter + time -->
      <div class="score-sticky">
      <!-- Working order (queue) controls -->
      <div class="q-mb-md">
        <!-- No queue: squad filter + "set working order" -->
        <div v-if="!queueActive" class="row items-center q-col-gutter-sm">
          <div class="col">
            <q-select
              v-model="selectedSquadId"
              :options="squadOptions"
              label="Filter by Squad"
              emit-value
              map-options
              outlined
              dense
              clearable
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="format_list_numbered"
              label="Shooting order"
              no-caps
              unelevated
              :disable="allRegistrations.length === 0"
              @click="openBuilder"
            />
          </div>
        </div>

        <!-- Queue active: chip strip (tap to jump) + edit / clear -->
        <div v-else>
          <div class="row items-center q-mb-xs">
            <div class="text-subtitle2">Shooting order</div>
            <q-space />
            <q-btn flat dense no-caps size="sm" icon="edit" label="Edit" @click="openBuilder" />
            <q-btn flat dense no-caps size="sm" color="grey-7" icon="close" label="Clear" class="q-ml-md" @click="clearQueue" />
          </div>
          <div ref="stripRef" class="queue-strip row no-wrap q-gutter-xs q-pb-xs">
            <q-chip
              v-for="(reg, i) in navRegistrations"
              :key="reg.id"
              dense
              clickable
              :color="i === currentShooterIndex ? 'primary' : scoredRegIds.has(reg.id) ? 'green-2' : 'grey-3'"
              :text-color="i === currentShooterIndex ? 'white' : scoredRegIds.has(reg.id) ? 'green-9' : 'grey-9'"
              :icon="scoredRegIds.has(reg.id) ? 'check' : undefined"
              @click="currentShooterIndex = i"
            >
              {{ i + 1 }}. {{ reg.shooter_name }}
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Current Shooter -->
      <div class="row items-center no-wrap q-mb-md">
        <q-btn
          v-if="currentRegistration"
          round
          flat
          icon="chevron_left"
          :disable="currentShooterIndex <= 0"
          @click="prevShooter"
        />

        <!-- Active shooter -->
        <q-card
          v-if="currentRegistration"
          flat
          class="current-shooter-card col q-mx-sm text-white text-center"
          :class="existingScore ? 'bg-green-7' : 'bg-primary'"
        >
          <q-card-section class="q-py-sm">
            <div class="row items-center justify-center q-gutter-xs text-caption text-uppercase">
              <q-icon :name="existingScore ? 'check_circle' : 'my_location'" size="14px" />
              <span>{{ existingScore ? 'Scored' : 'Now scoring' }}</span>
              <q-badge
                color="white"
                :text-color="
                  currentRegistration.power_factor === 'Major'
                    ? 'deep-orange'
                    : 'blue'
                "
                :label="currentRegistration.power_factor"
                class="q-ml-xs"
              />
            </div>
            <div class="text-h6 text-weight-bold ellipsis">
              {{ currentRegistration.shooter_name }}
            </div>
            <div class="text-caption">
              {{ getDivisionLabel(organization, currentRegistration.division) }}
              <template v-if="currentRegistration.classification">
                · {{ currentRegistration.classification }}
              </template>
            </div>
            <div class="text-caption current-shooter-meta">
              Shooter {{ currentShooterIndex + 1 }} of {{ navRegistrations.length }}
              <span v-if="scoredCount > 0"> · {{ scoredCount }} scored</span>
            </div>
          </q-card-section>
        </q-card>

        <!-- Empty state -->
        <q-card v-else flat bordered class="col text-center bg-grey-1">
          <q-card-section class="q-py-lg text-grey-7">
            <q-icon name="person_off" size="28px" class="q-mb-xs" />
            <div class="text-subtitle1">
              {{ selectedSquadId ? 'No shooters in this squad' : 'No shooters registered yet' }}
            </div>
            <div class="text-caption">
              {{ selectedSquadId ? 'Clear the squad filter or pick another squad.' : 'Shooters will appear here once they register for this match.' }}
            </div>
          </q-card-section>
        </q-card>

        <q-btn
          v-if="currentRegistration"
          round
          flat
          icon="chevron_right"
          :disable="currentShooterIndex >= navRegistrations.length - 1"
          @click="nextShooter"
        />
      </div>

      <!-- Time — pinned with the shooter so it's reachable while scrolling -->
      <div
        v-if="currentRegistration"
        class="q-pb-sm"
        :class="{ 'disabled-section': form.dqed || form.dnf || scoreLocked }"
      >
        <TimeInput
          :model-value="form.time"
          @update:model-value="form.time = $event"
        />
      </div>
      </div>
      <!-- /.score-sticky -->

      <!-- Scoring form — only when a shooter is selected -->
      <template v-if="currentRegistration">
      <q-separator class="q-mb-md" />

      <!-- Locked: scored and final until a Match Admin/Master re-enables it -->
      <q-banner v-if="scoreLocked" class="bg-blue-grey-1 text-blue-grey-9 q-mb-md rounded-borders">
        <template #avatar><q-icon name="lock" color="blue-grey-7" /></template>
        <div class="text-weight-medium">Score locked</div>
        <div class="text-caption">
          <template v-if="canUnlock">This shooter has been scored. Re-enable scoring below to revise it.</template>
          <template v-else>This shooter has been scored. A Match Admin or Match Master must re-enable scoring to revise it.</template>
        </div>
      </q-banner>

      <!-- Steel (at top) — each plate is Hit (A) by default, tap to Miss (M) -->
      <div v-if="hasSteel" class="q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf || scoreLocked }">
        <div class="text-subtitle2 q-mb-xs">Steel ({{ steelState.length }})</div>
        <SteelGrid v-model="steelState" />
      </div>

      <!-- Per-target paper scoring (A/C/D/M plus per-row NS) -->
      <div class="q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf || scoreLocked }">
        <div class="text-subtitle2 q-mb-xs">Targets ({{ targetCount }})</div>
        <TargetGrid v-model="targetHits" :rounds="paperRounds" />
      </div>

      <!-- Procedural errors (rarely used → compact) -->
      <div
        class="row justify-center q-mb-md"
        :class="{ 'disabled-section': form.dqed || form.dnf || scoreLocked }"
      >
        <ZoneCounter
          label="PE"
          :count="form.procedural_count"
          color="#212121"
          compact
          @update:count="form.procedural_count = $event"
        />
      </div>

      <!-- DQ / DNF Toggles -->
      <div class="row q-gutter-md q-mb-md justify-center">
        <q-toggle v-model="form.dqed" label="DQ" color="red" size="lg" :disable="scoreLocked" />
        <q-toggle v-model="form.dnf" label="DNF" color="orange" size="lg" :disable="scoreLocked" />
      </div>

      <!-- Combined tally (steel folded into A / M) + live Hit Factor -->
      <q-separator class="q-my-md" />
      <div class="row justify-center no-wrap q-gutter-xs q-mb-md">
        <div
          v-for="z in tallyItems"
          :key="z.k"
          class="tally-box"
          :style="{ backgroundColor: z.bg, color: z.fg }"
        >
          {{ z.n }}<span class="tally-letter">{{ z.k }}</span>
        </div>
      </div>
      <div class="text-center q-mb-md">
        <div class="text-caption text-grey">Hit Factor</div>
        <div class="hf-display text-primary">{{ liveHitFactor }}</div>
      </div>

      <!-- Bottom action: Save (editable) or Unlock (locked + MA/MM) -->
      <template v-if="!scoreLocked">
        <div
          v-if="!isComplete"
          class="text-center text-orange-9 text-caption q-mb-xs"
        >
          <q-icon name="warning" size="14px" /> Incomplete — {{ incompleteReason }}
        </div>
        <q-btn
          color="primary"
          label="Save Score"
          class="full-width q-mb-md"
          size="xl"
          unelevated
          :disable="!isComplete"
          :loading="saving"
          icon="save"
          @click="confirmOpen = true"
        />
      </template>
      <q-btn
        v-else-if="canUnlock"
        color="primary"
        label="Unlock for revision"
        class="full-width q-mb-md"
        size="xl"
        unelevated
        icon="lock_open"
        :loading="unlocking"
        @click="unlockScore"
      />

      <!-- Existing score indicator (only once unlocked for a revision) -->
      <q-banner v-if="existingScore && !scoreLocked" class="bg-blue-1 q-mt-sm" rounded>
        Score already exists for this shooter. Saving will update it.
      </q-banner>
      </template>
    </div>

    <!-- Save confirmation — combined paper + steel tally for the shooter to verify -->
    <q-dialog v-model="confirmOpen">
      <q-card class="confirm-dialog">
        <q-card-section class="text-center q-pb-none">
          <div class="text-caption text-grey text-uppercase">Confirm score</div>
          <div class="text-h6 text-weight-bold ellipsis">
            {{ currentRegistration?.shooter_name }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-sm">
          <div
            v-if="form.dqed || form.dnf"
            class="text-h4 text-weight-bold text-negative text-center q-mb-md"
          >
            {{ form.dqed ? 'DQ' : 'DNF' }}
          </div>

          <!-- Combined tally in one line -->
          <div class="row justify-center no-wrap q-gutter-xs">
            <div
              v-for="z in tallyItems"
              :key="z.k"
              class="tally-box"
              :style="{ backgroundColor: z.bg, color: z.fg }"
            >
              {{ z.n }}<span class="tally-letter">{{ z.k }}</span>
            </div>
          </div>

          <!-- Time + Hit Factor -->
          <div class="row justify-center q-gutter-xl q-mt-lg">
            <div class="text-center">
              <div class="text-caption text-grey text-uppercase">Time</div>
              <div class="text-h4 text-weight-bold">
                {{ form.time.toFixed(2) }}<span class="text-subtitle1">s</span>
              </div>
            </div>
            <div class="text-center">
              <div class="text-caption text-grey text-uppercase">Hit Factor</div>
              <div class="text-h4 text-weight-bold text-primary">{{ liveHitFactor }}</div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="between" class="q-pa-md">
          <q-btn flat no-caps size="lg" label="Back" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            size="lg"
            icon="save"
            label="Confirm & Save"
            :loading="saving"
            @click="onConfirmSave"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <QueueBuilderDialog
      v-model="builderOpen"
      :participants="allRegistrations"
      :squads="squads"
      :scored-ids="scoredIdsArray"
      :organization="organization"
      :initial-order="queue"
      @start="onQueueStart"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Stage, Registration, Score, ScoreInput, ScoringType, PowerFactor, Organization } from '@hitfactor/shared';
import { computeScore, getDivisionLabel, DEFAULT_ORGANIZATION, MATCH_LEVEL_OFFICIAL_ROLES } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import { useScoreQueue } from 'src/composables/useScoreQueue';
import { setPageHeader, clearPageHeader } from 'src/composables/usePageHeader';
import QueueBuilderDialog from 'src/components/scoring/QueueBuilderDialog.vue';
import ZoneCounter from 'src/components/scoring/ZoneCounter.vue';
import TargetGrid from 'src/components/scoring/TargetGrid.vue';
import SteelGrid from 'src/components/scoring/SteelGrid.vue';
import TimeInput from 'src/components/scoring/TimeInput.vue';

const route = useRoute();
const $q = useQuasar();
let db: PowerSyncDatabase | null = null;
const authStore = useAuthStore();

const matchId = route.params.matchId as string;
const stageId = route.params.stageId as string;

const loading = ref(true);
const saving = ref(false);
// Whether this user may actually score this stage (assigned officer / match-level
// official / match admin / global admin). Mirrors the server's canUserScoreStage
// so we don't let them enter scores that would be rejected on push.
const authorized = ref(true);
const stage = ref<Stage | null>(null);
const organization = ref<Organization>(DEFAULT_ORGANIZATION);
const allRegistrations = ref<Registration[]>([]);
const squads = ref<{ id: string; squad_number: number; name: string | null }[]>([]);
const existingScores = ref<Score[]>([]);
const selectedSquadId = ref<string | null>(null);
const selectedRegistrationId = ref<string | null>(null);
const currentShooterIndex = ref(0);
const shooterSearchOptions = ref<{ label: string; value: string; caption: string; scored: boolean }[]>([]);

// Working order (queue): an opt-in, device-local ordered list of registration ids
// the officer processes for this stage. Empty = default all-shooters navigation.
const { queue, setQueue, clear: clearQueueRaw, append, contains } = useScoreQueue(matchId, stageId);
const queueActive = computed(() => queue.value.length > 0);
const builderOpen = ref(false);
const stripRef = ref<HTMLElement | null>(null);

// Keep the current shooter's chip visible and left-aligned in the queue strip as
// the officer moves with next/previous (or any jump).
function scrollCurrentIntoView() {
  const strip = stripRef.value;
  if (!strip) return;
  const chip = strip.children[currentShooterIndex.value] as HTMLElement | undefined;
  if (!chip) return;
  const sr = strip.getBoundingClientRect();
  const cr = chip.getBoundingClientRect();
  strip.scrollTo({
    left: strip.scrollLeft + (cr.left - sr.left) - 8, // 8px leading gap
    behavior: 'smooth',
  });
}
watch(currentShooterIndex, () => {
  void nextTick(scrollCurrentIntoView);
});

// Per-target paper hits: one ordered array of zones ('a'|'c'|'d'|'m'|'ns') per
// target. No-shoots ('ns') are penalty hits tagged to a target — they don't
// consume a scoring round.
const targetHits = ref<string[][]>([]);

// Steel plates: true = hit (A), false = miss (M). Defaults to all hit.
const steelState = ref<boolean[]>([]);

const form = reactive({
  procedural_count: 0,
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

// Aggregate paper zone counts derived from the per-target grid (incl. no-shoots).
const paperCounts = computed(() => {
  const c = { a: 0, c: 0, d: 0, m: 0, ns: 0 };
  for (const t of targetHits.value) {
    for (const h of t) {
      if (h in c) c[h as keyof typeof c]++;
    }
  }
  return c;
});

// Steel hit/miss counts derived from the plate toggles.
const steelHitCount = computed(() => steelState.value.filter(Boolean).length);
const steelMissCount = computed(() => steelState.value.filter((h) => !h).length);

// Combined paper + steel tally shown on the live preview and the save-confirmation.
// Steel hits fold into A, steel misses into M, alongside paper A/C/D/M/NS and
// procedural errors (PE). One row; A/C/D/M keep the pill colours, NS + PE black.
const combinedTally = computed(() => ({
  a: paperCounts.value.a + steelHitCount.value,
  c: paperCounts.value.c,
  d: paperCounts.value.d,
  m: paperCounts.value.m + steelMissCount.value,
  ns: paperCounts.value.ns,
  pe: form.procedural_count,
}));
const tallyItems = computed(() => {
  const t = combinedTally.value;
  return [
    { k: 'A', n: t.a, bg: '#21ba45', fg: 'white' },
    { k: 'C', n: t.c, bg: '#fdd835', fg: 'black' },
    { k: 'D', n: t.d, bg: '#f57c00', fg: 'white' },
    { k: 'M', n: t.m, bg: '#e53935', fg: 'white' },
    { k: 'NS', n: t.ns, bg: '#212121', fg: 'white' },
    { k: 'PE', n: t.pe, bg: '#212121', fg: 'white' },
  ];
});

// "Save Score" opens this confirmation (showing the tally for the shooter to
// verify); confirming runs the actual save.
const confirmOpen = ref(false);
async function onConfirmSave() {
  confirmOpen.value = false;
  await handleSave();
}

// ── Completeness: every required round (paper + steel) must be accounted for,
// and timed stages need a time. DQ/DNF are exempt. ───────────────────────────
const requiredPaper = computed(() =>
  paperRounds.value
    ? paperRounds.value.reduce((a, b) => a + b, 0)
    : targetCount.value * 2,
);
const enteredPaper = computed(() =>
  targetHits.value.reduce(
    (sum, t) => sum + t.filter((h) => h !== 'ns').length,
    0,
  ),
);
const steelRequired = computed(() => stage.value?.number_of_steel ?? 0);
// Every steel plate always carries a value (default hit), so steel is complete
// as soon as the plates are rendered.
const enteredSteel = computed(() => steelState.value.length);
const needsTime = computed(() => stage.value?.scoring_type !== 'fixed_time');

// Rounds = paper rounds + steel plates, combined into one progress figure.
const requiredRounds = computed(() => requiredPaper.value + steelRequired.value);
const enteredRounds = computed(
  () => enteredPaper.value + Math.min(enteredSteel.value, steelRequired.value),
);

const incompleteReason = computed<string>(() => {
  if (form.dqed || form.dnf) return '';
  if (enteredRounds.value < requiredRounds.value) {
    return `${enteredRounds.value}/${requiredRounds.value} rounds scored`;
  }
  if (needsTime.value && form.time <= 0) return 'enter a time';
  return '';
});

const isComplete = computed(() => incompleteReason.value === '');

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
  no_shoot_count: number;
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
    // No-shoots don't consume a scoring round, so append them separately.
    for (let n = 0; n < counts.no_shoot_count; n++) grid[0].push('ns');
  }
  return grid;
}

// The exact per-target layout saved with the score (jsonb → JSON string on the
// client). Returns null for legacy scores so the caller reconstructs from counts.
function layoutFromScore(
  existing: Score,
): { paper: string[][]; steel: boolean[] } | null {
  const raw = (existing as { target_hits?: unknown }).target_hits;
  if (raw == null) return null;
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (o && Array.isArray(o.paper) && Array.isArray(o.steel)) {
      return o as { paper: string[][]; steel: boolean[] };
    }
  } catch {
    // fall through to reconstruction
  }
  return null;
}

// Rebuild the steel plate toggles from stored hit/miss counts, padded to the
// stage's plate count (all-hit for the remainder / a fresh score).
function steelFromCounts(hits: number, misses: number): boolean[] {
  const arr = [
    ...Array<boolean>(hits).fill(true),
    ...Array<boolean>(misses).fill(false),
  ];
  while (arr.length < steelRequired.value) arr.push(true);
  return arr;
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

// Registration ids already scored for this stage (drives the ✓ badges + counter).
const scoredRegIds = computed(
  () =>
    new Set(
      existingScores.value
        .filter((s) => s.stage_id === stageId)
        .map((s) => s.registration_id),
    ),
);
const scoredIdsArray = computed(() => [...scoredRegIds.value]);

// The navigation source: the working order when active, else the (squad-filtered)
// full roster. Stale queued ids (registration removed) are dropped.
const navRegistrations = computed(() => {
  if (queue.value.length === 0) return filteredRegistrations.value;
  const byId = new Map(allRegistrations.value.map((r) => [r.id, r] as const));
  return queue.value
    .map((id) => byId.get(id))
    .filter((r): r is Registration => !!r);
});

const currentRegistration = computed(() => {
  return navRegistrations.value[currentShooterIndex.value] ?? null;
});

const existingScore = computed(() => {
  if (!currentRegistration.value) return null;
  return existingScores.value.find(
    (s) => s.registration_id === currentRegistration.value!.id && s.stage_id === stageId,
  ) ?? null;
});

// A scored (existing) score is locked/final; a regular officer can't edit it —
// only a Match Admin/Master (canUnlock) can re-enable scoring to revise.
const scoreLocked = computed(() => Boolean(existingScore.value?.locked));
const canUnlock = ref(false);
const unlocking = ref(false);

const currentPowerFactor = computed<PowerFactor>(() => {
  return (currentRegistration.value?.power_factor as PowerFactor) ?? 'Minor';
});

const scoreInput = computed<ScoreInput>(() => ({
  alpha_count: paperCounts.value.a,
  charlie_count: paperCounts.value.c,
  delta_count: paperCounts.value.d,
  miss_count: paperCounts.value.m,
  no_shoot_count: paperCounts.value.ns,
  procedural_count: form.procedural_count,
  steel_hits: steelHitCount.value,
  steel_misses: steelMissCount.value,
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

const scoredCount = computed(
  () => navRegistrations.value.filter((r) => scoredRegIds.value.has(r.id)).length,
);

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

// Search jumps to any shooter. With a working order active, a shooter not in it
// is appended to the end so navigation stays a single ordered list.
watch(selectedRegistrationId, (regId) => {
  if (!regId) return;
  if (queueActive.value && !contains(regId)) append(regId);
  const idx = navRegistrations.value.findIndex((r) => r.id === regId);
  if (idx >= 0) {
    currentShooterIndex.value = idx;
  }
});

// Whether the officer has unsaved edits for the currently-shown shooter. Guards
// the auto-refresh below so incoming synced data never clobbers in-progress work.
const dirty = ref(false);
// Set while we're programmatically loading a shooter's score so the dirty watcher
// doesn't count those writes as user edits.
let applying = false;

// Load a shooter's latest score into the form. `existingScores` is kept live by
// db.watch, so this always reflects the freshest data synced from the server.
function applyExisting(reg: Registration) {
  applying = true;
  const existing = existingScores.value.find(
    (s) => s.registration_id === reg.id && s.stage_id === stageId,
  );
  if (existing) {
    // Prefer the exact saved layout; fall back to reconstruction for legacy
    // scores saved before target_hits was tracked.
    const layout = layoutFromScore(existing);
    targetHits.value = layout?.paper ?? gridFromCounts(existing);
    steelState.value =
      layout?.steel ?? steelFromCounts(existing.steel_hits, existing.steel_misses);
    form.procedural_count = existing.procedural_count;
    form.time = existing.time;
    form.dqed = existing.dqed;
    form.dnf = existing.dnf;
  } else {
    resetForm();
  }
  dirty.value = false;
  void nextTick(() => {
    applying = false;
  });
}

// Navigating to a shooter always loads their latest score.
watch(currentRegistration, (reg) => {
  if (reg) applyExisting(reg);
});

// While viewing a shooter, if a newer score for them syncs in from another
// officer/device, refresh the form to the latest — unless the officer has
// unsaved edits (never overwrite in-progress scoring) or a save is in flight.
watch(existingScores, () => {
  const reg = currentRegistration.value;
  if (reg && !dirty.value && !saving.value) applyExisting(reg);
});

// Any change the officer makes marks the form dirty (skipped during programmatic
// loads), which pauses auto-refresh until they save or move on.
watch(
  [targetHits, steelState, form],
  () => {
    if (!applying) dirty.value = true;
  },
  { deep: true },
);

function resetForm() {
  targetHits.value = freshGrid();
  steelState.value = Array<boolean>(steelRequired.value).fill(true);
  form.procedural_count = 0;
  form.time = 0;
  form.dqed = false;
  form.dnf = false;
}

// After a save: in a working order, jump to the next UNSCORED shooter (scored
// ones stay in place, marked done); otherwise step to the next shooter as before.
function advanceAfterSave() {
  const regs = navRegistrations.value;
  if (!queueActive.value) {
    if (currentShooterIndex.value < regs.length - 1) currentShooterIndex.value++;
    return;
  }
  const scored = scoredRegIds.value; // reflects the just-saved score (reloaded above)
  for (let i = currentShooterIndex.value + 1; i < regs.length; i++) {
    if (!scored.has(regs[i].id)) {
      currentShooterIndex.value = i;
      return;
    }
  }
  for (let i = 0; i < regs.length; i++) {
    if (!scored.has(regs[i].id)) {
      currentShooterIndex.value = i;
      return;
    }
  }
  // Everyone in the working order is scored — stay put.
}

function prevShooter() {
  if (currentShooterIndex.value > 0) {
    currentShooterIndex.value--;
  }
}

function nextShooter() {
  if (currentShooterIndex.value < navRegistrations.value.length - 1) {
    currentShooterIndex.value++;
  }
}

// ─── Working order (queue) ──────────────────────
function openBuilder() {
  builderOpen.value = true;
}

function onQueueStart(ids: string[]) {
  setQueue(ids);
  // Start on the first shooter who isn't scored yet.
  const idx = ids.findIndex((id) => !scoredRegIds.value.has(id));
  currentShooterIndex.value = idx >= 0 ? idx : 0;
}

function clearQueue() {
  // Confirm — the Clear button sits next to the strip and is easy to hit by
  // accident; losing the working order mid-scoring is annoying.
  $q.dialog({
    title: 'Clear shooting order?',
    message:
      'This removes the shooting order and returns to all shooters. Your entered scores are not affected.',
    cancel: true,
    ok: { label: 'Clear', color: 'negative', unelevated: true },
  }).onOk(() => {
    clearQueueRaw();
    currentShooterIndex.value = 0;
  });
}

async function handleSave() {
  if (!db || !currentRegistration.value || !stage.value || !authStore.user || !isComplete.value) return;

  saving.value = true;
  try {
    const computed = computeScore(scoreInput.value, stage.value.scoring_type as ScoringType);
    const now = new Date().toISOString();
    const existing = existingScore.value;
    // Persist the exact per-target layout so a re-opened score shows M/NS on the
    // targets they were entered on (not a reconstruction from aggregate counts).
    const targetHitsJson = JSON.stringify({
      paper: targetHits.value,
      steel: steelState.value,
    });

    if (existing) {
      // Update existing score
      await db.execute(
        `UPDATE scores SET
          alpha_count = ?, charlie_count = ?, delta_count = ?, miss_count = ?,
          no_shoot_count = ?, procedural_count = ?, steel_hits = ?, steel_misses = ?,
          time = ?, raw_points = ?, penalty_points = ?, total_points = ?,
          hit_factor = ?, dqed = ?, dnf = ?, target_hits = ?, locked = 1, modified_at = ?, modified_by = ?
        WHERE id = ?`,
        [
          paperCounts.value.a, paperCounts.value.c, paperCounts.value.d, paperCounts.value.m,
          paperCounts.value.ns, form.procedural_count, steelHitCount.value, steelMissCount.value,
          form.time, computed.raw_points, computed.penalty_points, computed.total_points,
          computed.hit_factor, form.dqed ? 1 : 0, form.dnf ? 1 : 0, targetHitsJson, now, authStore.user.id,
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
          scored_by, scored_at, verified, dqed, dnf, target_hits, locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id, matchId, stageId, currentRegistration.value.id,
          currentRegistration.value.shooter_name, currentRegistration.value.division,
          currentRegistration.value.power_factor,
          paperCounts.value.a, paperCounts.value.c, paperCounts.value.d, paperCounts.value.m,
          paperCounts.value.ns, form.procedural_count, steelHitCount.value, steelMissCount.value,
          form.time, computed.raw_points, computed.penalty_points, computed.total_points,
          computed.hit_factor, authStore.user.id, now, 0, form.dqed ? 1 : 0, form.dnf ? 1 : 0, targetHitsJson,
        ],
      );
    }

    // Saved — no unsaved edits remain, so auto-refresh may resume.
    dirty.value = false;

    // Reload existing scores
    const scores = await db.getAll<Score>(
      'SELECT * FROM scores WHERE match_id = ? AND stage_id = ?',
      [matchId, stageId],
    );
    existingScores.value = scores;

    $q.notify({ type: 'positive', message: 'Score saved!', position: 'top' });

    advanceAfterSave();
    // Scroll back to the top so the officer sees the next shooter's name.
    void nextTick(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch (err) {
    console.error('Save score error:', err);
    $q.notify({ type: 'negative', message: 'Failed to save score', position: 'top' });
  } finally {
    saving.value = false;
  }
}

// Client-side mirror of the server's canUserScoreStage: global admin, match
// admin, a match-level official, or a stage officer for THIS stage. If the local
// db isn't ready we don't block (the server still enforces on push).
async function isAuthorizedToScore(): Promise<boolean> {
  if (authStore.isAdmin) return true;
  if (!db || !authStore.user) return true;
  const uid = authStore.user.id;
  const admin = await db.getAll(
    'SELECT 1 FROM match_admins WHERE match_id = ? AND user_id = ? LIMIT 1',
    [matchId, uid],
  );
  if (admin.length) return true;
  const mo = await db.getAll<{ role: string }>(
    'SELECT role FROM match_officers WHERE match_id = ? AND user_id = ?',
    [matchId, uid],
  );
  if (mo.some((r) => (MATCH_LEVEL_OFFICIAL_ROLES as readonly string[]).includes(r.role))) {
    return true;
  }
  const so = await db.getAll(
    'SELECT 1 FROM stage_officers WHERE stage_id = ? AND user_id = ? LIMIT 1',
    [stageId, uid],
  );
  return so.length > 0;
}

// Whether the user may re-enable scoring on a locked score: ONLY a Match Admin
// (MA) or Match Master (MM) officer on this match — not a global admin or the
// match creator. Re-enabling a score is a per-match workflow control. (Mirrors
// the server's canUnlockScore.)
async function isUnlockAllowed(): Promise<boolean> {
  if (!db || !authStore.user) return false;
  const rows = await db.getAll(
    "SELECT 1 FROM match_officers WHERE match_id = ? AND user_id = ? AND role IN ('MA', 'MM') LIMIT 1",
    [matchId, authStore.user.id],
  );
  return rows.length > 0;
}

// Match Admin/Master re-enables scoring for a revision (server re-checks).
async function unlockScore() {
  if (!db || !existingScore.value || !authStore.user) return;
  unlocking.value = true;
  try {
    await db.execute(
      'UPDATE scores SET locked = 0, modified_at = ?, modified_by = ? WHERE id = ?',
      [new Date().toISOString(), authStore.user.id, existingScore.value.id],
    );
    $q.notify({
      type: 'positive',
      message: 'Scoring re-enabled — this score can now be revised',
      position: 'top',
    });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to unlock', position: 'top' });
  } finally {
    unlocking.value = false;
  }
}

// Drive the shared app header: back arrow (→ officer dashboard) + stage title,
// replacing the hamburger + "HitFactor". Placeholder title until the stage loads.
setPageHeader('Scoring', '/officer/dashboard');
onUnmounted(clearPageHeader);

onMounted(async () => {
  // PowerSync connects asynchronously after login; inject('powerSyncDb') only
  // ever yields the boot-time null, so wait for the real connected db here.
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  // Gate scoring on an actual assignment (mirrors the server check). Re-runs when
  // an assignment syncs in, so an officer assigned moments earlier isn't blocked.
  authorized.value = await isAuthorizedToScore();
  canUnlock.value = await isUnlockAllowed();
  db.watch(
    'SELECT 1 FROM stage_officers WHERE stage_id = ? AND user_id = ? UNION ALL ' +
      'SELECT 1 FROM match_officers WHERE match_id = ? AND user_id = ? UNION ALL ' +
      'SELECT 1 FROM match_admins WHERE match_id = ? AND user_id = ?',
    [stageId, authStore.user?.id ?? '', matchId, authStore.user?.id ?? '', matchId, authStore.user?.id ?? ''],
    {
      onResult: () => {
        void isAuthorizedToScore().then((v) => { authorized.value = v; });
        void isUnlockAllowed().then((v) => { canUnlock.value = v; });
      },
    },
  );

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

    setPageHeader(
      `Stage ${stage.value.stage_number}: ${stage.value.name}`,
      '/officer/dashboard',
    );

    // Initialise an empty per-target grid + all-hit steel for the loaded stage.
    targetHits.value = freshGrid();
    steelState.value = Array<boolean>(stage.value.number_of_steel).fill(true);

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

    // Resume a persisted working order at the first shooter not yet scored.
    if (queueActive.value) {
      const idx = navRegistrations.value.findIndex(
        (r) => !scoredRegIds.value.has(r.id),
      );
      currentShooterIndex.value = idx >= 0 ? idx : 0;
    }

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

/* Save-confirmation dialog: roomy, with large colored tally boxes. */
.confirm-dialog {
  width: 460px;
  max-width: 96vw;
}
/* Compact enough that all six (A C D M NS PE) fit on one line on a phone. */
.tally-box {
  flex: 1 1 0;
  min-width: 0;
  max-width: 3.4rem;
  padding: 8px 2px;
  border-radius: 8px;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
  text-align: center;
}
.tally-box .tally-letter {
  font-size: 0.8rem;
  font-weight: 700;
  margin-left: 1px;
}

/* Working order + current shooter + time stay pinned below the app header while
   the targets/paper/proc sections scroll underneath. Negative gutters let the
   white background cover the page's padding edge-to-edge. */
.score-sticky {
  position: sticky;
  top: calc(50px + env(safe-area-inset-top, 0px));
  z-index: 5;
  background: #fff;
  margin: 0 -16px;
  padding: 8px 16px 0;
  box-shadow: 0 6px 6px -6px rgba(0, 0, 0, 0.25);
}

/* Horizontally-scrollable strip of queued shooters. */
.queue-strip {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.queue-strip .q-chip {
  flex: 0 0 auto;
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
