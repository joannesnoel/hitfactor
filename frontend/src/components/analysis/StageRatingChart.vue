<template>
  <div class="viz-root">
    <div class="row items-center q-gutter-md q-mb-sm text-caption legend">
      <span class="key"><i class="key-line key-me" />{{ meLabel }}</span>
      <span class="key"><i class="key-line key-avg" />Field average</span>
      <span class="key"><i class="key-line key-base" />Best of the rest (100%)</span>
    </div>

    <div class="chart-wrap">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="chart"
        role="img"
        tabindex="0"
        :aria-label="ariaLabel"
        @pointermove="onPointer"
        @pointerleave="active = null"
        @keydown.left.prevent="step(-1)"
        @keydown.right.prevent="step(1)"
        @focus="active = active ?? n - 1"
        @blur="active = null"
      >
        <g class="grid">
          <template v-for="t in yTicks" :key="t">
            <line :x1="M.l" :x2="W - M.r" :y1="y(t)" :y2="y(t)" :class="{ base: t === 100 }" />
            <text :x="M.l - 8" :y="y(t) + 4" text-anchor="end" class="axis-text">{{ t }}%</text>
          </template>
        </g>

        <text
          v-for="(s, i) in ratings"
          :key="s.stage_id"
          :x="x(i)"
          :y="H - M.b + 18"
          text-anchor="middle"
          class="axis-text"
        >
          {{ s.stage_number }}
        </text>
        <text :x="M.l + (W - M.l - M.r) / 2" :y="H - 4" text-anchor="middle" class="axis-text">Stage</text>

        <line
          v-if="active !== null"
          :x1="x(active)"
          :x2="x(active)"
          :y1="M.t"
          :y2="H - M.b"
          class="crosshair"
        />

        <polyline :points="path(avgVals)" class="line line-avg" />
        <polyline :points="path(meVals)" class="line line-me" />
        <circle
          v-for="(v, i) in meVals"
          :key="i"
          :cx="x(i)"
          :cy="y(v)"
          :r="active === i ? 6 : 4.5"
          class="dot-me"
        />

        <text v-for="l in endLabels" :key="l.text" :x="W - M.r + 8" :y="l.y + 4" class="end-label">
          {{ l.text }}
        </text>
      </svg>

      <div v-if="active !== null" class="tip" :style="{ left: tipLeft + '%' }">
        <div class="tip-title">Stage {{ ratings[active].stage_number }}</div>
        <div class="tip-row">
          <i class="key-line key-me" />
          <strong>{{ round(meVals[active]) }}%</strong>
          <span class="tip-sub">{{ meLabel }} · {{ raw(ratings[active].me) }}</span>
        </div>
        <div class="tip-row">
          <i class="key-line key-base" />
          <strong>100%</strong>
          <span class="tip-sub">{{ bestName(ratings[active]) }} · {{ rawBest(ratings[active]) }}</span>
        </div>
        <div class="tip-row">
          <i class="key-line key-avg" />
          <strong>{{ round(avgVals[active]) }}%</strong>
          <span class="tip-sub">Field average · {{ raw(ratings[active].avg) }}</span>
        </div>
      </div>
    </div>

    <q-expansion-item dense label="Show as table" class="q-mt-sm" header-class="text-caption text-grey-7">
      <q-markup-table flat dense separator="horizontal">
        <thead>
          <tr>
            <th class="text-left">Stage</th>
            <th class="text-right">{{ meLabel }}</th>
            <th class="text-right">Best of rest</th>
            <th class="text-right">Avg</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in ratings" :key="s.stage_id">
            <td class="text-left">{{ s.stage_number }}</td>
            <td class="text-right">{{ round(meVals[i]) }}%</td>
            <td class="text-right">{{ rawBest(s) }}</td>
            <td class="text-right">{{ round(avgVals[i]) }}%</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-expansion-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { RatingMetric, StageRating } from '@hitfactor/shared';

const props = withDefaults(
  defineProps<{
    /** Stages with a rating for the chosen measure (none missing). */
    ratings: StageRating[];
    metric: RatingMetric;
    meLabel?: string;
  }>(),
  { meLabel: 'You' },
);

const W = 640;
const H = 280;
const M = { l: 48, r: 92, t: 14, b: 38 };

const active = ref<number | null>(null);
const n = computed(() => props.ratings.length);

const meVals = computed(() => props.ratings.map((r) => r.rating[props.metric] ?? 0));
const avgVals = computed(() => props.ratings.map((r) => r.avgRating[props.metric] ?? 0));

// Always includes the 100% baseline, with a little room around the data.
const domain = computed<[number, number]>(() => {
  const all = [...meVals.value, ...avgVals.value, 100];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return [Math.max(0, Math.floor((lo - 5) / 10) * 10), Math.ceil((hi + 5) / 10) * 10];
});

