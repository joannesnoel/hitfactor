<template>
  <div class="target-grid">
    <div
      v-for="(hits, i) in modelValue"
      :key="i"
      class="target-row row items-center no-wrap q-py-xs"
      v-touch-hold:500.mouse="() => clearRow(i)"
    >
      <div class="target-label text-weight-bold">T{{ i + 1 }}</div>
      <div class="zone-group col row q-gutter-xs no-wrap q-ml-sm">
        <q-btn
          v-for="z in ZONES"
          :key="z.k"
          :style="pillStyle(z, countOf(hits, z.k), scoringCount(hits) >= roundsFor(i))"
          dense
          unelevated
          class="zone-btn"
          @click="add(i, z.k)"
        >
          {{ z.label
          }}<span v-if="countOf(hits, z.k) > 1" class="zone-count">{{
            countOf(hits, z.k)
          }}</span>
        </q-btn>
      </div>
    </div>
    <div class="text-caption text-grey-6 q-mt-xs">
      Tip: press &amp; hold a row to clear it.
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string[][];
    rounds?: number[] | null;
    defaultRounds?: number;
  }>(),
  { rounds: null, defaultRounds: 2 },
);

const emit = defineEmits<{ 'update:modelValue': [string[][]] }>();

// A/C/D/M are scoring hits (limited to the target's round count); NS is a
// no-shoot penalty tagged to the target — it doesn't consume a scoring round.
// Colors: A green, C yellow, D orange, M red, NS red (deeper, to stay distinct).
// `edge` is a readable-on-white variant used for the outline/text before the
// zone is scored (plain yellow is illegible on white).
const ZONES = [
  { k: 'a', label: 'A', color: '#21ba45', textColor: 'white', edge: '#1a9c39' },
  { k: 'c', label: 'C', color: '#fdd835', textColor: 'black', edge: '#c9a400' },
  { k: 'd', label: 'D', color: '#f57c00', textColor: 'white', edge: '#e06f00' },
  { k: 'm', label: 'M', color: '#e53935', textColor: 'white', edge: '#d32f2f' },
  { k: 'ns', label: 'NS', color: '#212121', textColor: 'white', edge: '#212121' },
];

type Zone = (typeof ZONES)[number];

function roundsFor(i: number): number {
  return props.rounds?.[i] ?? props.defaultRounds;
}

// Scoring hits only (excludes no-shoots), which is what the round limit counts.
function scoringCount(hits: string[]): number {
  return hits.filter((h) => h !== 'ns').length;
}

function countOf(hits: string[], k: string): number {
  return hits.filter((h) => h === k).length;
}

// Pills are white/outlined until that zone is scored on the target, then they
// fill with the zone color. Unscored A/C/D/M dim once the row's rounds are full.
function pillStyle(z: Zone, count: number, full: boolean): Record<string, string> {
  const border = `1px solid ${z.edge}`;
  if (count > 0) {
    return { backgroundColor: z.color, color: z.textColor, border };
  }
  const base: Record<string, string> = {
    backgroundColor: '#fff',
    color: z.edge,
    border,
  };
  if (full && z.k !== 'ns') base.opacity = '0.4';
  return base;
}

function clone(): string[][] {
  return props.modelValue.map((t) => [...t]);
}

// A long-press fires touch-hold and then a trailing click; suppress that click
// (briefly) so holding a pill clears the row instead of also adding a hit.
let suppressClick = false;

function add(i: number, zone: string) {
  if (suppressClick) return;
  if (zone !== 'ns' && scoringCount(props.modelValue[i]) >= roundsFor(i)) return;
  const next = clone();
  next[i].push(zone);
  emit('update:modelValue', next);
}

// Press-and-hold anywhere on a target row clears all its hits (A/C/D/M/NS).
function clearRow(i: number) {
  suppressClick = true;
  window.setTimeout(() => {
    suppressClick = false;
  }, 400);
  if (props.modelValue[i].length === 0) return;
  const next = clone();
  next[i] = [];
  emit('update:modelValue', next);
}

</script>

<style scoped>
.target-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.target-label {
  width: 2rem;
  flex: 0 0 auto;
}
/* Pills stretch to fill the row so they're as large as possible for tapping
   with a phone in portrait — equal width, tall, no fixed min-width. */
.zone-group {
  flex: 1 1 auto;
  min-width: 0;
}
.zone-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 3rem;
  padding: 0;
  font-size: 1.05rem;
  font-weight: 700;
}
/* Count of repeat hits (e.g. two A's) shown as a small superscript on the pill,
   so double-hits are visible without a separate tally column stealing width. */
.zone-count {
  font-size: 0.7em;
  font-weight: 700;
  vertical-align: super;
  margin-left: 1px;
  opacity: 0.9;
}
</style>
