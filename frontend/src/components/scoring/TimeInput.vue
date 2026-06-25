<template>
  <div class="column items-center q-pa-sm">
    <div class="text-caption text-weight-medium q-mb-sm">TIME (seconds)</div>
    <q-input
      :model-value="displayValue"
      outlined
      dense
      placeholder="0.00"
      input-class="text-center text-h5 text-weight-bold"
      style="max-width: 200px"
      inputmode="numeric"
      @update:model-value="handleInput"
      @blur="handleBlur"
    >
      <template #prepend>
        <q-icon name="timer" />
      </template>
    </q-input>
    <div class="text-caption text-grey q-mt-xs">
      Type digits — last two are hundredths (1234 → 12.34)
    </div>
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
  if (!val) return '';
  return val.toFixed(2);
}

// Treat the input as a stream of digits where the last two are hundredths of a
// second (timer/Practiscore style): "1234" → 12.34, backspace drops a digit.
function handleInput(val: string | number | null) {
  const digits = (val == null ? '' : String(val)).replace(/\D/g, '').slice(-5);
  if (digits === '') {
    displayValue.value = '';
    emit('update:modelValue', 0);
    return;
  }
  const value = parseInt(digits, 10) / 100;
  displayValue.value = value.toFixed(2);
  emit('update:modelValue', value);
}

function handleBlur() {
  displayValue.value = formatTime(props.modelValue);
}
</script>
