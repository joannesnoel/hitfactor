<template>
  <q-card class="q-pa-md">
    <!-- Shooter Selector -->
    <q-select
      v-model="selectedRegistrationId"
      :options="registrationOptions"
      option-value="value"
      option-label="label"
      label="Select Shooter"
      emit-value
      map-options
      outlined
      dense
      class="q-mb-md"
    >
      <template #prepend>
        <q-icon name="person" />
      </template>
    </q-select>

    <!-- DQ / DNF Toggles -->
    <div class="row q-gutter-md q-mb-md">
      <q-toggle
        v-model="form.dqed"
        label="DQ"
        color="red"
        left-label
      />
      <q-toggle
        v-model="form.dnf"
        label="DNF"
        color="orange"
        left-label
      />
    </div>

    <!-- Zone Counters -->
    <div class="score-entry-grid q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf }">
      <ZoneCounter
        label="A"
        :count="form.alpha_count"
        color="#4caf50"
        @update:count="form.alpha_count = $event"
      />
      <ZoneCounter
        label="C"
        :count="form.charlie_count"
        color="#ff9800"
        @update:count="form.charlie_count = $event"
      />
      <ZoneCounter
        label="D"
        :count="form.delta_count"
        color="#f44336"
        @update:count="form.delta_count = $event"
      />
      <ZoneCounter
        label="M"
        :count="form.miss_count"
        color="#9c27b0"
        @update:count="form.miss_count = $event"
      />
      <ZoneCounter
        label="NS"
        :count="form.no_shoot_count"
        color="#607d8b"
        @update:count="form.no_shoot_count = $event"
      />
      <ZoneCounter
        label="Proc"
        :count="form.procedural_count"
        color="#795548"
        @update:count="form.procedural_count = $event"
      />
    </div>

    <!-- Steel Counters (if stage has steel) -->
    <div v-if="hasSteel" class="row justify-center q-gutter-md q-mb-md" :class="{ 'disabled-section': form.dqed || form.dnf }">
      <ZoneCounter
        label="Steel Hits"
        :count="form.steel_hits"
        color="#4caf50"
        @update:count="form.steel_hits = $event"
      />
      <ZoneCounter
        label="Steel Misses"
        :count="form.steel_misses"
        color="#f44336"
        @update:count="form.steel_misses = $event"
      />
    </div>

    <!-- Time Input -->
    <div :class="{ 'disabled-section': form.dqed || form.dnf }">
      <TimeInput
        :model-value="form.time"
        @update:model-value="form.time = $event"
      />
    </div>

    <!-- Live HF Preview -->
    <q-separator class="q-my-md" />
    <div class="row justify-center q-mb-md">
      <div class="column items-center">
        <div class="text-caption text-grey">Hit Factor</div>
        <div class="hf-display text-primary">{{ liveHitFactor }}</div>
        <div class="text-caption text-grey q-mt-xs">
          Points: {{ liveScore.total_points }} ({{ liveScore.raw_points }} raw, {{ liveScore.penalty_points }} pen)
        </div>
      </div>
    </div>

    <!-- Submit Button -->
    <q-btn
      color="primary"
      label="Save Score"
      class="full-width"
      size="lg"
      unelevated
      :disable="!selectedRegistrationId"
      :loading="saving"
      @click="handleSubmit"
    />
  </q-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { Stage, Registration, ScoreInput, ScoringType, PowerFactor, Organization } from '@hitfactor/shared';
import { computeScore, getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import ZoneCounter from './ZoneCounter.vue';
import TimeInput from './TimeInput.vue';

const props = withDefaults(
  defineProps<{
    stage: Stage;
    registrations: Registration[];
    organization?: Organization;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const emit = defineEmits<{
  submit: [data: { registrationId: string; input: ScoreInput }];
}>();

const saving = ref(false);
const selectedRegistrationId = ref<string | null>(null);

const form = reactive({
  alpha_count: 0,
  charlie_count: 0,
  delta_count: 0,
  miss_count: 0,
  no_shoot_count: 0,
  procedural_count: 0,
  steel_hits: 0,
  steel_misses: 0,
  time: 0,
  dqed: false,
  dnf: false,
});

const hasSteel = computed(() => {
  return props.stage.number_of_steel > 0;
});

const registrationOptions = computed(() => {
  return props.registrations.map((r) => ({
    label: `${r.shooter_name} (${getDivisionLabel(props.organization, r.division)})`,
    value: r.id,
  }));
});

const selectedRegistration = computed(() => {
  return props.registrations.find((r) => r.id === selectedRegistrationId.value);
});

const currentPowerFactor = computed<PowerFactor>(() => {
  return (selectedRegistration.value?.power_factor as PowerFactor) ?? 'Minor';
});

const scoreInput = computed<ScoreInput>(() => ({
  alpha_count: form.alpha_count,
  charlie_count: form.charlie_count,
  delta_count: form.delta_count,
  miss_count: form.miss_count,
  no_shoot_count: form.no_shoot_count,
  procedural_count: form.procedural_count,
  steel_hits: form.steel_hits,
  steel_misses: form.steel_misses,
  time: form.time,
  power_factor: currentPowerFactor.value,
  dqed: form.dqed,
  dnf: form.dnf,
}));

const liveScore = computed(() => {
  return computeScore(scoreInput.value, props.stage.scoring_type as ScoringType);
});

const liveHitFactor = computed(() => {
  return liveScore.value.hit_factor.toFixed(4);
});

// Reset form when shooter changes
watch(selectedRegistrationId, () => {
  form.alpha_count = 0;
  form.charlie_count = 0;
  form.delta_count = 0;
  form.miss_count = 0;
  form.no_shoot_count = 0;
  form.procedural_count = 0;
  form.steel_hits = 0;
  form.steel_misses = 0;
  form.time = 0;
  form.dqed = false;
  form.dnf = false;
});

async function handleSubmit() {
  if (!selectedRegistrationId.value) return;
  saving.value = true;
  try {
    emit('submit', {
      registrationId: selectedRegistrationId.value,
      input: scoreInput.value,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.disabled-section {
  opacity: 0.4;
  pointer-events: none;
}
</style>
