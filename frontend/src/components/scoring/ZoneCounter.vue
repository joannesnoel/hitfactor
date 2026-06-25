<template>
  <div class="column items-center q-pa-xs">
    <div class="text-caption text-weight-medium q-mb-xs" :style="{ color }">
      {{ label }}
    </div>
    <div class="text-h5 text-weight-bold q-mb-xs" :style="{ color }">
      {{ count }}
    </div>
    <div class="row q-gutter-xs">
      <q-btn
        round
        dense
        unelevated
        :color="buttonColor"
        icon="remove"
        class="score-zone-btn"
        :disable="count <= 0"
        @click="decrement"
      />
      <q-btn
        round
        dense
        unelevated
        :color="buttonColor"
        icon="add"
        class="score-zone-btn"
        @click="increment"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  count: number;
  color: string;
}>();

const emit = defineEmits<{
  'update:count': [value: number];
}>();

const buttonColor = computed(() => {
  // Map CSS colors to Quasar color names
  switch (props.color) {
    case '#4caf50':
      return 'green';
    case '#ff9800':
      return 'orange';
    case '#f44336':
      return 'red';
    case '#9c27b0':
      return 'purple';
    case '#607d8b':
      return 'blue-grey';
    case '#795548':
      return 'brown';
    default:
      return 'primary';
  }
});

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

@media (min-width: 600px) {
  .score-zone-btn {
    min-width: 56px;
    min-height: 56px;
  }
}
</style>
