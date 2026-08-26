<template>
  <div class="column items-center q-pa-xs">
    <div class="text-caption text-weight-medium q-mb-xs" :style="{ color }">
      {{ label }}
    </div>
    <div
      class="text-weight-bold q-mb-xs"
      :class="compact ? 'text-subtitle1' : 'text-h5'"
      :style="{ color }"
    >
      {{ count }}
    </div>
    <div class="row q-gutter-xs">
      <q-btn
        round
        dense
        unelevated
        icon="remove"
        class="score-zone-btn"
        :class="{ 'score-zone-btn--compact': compact }"
        :style="btnStyle"
        :disable="count <= 0"
        @click="decrement"
      />
      <q-btn
        round
        dense
        unelevated
        icon="add"
        class="score-zone-btn"
        :class="{ 'score-zone-btn--compact': compact }"
        :style="btnStyle"
        @click="increment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    count: number;
    color: string;
    compact?: boolean;
  }>(),
  { compact: false },
);

const emit = defineEmits<{
  'update:count': [value: number];
}>();

// Any CSS color (incl. black) as the button background.
const btnStyle = computed(() => ({ backgroundColor: props.color, color: 'white' }));

function increment() {
  emit('update:count', props.count + 1);
}

function decrement() {
  if (props.count > 0) {
    emit('update:count', props.count - 1);
  }
}
</script>

<style scoped>
.score-zone-btn {
  min-width: 48px;
  min-height: 48px;
}
.score-zone-btn--compact {
  min-width: 34px;
  min-height: 34px;
  font-size: 0.8rem;
}

@media (min-width: 600px) {
  .score-zone-btn {
    min-width: 56px;
    min-height: 56px;
  }
  .score-zone-btn--compact {
    min-width: 36px;
    min-height: 36px;
  }
}
</style>
