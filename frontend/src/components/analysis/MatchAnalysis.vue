<template>
  <div>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="2.5em" />
    </div>

    <q-card v-else-if="!perf" flat bordered class="q-pa-lg text-center text-grey-7">
      <q-icon name="insights" size="42px" color="grey-5" class="q-mb-sm" />
      <div class="text-subtitle1 q-mb-xs">Your analysis will show up here</div>
      <div class="text-caption">
        Once you've been scored on a stage and results are in, you'll see how
        your match went, stage by stage.
      </div>
    </q-card>

    <template v-else>
      <!-- Several divisions: pick which entry to analyse -->
      <q-btn-toggle
        v-if="regs.length > 1"
        v-model="regId"
        no-caps
        dense
        unelevated
        toggle-color="primary"
        class="q-mb-md"
        :options="regs.map((r) => ({ label: r.division, value: r.id }))"
      />

      <!-- Headline -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div v-for="c in headline" :key="c.label" class="col-6 col-sm-3">
          <q-card flat bordered class="text-center q-pa-sm">
            <div class="text-h6 text-weight-bold text-primary">{{ c.value }}</div>
            <div class="text-caption text-grey-7">{{ c.label }}</div>
          </q-card>
        </div>
      </div>

      <!-- What went well / where you lost ground -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">
                <q-icon name="thumb_up" color="positive" class="q-mr-xs" />What went well
              </div>
              <div v-if="insights.strengths.length === 0" class="text-caption text-grey-7">
                No standout stages this time — keep stacking clean runs.
              </div>
              <div v-for="s in insights.strengths" :key="s.stage_id" class="q-mb-sm">
                <div class="text-weight-medium">{{ stageLabel(s.stage_id, s.stage_number) }}</div>
                <div class="text-body2 text-grey-8">{{ strengthText(s) }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle1 text-weight-medium q-mb-sm">
                <q-icon name="trending_down" color="warning" class="q-mr-xs" />Where you lost ground
              </div>
              <div v-if="insights.weaknesses.length === 0" class="text-caption text-grey-7">
                Nothing stands out as a weak spot — your stages were even.
              </div>
              <div v-for="s in insights.weaknesses" :key="s.stage_id" class="q-mb-sm">
                <div class="text-weight-medium">{{ stageLabel(s.stage_id, s.stage_number) }}</div>
                <div class="text-body2 text-grey-8">{{ weaknessText(s) }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-banner v-if="focusText" dense rounded class="bg-blue-1 q-mb-md">
        <template #avatar><q-icon name="lightbulb" color="amber-8" /></template>
        {{ focusText }}
      </q-banner>

      <!-- Stage by stage vs the field -->
      <q-card v-if="progression.stages.length > 0" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <div class="text-subtitle1 text-weight-medium">How your match unfolded</div>
            <q-space />
            <q-btn-toggle
              v-model="metric"
              no-caps
              dense
              unelevated
              toggle-color="primary"
              :options="[
                { label: 'Running place', value: 'place' },
                { label: '% of leader', value: 'pct' },
              ]"
            />
          </div>
          <div class="text-caption text-grey-7 q-mb-sm">
            {{
              metric === 'place'
                ? 'Your place after each stage, against everyone in your division. Higher is better.'
                : "Your running points as a share of the leader's after each stage. 100% means you were leading."
            }}
          </div>
          <ProgressionChart :progression="progression" :metric="metric" />
        </q-card-section>
      </q-card>

      <!-- Stage-by-stage table -->
      <q-card flat bordered>
        <q-card-section class="q-pb-none">
          <div class="text-subtitle1 text-weight-medium">Stage by stage</div>
        </q-card-section>
        <q-markup-table flat dense separator="horizontal">
          <thead>
            <tr>
              <th class="text-left">Stage</th>
              <th class="text-right">Place</th>
              <th class="text-right">Stage %</th>
              <th class="text-right">Points down</th>
              <th class="text-right">A hits</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in perf.stages" :key="s.stage_id">
              <td class="text-left">{{ stageLabel(s.stage_id, s.stage_number) }}</td>
              <td class="text-right">{{ s.dqed || s.dnf ? '–' : s.place }}</td>
              <td class="text-right">{{ s.dqed || s.dnf ? '–' : `${s.stage_percentage}%` }}</td>
              <td class="text-right">{{ s.dqed || s.dnf ? '–' : s.points_down }}</td>
              <td class="text-right">{{ s.alpha_pct === null ? '–' : `${s.alpha_pct}%` }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';
import {
  buildMatchInsights,
  buildProgression,
  computeShooterPerformance,
} from '@hitfactor/shared';
import type {
  MatchPerfBundle,
  MatchResultEntry,
  StageInsight,
  StageResultEntry,
} from '@hitfactor/shared';
import ProgressionChart from './ProgressionChart.vue';

const props = defineProps<{
  matchId: string;
  matchName: string;
  matchDate: string;
  organization: string;
}>();

const auth = useAuthStore();
const abort = new AbortController();

const loading = ref(true);
const regs = ref<{ id: string; division: string }[]>([]);
const regId = ref<string | null>(null);
const stageRows = ref<{ id: string; stage_number: number; max_points: number }[]>([]);
const stageResultRows = ref<{ stage_id: string; division: string; results: string }[]>([]);
const matchResultRows = ref<{ division: string; results: string }[]>([]);
const metric = ref<'place' | 'pct'>('place');

function rows<T>(res: { rows?: { _array?: unknown[] } }): T[] {
  return (res.rows?._array as T[] | undefined) ?? [];
}

onMounted(async () => {
  const db = await whenPowerSyncReady();
  if (!db || !auth.user) {
    loading.value = false;
    return;
  }
  const opts = { signal: abort.signal };
  // All reactive, so the analysis updates live as scores and results sync in.
  db.watch(
    'SELECT id, division FROM registrations WHERE match_id = ? AND user_id = ?',
    [props.matchId, auth.user.id],
    {
      onResult: (r) => {
        regs.value = rows(r);
        if (!regId.value || !regs.value.some((x) => x.id === regId.value)) {
          regId.value = regs.value[0]?.id ?? null;
        }
      },
    },
    opts,
  );
  db.watch(
    'SELECT id, stage_number, max_points FROM stages WHERE match_id = ?',
    [props.matchId],
    { onResult: (r) => (stageRows.value = rows(r)) },
    opts,
  );
  db.watch(
    'SELECT stage_id, division, results FROM stage_results WHERE match_id = ?',
    [props.matchId],
    { onResult: (r) => (stageResultRows.value = rows(r)) },
    opts,
  );
  db.watch(
    'SELECT division, results FROM match_results WHERE match_id = ?',
    [props.matchId],
    {
      onResult: (r) => {
        matchResultRows.value = rows(r);
        loading.value = false;
      },
      onError: () => (loading.value = false),
    },
    opts,
  );
  // Don't spin forever if nothing has synced yet.
  setTimeout(() => (loading.value = false), 4000);
});
onUnmounted(() => abort.abort());

function parse<T>(json: string): T[] {
  try {
    return JSON.parse(json) as T[];
  } catch {
    return [];
  }
}

const reg = computed(() => regs.value.find((r) => r.id === regId.value) ?? null);

const bundle = computed<MatchPerfBundle | null>(() => {
  const r = reg.value;
  if (!r) return null;
  return {
    match_id: props.matchId,
    match_name: props.matchName,
    match_date: props.matchDate,
    organization: props.organization,
    division: r.division,
    registration_id: r.id,
    match_results: matchResultRows.value
      .filter((m) => m.division === r.division)
      .flatMap((m) => parse<MatchResultEntry>(m.results)),
    stages: stageRows.value.map((s) => ({
      stage_id: s.id,
      stage_number: Number(s.stage_number),
      max_points: Number(s.max_points),
      results: stageResultRows.value
        .filter((x) => x.stage_id === s.id && x.division === r.division)
        .flatMap((x) => parse<StageResultEntry>(x.results)),
    })),
  };
});

const perf = computed(() => {
  if (!bundle.value) return null;
  return computeShooterPerformance([bundle.value]).matches[0] ?? null;
});

const progression = computed(() =>
  buildProgression(bundle.value?.stages ?? [], reg.value?.id ?? ''),
);

const insights = computed(() =>
  perf.value
    ? buildMatchInsights(perf.value)
    : { strengths: [], weaknesses: [], focus: null },
);

function ordinal(v: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}

const headline = computed(() => {
  const p = perf.value;
  if (!p) return [];
  return [
    { label: 'Place', value: p.dqed ? 'DQ' : `${ordinal(p.place)} of ${p.field_size}` },
    { label: 'Match %', value: `${p.total_percentage}%` },
    { label: 'Match points', value: String(p.match_points) },
    { label: 'Stage wins', value: String(p.stage_wins) },
  ];
});

function stageLabel(_id: string, n: number): string {
  return `Stage ${n}`;
}

const pctOf = (v: number | null) => (v === null ? null : Math.round(v * 100));

function strengthText(s: StageInsight): string {
  if (s.place === 1) return 'You won this stage — the best hit factor in your division.';
  return `${Math.round(s.stage_percentage)}% of the stage winner, one of your strongest stages (${ordinal(s.place)}).`;
}

function weaknessText(s: StageInsight): string {
  if (s.cause === 'unscored') return 'No score was recorded here (DQ or did not finish).';
  const acc = pctOf(s.accuracy_factor);
  const spd = pctOf(s.speed_factor);
  const both = acc !== null && spd !== null;
  const base = `${Math.round(s.stage_percentage)}% of the stage winner (${ordinal(s.place)}).`;
  if (s.cause === 'accuracy' && both) {
    return `${base} Points were the bigger gap: ${acc}% of the winner's points against ${spd}% of their pace. Cleaner hits are the quickest gain.`;
  }
  if (s.cause === 'speed' && both) {
    return `${base} Pace was the bigger gap: ${spd}% of the winner's speed against ${acc}% of their points. Moving faster between positions would help.`;
  }
  if (both) return `${base} You were behind on both points (${acc}%) and pace (${spd}%).`;
  return base;
}

const focusText = computed(() => {
  switch (insights.value.focus) {
    case 'accuracy':
      return 'Over the match, you gave up more to accuracy than to speed. Cleaner hits are where the next points are.';
    case 'speed':
      return 'Over the match, you gave up more to speed than to accuracy. Your hits were good — pushing the pace is where the next points are.';
    case 'balanced':
      return 'Accuracy and speed were about even for you this match. Improving either one moves you up.';
    default:
      return '';
  }
});
</script>
