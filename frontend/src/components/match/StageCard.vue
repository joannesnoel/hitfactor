<template>
  <q-card class="stage-card">
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm">
        <div class="text-subtitle1 text-weight-bold">
          Stage {{ stage.stage_number }}
        </div>
        <q-badge
          v-if="stage.is_classifier"
          color="purple"
          label="Classifier"
        />
      </div>
      <div class="row q-gutter-sm text-grey-7">
        <q-chip dense size="sm" outline :label="scoringTypeLabel" />
        <q-chip dense size="sm" outline :label="`${stage.min_rounds} rounds`" />
        <q-chip dense size="sm" outline :label="`${stage.max_points} pts max`" />
      </div>
      <div v-if="stage.number_of_targets > 0" class="text-caption text-grey q-mt-xs">
        {{ stage.number_of_targets }} paper
        <template v-if="stage.number_of_steel > 0">, {{ stage.number_of_steel }} steel</template>
        <template v-if="stage.number_of_no_shoots > 0">, {{ stage.number_of_no_shoots }} no-shoots</template>
      </div>
      <div v-if="stage.classifier_number" class="text-caption text-grey q-mt-xs">
        Classifier: {{ stage.classifier_number }}
      </div>
    </q-card-section>
    <q-card-actions v-if="$slots.actions" align="right">
      <slot name="actions" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Stage } from '@hitfactor/shared';

const props = defineProps<{
  stage: Stage;
}>();

const scoringTypeLabel = computed(() => {
  switch (props.stage.scoring_type) {
    case 'comstock':
      return 'Comstock';
    case 'virginia_count':
      return 'Virginia Count';
    case 'fixed_time':
      return 'Fixed Time';
    default:
      return props.stage.scoring_type;
  }
});
</script>
