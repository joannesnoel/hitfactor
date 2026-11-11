<template>
  <div class="viz-root">
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
            <line :x1="M.l" :x2="W - M.r" :y1="y(t)" :y2="y(t)" />
            <text :x="M.l - 8" :y="y(t) + 4" text-anchor="end" class="axis-text">{{ t }}{{ unit }}</text>
          </template>
        </g>

        <!-- x labels: first, last and a few between, so dates never collide -->
        <text
          v-for="i in labelIndexes"
          :key="i"
          :x="x(i)"
          :y="H - M.b + 18"
          text-anchor="middle"
          class="axis-text"
        >
          {{ shortDate(points[i].date) }}
        </text>

        <line
          v-if="active !== null"
          :x1="x(active)"
          :x2="x(active)"
          :y1="M.t"
          :y2="H - M.b"
          class="crosshair"
        />

        <polyline :points="path" class="line" />
        <circle
          v-for="(p, i) in points"
          :key="i"
          :cx="x(i)"
          :cy="y(p.value)"
          :r="active === i ? 6 : 4.5"
          class="dot"
        />
        <text :x="x(n - 1) + 10" :y="y(points[n - 1].value) + 4" class="end-label">
          {{ round(points[n - 1].value) }}{{ unit }}
        </text>
      </svg>

      <div v-if="active !== null" class="tip" :style="{ left: tipLeft + '%' }">
        <div class="tip-title">{{ points[active].label }}</div>
        <div class="tip-row">
          <i class="key-line" />
          <strong>{{ round(points[active].value) }}{{ unit }}</strong>
          <span class="tip-sub">{{ metricLabel }}</span>
        </div>
        <div class="tip-sub">{{ longDate(points[active].date) }}</div>
      </div>
    </div>

    <q-expansion-item dense label="Show as table" class="q-mt-sm" header-class="text-caption text-grey-7">
      <q-markup-table flat dense separator="horizontal">
        <thead>
          <tr>
            <th class="text-left">Match</th>
            <th class="text-left">Date</th>
            <th class="text-right">{{ metricLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in points" :key="i">
            <td class="text-left">{{ p.label }}</td>
            <td class="text-left">{{ longDate(p.date) }}</td>
            <td class="text-right">{{ round(p.value) }}{{ unit }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-expansion-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export interface TrendPoint {
  label: string;
  date: string;
  value: number;
}

const props = defineProps<{
  points: TrendPoint[]; // oldest first
  metricLabel: string;
  unit?: string;
}>();

const W = 640;
const H = 240;
const M = { l: 46, r: 56, t: 14, b: 34 };

const active = ref<number | null>(null);
const n = computed(() => props.points.length);
const unit = computed(() => props.unit ?? '');

// Always show 0–100 style ranges tightly around the data, with room above.
const domain = computed<[number, number]>(() => {
  const vs = props.points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const floor = Math.max(0, Math.floor((lo - 5) / 10) * 10);
  const ceil = Math.min(100, Math.max(floor + 10, Math.ceil((hi + 2) / 10) * 10));
  return [floor, ceil];
});

const yTicks = computed(() => {
  const [a, b] = domain.value;
  const step = b - a > 50 ? 20 : 10;
  const t: number[] = [];
  for (let v = a; v <= b; v += step) t.push(v);
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

const path = computed(() => props.points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '));

const labelIndexes = computed(() => {
  const count = n.value;
  if (count <= 8) return Array.from({ length: count }, (_, i) => i);
  const idx = new Set([0, count - 1]);
  for (let k = 1; k < 4; k++) idx.add(Math.round((k * (count - 1)) / 4));
  return [...idx].sort((a, b) => a - b);
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
const tipLeft = computed(() => {
  if (active.value === null) return 0;
  return Math.min(68, Math.max(2, (x(active.value) / W) * 100 - 10));
});

const round = (v: number) => Math.round(v * 10) / 10;
function shortDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function longDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const ariaLabel = computed(
  () =>
    `${props.metricLabel} across ${n.value} matches. Latest ${round(props.points[n.value - 1].value)}${unit.value}.`,
);
</script>

<style scoped>
.viz-root {
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --grid: #e3e2de;
  --series: #2a78d6;
}
.body--dark .viz-root {
  --surface: #1a1a19;
  --ink: #f0efec;
  --ink-2: #c3c2b7;
  --grid: #34342f;
  --series: #3987e5;
}
.chart-wrap { position: relative; }
.chart { width: 100%; height: auto; display: block; touch-action: pan-y; outline: none; }
.chart:focus-visible { outline: 2px solid var(--series); outline-offset: 2px; border-radius: 4px; }
.grid line { stroke: var(--grid); stroke-width: 1; }
.axis-text { fill: var(--ink-2); font-size: 11px; }
.end-label { fill: var(--ink); font-size: 12px; font-weight: 600; }
.line { fill: none; stroke: var(--series); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.dot { fill: var(--series); stroke: var(--surface); stroke-width: 2; }
.crosshair { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; }
.tip {
  position: absolute;
  top: 8px;
  min-width: 170px;
  max-width: 240px;
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
.key-line { display: inline-block; width: 18px; height: 0; border-top: 3px solid var(--series); border-radius: 2px; }
</style>
