<template>
  <div class="steel-grid row q-gutter-sm items-end">
    <div
      v-for="(hit, i) in modelValue"
      :key="i"
      class="steel-plate column items-center"
    >
      <div class="text-caption text-grey">S{{ i + 1 }}</div>
      <q-btn
        :label="hit ? 'A' : 'M'"
        :style="{ backgroundColor: hit ? HIT_COLOR : MISS_COLOR }"
        text-color="white"
        dense
        unelevated
        class="steel-btn"
        @click="toggle(i)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Steel plates score only Hit (A) or Miss (M). All plates default to hit; the
// officer taps a plate to flip it to a miss (and back).
const props = defineProps<{ modelValue: boolean[] }>();
const emit = defineEmits<{ 'update:modelValue': [boolean[]] }>();

const HIT_COLOR = '#21ba45'; // A — green
const MISS_COLOR = '#e53935'; // M — red

function toggle(i: number) {
  const next = [...props.modelValue];
  next[i] = !next[i];
  emit('update:modelValue', next);
}
</script>

<style scoped>
.steel-btn {
  min-width: 2.75rem;
  font-weight: 700;
}
</style>
