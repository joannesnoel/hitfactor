<template>
  <div class="column items-center q-pa-sm">
    <div class="text-caption text-weight-medium q-mb-sm">TIME (seconds)</div>
    <q-input
      :model-value="displayValue"
      outlined
      dense
      input-class="text-center text-h5 text-weight-bold"
      style="max-width: 200px"
      inputmode="decimal"
      pattern="[0-9]*\.?[0-9]*"
      @update:model-value="handleInput"
      @blur="handleBlur"
    >
      <template #prepend>
        <q-icon name="timer" />
      </template>
    </q-input>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const displayValue = ref(formatTime(props.modelValue));

watch(
  () => props.modelValue,
  (val) => {
    displayValue.value = formatTime(val);
  },
);

function formatTime(val: number): string {
  if (val === 0) return '';
  return val.toFixed(2);
}

function handleInput(val: string | number | null) {
  if (val === null || val === '') {
    displayValue.value = '';
    return;
  }
  displayValue.value = String(val);
}

function handleBlur() {
  const parsed = parseFloat(displayValue.value);
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 999.99) {
    const rounded = Math.round(parsed * 100) / 100;
    emit('update:modelValue', rounded);
    displayValue.value = formatTime(rounded);
  } else {
    displayValue.value = formatTime(props.modelValue);
  }
}
</script>
