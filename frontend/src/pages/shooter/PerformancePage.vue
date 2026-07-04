<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-md">My Performance</div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Empty / not-yet-claimed -->
    <q-card
      v-else-if="!perf || perf.totals.matches === 0"
      flat
      bordered
      class="q-pa-lg text-center"
    >
      <q-icon name="insights" size="3em" color="grey-5" class="q-mb-sm" />
      <div class="text-subtitle1 text-weight-medium">No match history yet</div>
      <div class="text-grey-7 q-mt-xs">
        Once you've shot a match (and claimed your record), your accuracy,
        hit-factor and placement analytics show up here.
      </div>
      <q-btn
        class="q-mt-md"
        color="primary"
        unelevated
        label="Find & claim my record"
        to="/auth/register"
      />
    </q-card>

    <template v-else>
      <!-- Career summary -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div v-for="c in summaryCards" :key="c.label" class="col-6 col-sm-4 col-md">
          <q-card flat bordered class="text-center q-pa-sm">
            <div class="text-h6 text-weight-bold text-primary">{{ c.value }}</div>
            <div class="text-caption text-grey-7">{{ c.label }}</div>
          </q-card>
        </div>
      </div>

      <!-- Accuracy vs speed -->
      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-xs">
          Accuracy vs. speed
        </div>
        <div class="text-caption text-grey-7 q-mb-md">
          On average, how your points and pace compare to each stage winner.
        </div>
        <div class="q-mb-sm">
          <div class="row items-center q-mb-xs">
            <div class="col">Accuracy — your points</div>
            <div class="col-auto text-weight-medium">{{ pct(perf.totals.avg_accuracy_factor) }}</div>
          </div>
          <q-linear-progress
            :value="bar(perf.totals.avg_accuracy_factor)"
            color="teal"
            size="14px"
            rounded
          />
        </div>
        <div>
          <div class="row items-center q-mb-xs">
            <div class="col">Speed — your pace</div>
            <div class="col-auto text-weight-medium">{{ pct(perf.totals.avg_speed_factor) }}</div>
          </div>
          <q-linear-progress
            :value="bar(perf.totals.avg_speed_factor)"
            color="deep-orange"
            size="14px"
            rounded
          />
        </div>
        <q-banner v-if="focusText" dense class="bg-blue-1 rounded-borders q-mt-md">
          <template #avatar><q-icon name="lightbulb" color="amber-8" /></template>
          {{ focusText }}
        </q-banner>
      </q-card>

      <!-- Trends -->
      <q-card v-if="perf.trend.length >= 2" flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Trends</div>
        <div class="row q-col-gutter-md">
          <div v-for="t in trendCharts" :key="t.label" class="col-12 col-sm-4">
            <div class="text-caption text-grey-7">
              {{ t.label }} <span class="text-weight-medium text-grey-9">· latest {{ t.last }}</span>
            </div>
            <svg :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" class="spark" preserveAspectRatio="none">
              <polyline :points="t.points" fill="none" :stroke="t.color" stroke-width="2" />
              <circle :cx="t.lastX" :cy="t.lastY" r="2.5" :fill="t.color" />
            </svg>
          </div>
        </div>
        <div class="row q-gutter-xs q-mt-sm">
          <q-chip dense square color="grey-2" text-color="grey-9" icon="star">
            Best match {{ perf.personal_best.match_pct?.toFixed(1) }}%
          </q-chip>
          <q-chip dense square color="grey-2" text-color="grey-9" icon="emoji_events">
            Best finish {{ ordinal(perf.personal_best.finish) }}
          </q-chip>
          <q-chip v-if="perf.personal_best.hit_factor" dense square color="grey-2" text-color="grey-9" icon="bolt">
            Best HF {{ perf.personal_best.hit_factor.toFixed(2) }}
          </q-chip>
        </div>
      </q-card>

      <!-- Past matches -->
      <div class="text-subtitle1 text-weight-medium q-mb-xs">Past matches</div>
      <div class="text-caption text-grey-6 q-mb-sm">
        A = alpha % · pts = your points vs the winner · pace = your speed vs the
        winner · ± = stage-to-stage consistency (lower = steadier) · top % =
        percentile
      </div>
      <q-card
        v-for="m in perf.matches"
        :key="m.match_id + m.division"
        flat
        bordered
        class="q-mb-sm cursor-pointer"
        @click="$router.push(`/shooter/matches/${m.match_id}`)"
      >
        <q-card-section class="q-py-sm">
          <div class="row items-center">
            <div class="col">
              <div class="text-weight-medium">{{ m.match_name }}</div>
              <div class="text-caption text-grey-7">
                {{ formatDate(m.match_date) }} ·
                {{ divLabel(m.organization, m.division) }}
              </div>
            </div>
            <div class="col-auto text-right">
              <div class="text-weight-bold" :class="placeClass(m.place)">
                {{ m.dqed ? 'DQ' : ordinal(m.place) }}
                <span class="text-grey-6 text-caption">/ {{ m.field_size }}</span>
              </div>
              <div class="text-caption text-grey-7">{{ m.total_percentage.toFixed(1) }}%</div>
            </div>
          </div>
          <div class="row items-center q-gutter-sm q-mt-xs text-caption text-grey-8">
            <div v-if="m.alpha_pct !== null">
              A {{ m.alpha_pct.toFixed(0) }}%
              <q-tooltip>Alpha hits — % of your hits in the A zone</q-tooltip>
            </div>
            <div v-if="m.accuracy_factor !== null">
              pts {{ (m.accuracy_factor * 100).toFixed(0) }}%
              <q-tooltip>Accuracy — your points as a % of the stage winner's</q-tooltip>
            </div>
            <div v-if="m.speed_factor !== null">
              pace {{ (m.speed_factor * 100).toFixed(0) }}%
              <q-tooltip>Speed — your pace as a % of the stage winner's</q-tooltip>
            </div>
            <div v-if="m.consistency !== null">
              ± {{ m.consistency.toFixed(1) }} swing
              <q-tooltip>
                Consistency — how much your stage %s varied (standard deviation).
                Lower = you shot every stage at a similar level.
              </q-tooltip>
            </div>
            <div v-if="m.stage_wins > 0" class="text-teal">{{ m.stage_wins }} stage win{{ m.stage_wins > 1 ? 's' : '' }}</div>
            <q-space />
            <q-badge color="grey-3" text-color="grey-9" :label="`top ${(100 - m.percentile).toFixed(0)}%`">
              <q-tooltip>Percentile — you placed in the top {{ (100 - m.percentile).toFixed(0) }}% of your division</q-tooltip>
            </q-badge>
          </div>
        </q-card-section>
      </q-card>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { getDivisionLabel } from '@hitfactor/shared';
