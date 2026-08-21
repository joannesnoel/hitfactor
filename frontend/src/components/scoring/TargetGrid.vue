<template>
  <div class="target-grid">
    <div
      v-for="(hits, i) in modelValue"
      :key="i"
      class="target-row row items-center no-wrap q-py-xs"
      v-touch-hold:500.mouse="() => clearRow(i)"
    >
      <div class="target-label text-weight-bold">T{{ i + 1 }}</div>
      <div class="row q-gutter-xs no-wrap q-ml-sm">
        <q-btn
          v-for="z in ZONES"
          :key="z.k"
          :label="z.label"
          :style="{ backgroundColor: z.color }"
          :text-color="z.textColor"
          dense
          unelevated
          class="zone-btn"
          :disable="z.k !== 'ns' && scoringCount(hits) >= roundsFor(i)"
          @click="add(i, z.k)"
        />
      </div>
      <div class="target-tally text-weight-medium q-ml-md">
        {{ tally(hits) || '—' }}
      </div>
      <q-space />
      <div class="text-caption text-grey q-mr-xs">{{ scoringCount(hits) }}/{{ roundsFor(i) }}</div>
      <q-btn
        flat
        dense
        round
        icon="backspace"
        size="sm"
        color="grey-7"
        :disable="hits.length === 0"
        @click="undo(i)"
      />
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
const ZONES = [
  { k: 'a', label: 'A', color: '#21ba45', textColor: 'white' },
  { k: 'c', label: 'C', color: '#fdd835', textColor: 'black' },
  { k: 'd', label: 'D', color: '#f57c00', textColor: 'white' },
  { k: 'm', label: 'M', color: '#e53935', textColor: 'white' },
  { k: 'ns', label: 'NS', color: '#b71c1c', textColor: 'white' },
];

function roundsFor(i: number): number {
  return props.rounds?.[i] ?? props.defaultRounds;
}

// Scoring hits only (excludes no-shoots), which is what the round limit counts.
function scoringCount(hits: string[]): number {
  return hits.filter((h) => h !== 'ns').length;
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

function undo(i: number) {
  if (props.modelValue[i].length === 0) return;
  const next = clone();
  next[i].pop();
  emit('update:modelValue', next);
}

function tally(hits: string[]): string {
  const counts: Record<string, number> = {};
  for (const h of hits) counts[h] = (counts[h] ?? 0) + 1;
  return ['a', 'c', 'd', 'm', 'ns']
    .filter((z) => counts[z])
    .map((z) => `${counts[z]}${z.toUpperCase()}`)
    .join(' ');
}
</script>

<style scoped>
.target-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.target-label {
  width: 2.5rem;
}
.zone-btn {
  min-width: 2.5rem;
  font-weight: 700;
}
.target-tally {
  min-width: 4rem;
}
</style>