const yTicks = computed(() => {
  const [a, b] = domain.value;
  // A step that divides 100, so the 100% baseline is always one of the ticks.
  const step = [10, 20, 25, 50].find((st) => (b - a) / st <= 6) ?? 50;
  const t: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) t.push(v);
  return t;
});

function x(i: number): number {
  const w = W - M.l - M.r;
  return n.value <= 1 ? M.l + w / 2 : M.l + (i * w) / (n.value - 1);
}
function y(v: number): number {
  const [a, b] = domain.value;
  return M.t + (1 - (v - a) / (b - a || 1)) * (H - M.t - M.b);
}
const path = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');

// End labels, nudged apart so they never overlap.
const endLabels = computed(() => {
  if (n.value === 0) return [];
  const last = n.value - 1;
  const items = [
    { text: props.meLabel, y: y(meVals.value[last]) },
    { text: 'Field avg', y: y(avgVals.value[last]) },
    { text: 'Best rest', y: y(100) },
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    if (items[i].y - items[i - 1].y < 14) items[i].y = items[i - 1].y + 14;
  }
  return items;
});

function onPointer(e: PointerEvent) {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n.value; i++) {
    const d = Math.abs(x(i) - px);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  active.value = best;
}
function step(d: number) {
  active.value = Math.min(n.value - 1, Math.max(0, (active.value ?? n.value - 1) + d));
}
const tipLeft = computed(() =>
  active.value === null ? 0 : Math.min(60, Math.max(2, (x(active.value) / W) * 100 - 12)),
);

const round = (v: number) => Math.round(v);

// The measure's raw value, for the readout (points, time, or hit factor).
function raw(s: { points: number; time: number; hit_factor: number }): string {
  if (props.metric === 'points') return `${Math.round(s.points)} pts`;
  if (props.metric === 'speed') return `${s.time.toFixed(2)}s`;
  return `HF ${s.hit_factor.toFixed(2)}`;
}
function bestName(s: StageRating): string {
  if (props.metric === 'points') return s.best.points.name;
  if (props.metric === 'speed') return s.best.time.name;
  return s.best.hit_factor.name;
}
function rawBest(s: StageRating): string {
  if (props.metric === 'points') return `${Math.round(s.best.points.value)} pts`;
  if (props.metric === 'speed') return `${s.best.time.value.toFixed(2)}s`;
  return `HF ${s.best.hit_factor.value.toFixed(2)}`;
}

const ariaLabel = computed(() => {
  if (n.value === 0) return 'Stage ratings';
  const last = n.value - 1;
  return `${props.meLabel} rated ${round(meVals.value[last])}% of the best of the rest on stage ${props.ratings[last].stage_number}, across ${n.value} stages.`;
});
</script>

<style scoped>
.viz-root {
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --grid: #e3e2de;
  --series-me: #2a78d6;
  --series-avg: #9a9994;
}
.body--dark .viz-root {
  --surface: #1a1a19;
  --ink: #f0efec;
  --ink-2: #c3c2b7;
  --grid: #34342f;
  --series-me: #3987e5;
  --series-avg: #6f6e69;
}
.legend { color: var(--ink-2); }
.key { display: inline-flex; align-items: center; gap: 6px; }
.key-line { display: inline-block; width: 18px; height: 0; border-top: 3px solid; border-radius: 2px; }
.key-me { border-color: var(--series-me); }
.key-avg { border-color: var(--series-avg); border-top-width: 2px; }
.key-base { border-top: 2px dashed var(--ink-2); }

.chart-wrap { position: relative; }
.chart { width: 100%; height: auto; display: block; touch-action: pan-y; outline: none; }
.chart:focus-visible { outline: 2px solid var(--series-me); outline-offset: 2px; border-radius: 4px; }
.grid line { stroke: var(--grid); stroke-width: 1; }
.grid line.base { stroke: var(--ink-2); stroke-dasharray: 5 4; }
.axis-text { fill: var(--ink-2); font-size: 11px; }
.end-label { fill: var(--ink); font-size: 12px; font-weight: 600; }
.line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.line-avg { stroke: var(--series-avg); stroke-width: 2; opacity: 0.8; }
.line-me { stroke: var(--series-me); stroke-width: 3; }
.dot-me { fill: var(--series-me); stroke: var(--surface); stroke-width: 2; }
.crosshair { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.tip {
  position: absolute;
  top: 8px;
  min-width: 190px;
  max-width: 250px;
  padding: 8px 10px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--grid);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  pointer-events: none;
}
.tip-title { font-weight: 600; margin-bottom: 4px; }
.tip-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.tip-row strong { font-size: 14px; }
.tip-sub { color: var(--ink-2); }
</style>
