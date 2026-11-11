<template>
  <div class="viz-root">
    <!-- Legend: line keys that mirror the marks -->
    <div class="row items-center q-gutter-md q-mb-sm text-caption legend">
      <span class="key"><i class="key-line key-me" />You</span>
      <span v-if="leader && !leader.isMe" class="key">
        <i class="key-line key-leader" />{{ leader.shooter_name }} (leader)
      </span>
      <span v-if="othersCount > 0" class="key">
        <i class="key-line key-other" />Everyone else ({{ othersCount }})
      </span>
    </div>

    <div class="chart-wrap" ref="wrap">
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
        <!-- Grid + y axis -->
        <g class="grid">
          <template v-for="t in yTicks" :key="t">
            <line :x1="M.l" :x2="W - M.r" :y1="y(t)" :y2="y(t)" />
            <text :x="M.l - 8" :y="y(t) + 4" text-anchor="end" class="axis-text">
              {{ metric === 'place' ? ordinal(t) : `${t}%` }}
            </text>
          </template>
        </g>

        <!-- x axis: one tick per stage -->
        <g>
          <text
            v-for="(s, i) in progression.stages"
            :key="s.stage_id"
            :x="x(i)"
            :y="H - M.b + 18"
            text-anchor="middle"
            class="axis-text"
          >
            {{ s.stage_number }}
          </text>
          <text :x="M.l + (W - M.l - M.r) / 2" :y="H - 4" text-anchor="middle" class="axis-title">
            After stage
          </text>
        </g>

        <!-- Others: recessive context -->
        <polyline
          v-for="s in others"
          :key="s.registration_id"
          :points="path(s)"
          class="line line-other"
        />

        <!-- Leader (when it isn't you) -->
        <polyline v-if="leader && !leader.isMe" :points="path(leader)" class="line line-leader" />

        <!-- Crosshair -->
        <line
          v-if="active !== null"
          :x1="x(active)"
          :x2="x(active)"
          :y1="M.t"
          :y2="H - M.b"
          class="crosshair"
        />

        <!-- You: on top, with markers ringed in the surface colour -->
        <polyline v-if="me" :points="path(me)" class="line line-me" />
        <g v-if="me">
          <circle
            v-for="(_, i) in progression.stages"
            :key="i"
            :cx="x(i)"
            :cy="y(val(me, i))"
            :r="active === i ? 6 : 4.5"
            class="dot-me"
          />
        </g>

        <!-- Direct labels at the line ends -->
        <text
          v-for="l in endLabels"
          :key="l.text"
          :x="W - M.r + 8"
          :y="l.y + 4"
          class="end-label"
        >
          {{ l.text }}
        </text>
      </svg>

      <!-- Hover / focus readout -->
      <div
        v-if="active !== null && me"
        class="tip"
        :style="{ left: tipLeft + '%' }"
      >
        <div class="tip-title">After stage {{ progression.stages[active].stage_number }}</div>
        <div class="tip-row">
          <i class="key-line key-me" />
          <strong>{{ ordinal(me.place[active]) }}</strong>
          <span class="tip-sub">You · {{ round(me.pct[active]) }}% of leader · {{ round(me.points[active]) }} pts</span>
        </div>
        <div v-if="leader && !leader.isMe" class="tip-row">
          <i class="key-line key-leader" />
          <strong>{{ round(leader.points[active]) }} pts</strong>
          <span class="tip-sub">{{ leader.shooter_name }}</span>
        </div>
        <div class="tip-sub">{{ fieldSize }} shooters</div>
      </div>
    </div>

    <!-- Table view: every value reachable without hovering -->
    <q-expansion-item dense label="Show as table" class="q-mt-sm" header-class="text-caption text-grey-7">
      <q-markup-table flat dense separator="horizontal">
        <thead>
          <tr>
            <th class="text-left">After stage</th>
            <th class="text-right">Your place</th>
            <th class="text-right">% of leader</th>
            <th class="text-right">Your points</th>
            <th class="text-right">Leader points</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in progression.stages" :key="s.stage_id">
            <td class="text-left">{{ s.stage_number }}</td>
            <td class="text-right">{{ me ? ordinal(me.place[i]) : '–' }}</td>
            <td class="text-right">{{ me ? round(me.pct[i]) : '–' }}%</td>
            <td class="text-right">{{ me ? round(me.points[i]) : '–' }}</td>
            <td class="text-right">{{ leaderPoints(i) }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-expansion-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Progression, ProgressionShooter } from '@hitfactor/shared';

const props = defineProps<{
  progression: Progression;
  metric: 'place' | 'pct';
}>();

const W = 640;
const H = 300;
const M = { l: 44, r: 96, t: 14, b: 38 };

const wrap = ref<HTMLElement | null>(null);
const active = ref<number | null>(null);

const n = computed(() => props.progression.stages.length);
const me = computed(() => props.progression.shooters.find((s) => s.isMe) ?? null);
const leader = computed(() => props.progression.shooters[props.progression.leaderIndex] ?? null);
const others = computed(() =>
  props.progression.shooters.filter((s) => !s.isMe && s !== leader.value),
);
const othersCount = computed(() => others.value.length);
const fieldSize = computed(() => props.progression.shooters.length);

function val(s: ProgressionShooter, i: number): number {
  return props.metric === 'place' ? s.place[i] : s.pct[i];
}

// y domain: place runs 1 (top) → field size; % of leader runs to 100 (top).
const domain = computed<[number, number]>(() => {
  if (props.metric === 'place') return [1, Math.max(2, fieldSize.value)];
  let lo = 100;
  for (const s of props.progression.shooters) for (const v of s.pct) lo = Math.min(lo, v);
  return [Math.max(0, Math.floor(lo / 10) * 10 - (lo % 10 === 0 ? 10 : 0)), 100];
});

const yTicks = computed(() => {
  const [a, b] = domain.value;
  if (props.metric === 'place') {
    // Every place for a small field, otherwise evenly spaced from 1st.
    const step = b <= 10 ? 1 : Math.ceil((b - a) / 5);
    const t: number[] = [];
    for (let v = a; v <= b; v += step) t.push(v);
    return t;
  }
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
  const h = H - M.t - M.b;
  const frac = (v - a) / (b - a || 1);
  // Place: 1 at the top. % of leader: 100 at the top.
  return props.metric === 'place' ? M.t + frac * h : M.t + (1 - frac) * h;
}

function path(s: ProgressionShooter): string {
  return s.pct.map((_, i) => `${x(i)},${y(val(s, i))}`).join(' ');
}

// End labels: "You" and the leader, nudged apart if their lines finish close.
const endLabels = computed(() => {
  if (!me.value || n.value === 0) return [];
  const last = n.value - 1;
  const out = [{ text: 'You', y: y(val(me.value, last)) }];
  if (leader.value && !leader.value.isMe) {
    let ly = y(val(leader.value, last));
    if (Math.abs(ly - out[0].y) < 14) ly = out[0].y + (ly >= out[0].y ? 14 : -14);
    out.push({ text: leader.value.shooter_name, y: ly });
  }
  return out;
});

function onPointer(e: PointerEvent) {
  const svg = e.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
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
  const cur = active.value ?? n.value - 1;
  active.value = Math.min(n.value - 1, Math.max(0, cur + d));
}

const tipLeft = computed(() => {
  if (active.value === null) return 0;
  const pct = (x(active.value) / W) * 100;
  return Math.min(70, Math.max(2, pct - 10));
});

function ordinal(v: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`;
}
const round = (v: number) => Math.round(v);
function leaderPoints(i: number): string {
  return leader.value ? String(round(leader.value.points[i])) : '–';
}

const ariaLabel = computed(() => {
  if (!me.value || n.value === 0) return 'Stage by stage standings';
  const last = n.value - 1;
  return `Your standing across ${n.value} stages. After the last stage you are ${ordinal(me.value.place[last])} of ${fieldSize.value}.`;
});
</script>

<style scoped>
/* Colour roles: light values, with the dark-mode steps for the same hues. */
.viz-root {
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --grid: #e3e2de;
  --series-me: #2a78d6;
  --series-leader: #eb6834;
  --series-other: #9a9994;
}
.body--dark .viz-root {
  --surface: #1a1a19;
  --ink: #f0efec;
  --ink-2: #c3c2b7;
  --grid: #34342f;
  --series-me: #3987e5;
  --series-leader: #d95926;
  --series-other: #6f6e69;
}

.legend { color: var(--ink-2); }
.key { display: inline-flex; align-items: center; gap: 6px; }
.key-line { display: inline-block; width: 18px; height: 0; border-top: 3px solid; border-radius: 2px; }
.key-me { border-color: var(--series-me); }
.key-leader { border-color: var(--series-leader); }
.key-other { border-color: var(--series-other); border-top-width: 2px; }

.chart-wrap { position: relative; }
.chart { width: 100%; height: auto; display: block; touch-action: pan-y; outline: none; }
.chart:focus-visible { outline: 2px solid var(--series-me); outline-offset: 2px; border-radius: 4px; }

.grid line { stroke: var(--grid); stroke-width: 1; }
.axis-text { fill: var(--ink-2); font-size: 11px; }
.axis-title { fill: var(--ink-2); font-size: 11px; }
.end-label { fill: var(--ink); font-size: 12px; font-weight: 600; }

.line { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.line-other { stroke: var(--series-other); stroke-width: 1.25; opacity: 0.55; }
.line-leader { stroke: var(--series-leader); stroke-width: 2.5; }
.line-me { stroke: var(--series-me); stroke-width: 3; }
.dot-me { fill: var(--series-me); stroke: var(--surface); stroke-width: 2; }
.crosshair { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; }

.tip {
  position: absolute;
  top: 8px;
  min-width: 190px;
  max-width: 260px;
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
