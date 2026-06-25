<template>
  <div class="target-grid">
    <div
      v-for="(hits, i) in modelValue"
      :key="i"
      class="target-row row items-center no-wrap q-py-xs"
    >
      <div class="target-label text-weight-bold">T{{ i + 1 }}</div>
      <div class="row q-gutter-xs no-wrap q-ml-sm">
        <q-btn
          v-for="z in ZONES"
          :key="z.k"
          :label="z.label"
          :style="{ backgroundColor: z.color }"
          text-color="white"
          dense
          unelevated
          class="zone-btn"
          :disable="hits.length >= roundsFor(i)"
          @click="add(i, z.k)"
        />
      </div>
      <div class="target-tally text-weight-medium q-ml-md">
        {{ tally(hits) || '—' }}
      </div>
      <q-space />
      <div class="text-caption text-grey q-mr-xs">{{ hits.length }}/{{ roundsFor(i) }}</div>
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

const ZONES = [
  { k: 'a', label: 'A', color: '#4caf50' },
  { k: 'c', label: 'C', color: '#ff9800' },
  { k: 'd', label: 'D', color: '#f44336' },
  { k: 'm', label: 'M', color: '#9c27b0' },
];

function roundsFor(i: number): number {
  return props.rounds?.[i] ?? props.defaultRounds;
}

function clone(): string[][] {
  return props.modelValue.map((t) => [...t]);
}

function add(i: number, zone: string) {
  if (props.modelValue[i].length >= roundsFor(i)) return;
  const next = clone();
  next[i].push(zone);
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
  return ['a', 'c', 'd', 'm']
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
