<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-md">My Performance</div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- No matches shot yet -->
    <q-card
      v-else-if="perf.totals.matches === 0"
      flat
      bordered
      class="q-pa-lg text-center"
    >
      <q-icon name="insights" size="3em" color="grey-5" class="q-mb-sm" />
      <div class="text-subtitle1 text-weight-medium">Shoot a match to see your stats</div>
      <div class="text-grey-7 q-mt-xs">
        After you've been scored in a match, your results, strengths and
        progress over time show up here. It all works offline.
      </div>
      <div class="row justify-center q-gutter-sm q-mt-md">
        <q-btn color="primary" unelevated no-caps label="Find a match" to="/dashboard" />
        <q-btn color="primary" outline no-caps label="Host a match" to="/host/create" />
      </div>
    </q-card>

    <template v-else>
      <!-- Summary -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div v-for="c in summaryCards" :key="c.label" class="col-6 col-sm-4 col-md">
          <q-card flat bordered class="text-center q-pa-sm">
            <div class="text-h6 text-weight-bold text-primary">{{ c.value }}</div>
            <div class="text-caption text-grey-7">{{ c.label }}</div>
          </q-card>
        </div>
      </div>

      <!-- Accuracy vs speed -->
      <q-card v-if="hasFactors" flat bordered class="q-pa-md q-mb-md">
        <div class="text-subtitle1 text-weight-medium q-mb-xs">Accuracy vs. speed</div>
        <div class="text-caption text-grey-7 q-mb-md">
          On average, how your points and pace compare to each stage winner.
        </div>
        <div class="q-mb-sm">
          <div class="row items-center q-mb-xs">
            <div class="col">Accuracy — your points</div>
            <div class="col-auto text-weight-medium">{{ pct(perf.totals.avg_accuracy_factor) }}</div>
          </div>
          <q-linear-progress :value="bar(perf.totals.avg_accuracy_factor)" color="teal" size="14px" rounded />
        </div>
        <div>
          <div class="row items-center q-mb-xs">
            <div class="col">Speed — your pace</div>
            <div class="col-auto text-weight-medium">{{ pct(perf.totals.avg_speed_factor) }}</div>
          </div>
          <q-linear-progress :value="bar(perf.totals.avg_speed_factor)" color="deep-orange" size="14px" rounded />
        </div>
        <q-banner v-if="focusText" dense class="bg-blue-1 rounded-borders q-mt-md">
          <template #avatar><q-icon name="lightbulb" color="amber-8" /></template>
          {{ focusText }}
        </q-banner>
      </q-card>

      <!-- Progress over time -->
      <q-card v-if="perf.trend.length >= 2" flat bordered class="q-pa-md q-mb-md">
        <div class="row items-center q-mb-xs">
          <div class="text-subtitle1 text-weight-medium">Your progress</div>
          <q-space />
          <q-btn-toggle
            v-model="trendMetric"
            no-caps
            dense
            unelevated
            toggle-color="primary"
            :options="[
              { label: 'Match %', value: 'match_pct' },
              { label: 'Alpha %', value: 'alpha_pct' },
            ]"
          />
        </div>
        <div class="text-caption text-grey-7 q-mb-sm">
          {{
            trendMetric === 'match_pct'
              ? "How close you finished to each match's winner (100% = the winner)."
              : 'The share of your hits that were in the A zone.'
          }}
        </div>
        <TrendChart
          v-if="trendPoints.length >= 2"
          :points="trendPoints"
          :metric-label="trendMetric === 'match_pct' ? 'Match %' : 'Alpha %'"
          unit="%"
        />
        <div v-else class="text-caption text-grey-7">Not enough matches with this stat yet.</div>
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

      <!-- Matches -->
      <div class="text-subtitle1 text-weight-medium q-mb-xs">Your matches</div>
      <div class="text-caption text-grey-6 q-mb-sm">Tap a match for your stage-by-stage analysis.</div>
      <q-card
        v-for="m in perf.matches"
        :key="m.match_id + m.division"
        flat
        bordered
        class="q-mb-sm cursor-pointer"
        @click="$router.push({ path: `/matches/${m.match_id}`, query: { tab: 'analysis' } })"
      >
        <q-card-section class="q-py-sm">
          <div class="row items-center no-wrap">
            <div class="col" style="min-width: 0">
              <div class="row items-center no-wrap">
                <div class="text-weight-medium ellipsis">{{ m.match_name }}</div>
                <q-chip
                  v-if="hostedIds.has(m.match_id)"
                  dense
                  size="sm"
                  color="teal"
                  text-color="white"
                  icon="manage_accounts"
                  label="Host"
                  class="q-ml-sm"
                />
              </div>
              <div class="text-caption text-grey-7">
                {{ formatDate(m.match_date) }} · {{ divLabel(m.organization, m.division) }}
              </div>
            </div>
            <div class="col-auto text-right q-ml-sm">
              <div class="text-weight-bold" :class="placeClass(m.place)">
                {{ m.dqed ? 'DQ' : ordinal(m.place) }}
                <span class="text-grey-6 text-caption">of {{ m.field_size }}</span>
              </div>
              <div class="text-caption text-grey-7">{{ m.total_percentage.toFixed(1) }}%</div>
            </div>
          </div>
          <div class="row items-center q-gutter-sm q-mt-xs text-caption text-grey-8">
            <div v-if="m.alpha_pct !== null">
              Alpha {{ m.alpha_pct.toFixed(0) }}%
              <q-tooltip>The share of your hits that were in the A zone</q-tooltip>
            </div>
            <div v-if="m.accuracy_factor !== null">
              Points {{ (m.accuracy_factor * 100).toFixed(0) }}%
              <q-tooltip>Your points as a % of each stage winner's</q-tooltip>
            </div>
            <div v-if="m.speed_factor !== null">
              Pace {{ (m.speed_factor * 100).toFixed(0) }}%
              <q-tooltip>Your pace as a % of each stage winner's</q-tooltip>
            </div>
            <div v-if="m.stage_wins > 0" class="text-teal">
              {{ m.stage_wins }} stage win{{ m.stage_wins > 1 ? 's' : '' }}
            </div>
            <q-space />
            <q-icon name="chevron_right" color="grey-5" />
          </div>
        </q-card-section>
      </q-card>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getDivisionLabel } from '@hitfactor/shared';