import type { ShooterPerformance, Organization } from '@hitfactor/shared';

const $q = useQuasar();
const perf = ref<ShooterPerformance | null>(null);
const loading = ref(true);

const SPARK_W = 120;
const SPARK_H = 32;

onMounted(async () => {
  try {
    const { data } = await api.get<ShooterPerformance>('/api/shooter/performance');
    perf.value = data;
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load performance' });
  } finally {
    loading.value = false;
  }
});

const pct = (f: number | null): string => (f === null ? '—' : `${(f * 100).toFixed(0)}%`);
const bar = (f: number | null): number => (f === null ? 0 : Math.min(1, f));

function ordinal(n: number | null): string {
  if (n === null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
function placeClass(place: number): string {
  return place === 1 ? 'text-amber-8' : place <= 3 ? 'text-primary' : 'text-grey-9';
}
function formatDate(d: string): string {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

const summaryCards = computed(() => {
  const t = perf.value!.totals;
  return [
    { label: 'Matches', value: t.matches },
    { label: 'Best finish', value: ordinal(t.best_finish) },
    { label: 'Avg finish', value: t.avg_finish?.toFixed(1) ?? '—' },
    { label: 'Avg match %', value: t.avg_match_pct !== null ? `${t.avg_match_pct.toFixed(1)}%` : '—' },
    { label: 'Alpha %', value: t.alpha_pct !== null ? `${t.alpha_pct.toFixed(0)}%` : '—' },
    { label: 'Stage wins', value: t.stage_wins },
  ];
});

const focusText = computed(() => {
  switch (perf.value?.focus) {
    case 'speed':
      return 'Your accuracy is strong relative to your speed — the biggest gains are in shooting faster.';
    case 'accuracy':
      return 'Your speed is strong relative to your accuracy — tighten up your hits to gain points.';
    case 'balanced':
      return 'Your accuracy and speed are well balanced against the field.';
    default:
      return '';
  }
});

// Inline SVG sparklines — no charting dependency.
function sparkline(values: number[], color: string, label: string) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;
  const x = (i: number) => (n === 1 ? SPARK_W / 2 : (i / (n - 1)) * (SPARK_W - 4) + 2);
  const y = (v: number) => SPARK_H - 3 - ((v - min) / span) * (SPARK_H - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const li = n - 1;
  return {
    label,
    color,
    points,
    lastX: x(li),
    lastY: y(values[li]),
    last: values[li],
  };
}

const trendCharts = computed(() => {
  const tr = perf.value!.trend;
  return [
    { ...sparkline(tr.map((t) => t.match_pct), '#1976d2', 'Match %'), last: `${tr[tr.length - 1].match_pct.toFixed(1)}%` },
    { ...sparkline(tr.map((t) => t.avg_hf), '#e65100', 'Avg hit factor'), last: tr[tr.length - 1].avg_hf.toFixed(2) },
    {
      ...sparkline(tr.map((t) => t.alpha_pct ?? 0), '#00897b', 'Alpha %'),
      last: tr[tr.length - 1].alpha_pct !== null ? `${tr[tr.length - 1].alpha_pct!.toFixed(0)}%` : '—',
    },
  ];
});

const divLabel = (org: string, div: string): string =>
  getDivisionLabel(org as Organization, div);
</script>

<style scoped>
.spark {
  width: 100%;
  height: 40px;
  display: block;
}
</style>