import type { Organization } from '@hitfactor/shared';
import { useMyPerformance } from 'src/composables/useMyPerformance';
import { useMyMatchRoles } from 'src/composables/useMyMatchRoles';
import TrendChart from 'src/components/analysis/TrendChart.vue';

// Computed on the phone from synced results — hosted/private matches included.
const { perf, loading } = useMyPerformance();
const { hostedIds } = useMyMatchRoles();

const trendMetric = ref<'match_pct' | 'alpha_pct'>('match_pct');

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
const divLabel = (org: string, div: string): string => getDivisionLabel(org as Organization, div);

const hasFactors = computed(
  () => perf.value.totals.avg_accuracy_factor !== null || perf.value.totals.avg_speed_factor !== null,
);

const summaryCards = computed(() => {
  const t = perf.value.totals;
  const finished = perf.value.matches.filter((m) => !m.dqed);
  const wins = finished.filter((m) => m.place === 1).length;
  const podiums = finished.filter((m) => m.place <= 3).length;
  return [
    { label: 'Matches', value: t.matches },
    { label: 'Wins', value: wins },
    { label: 'Podiums', value: podiums },
    { label: 'Avg match %', value: t.avg_match_pct !== null ? `${t.avg_match_pct.toFixed(1)}%` : '—' },
    { label: 'Stage wins', value: t.stage_wins },
    { label: 'Alpha %', value: t.alpha_pct !== null ? `${t.alpha_pct.toFixed(0)}%` : '—' },
  ];
});

const focusText = computed(() => {
  switch (perf.value.focus) {
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

const trendPoints = computed(() =>
  perf.value.trend
    .map((t) => ({
      label: t.match_name,
      date: t.date,
      value: trendMetric.value === 'match_pct' ? t.match_pct : t.alpha_pct,
    }))
    .filter((p): p is { label: string; date: string; value: number } => p.value !== null),
);
</script>
