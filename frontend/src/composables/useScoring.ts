import { computed, type Ref } from 'vue';
import type { ScoreInput, ScoringType } from '@hitfactor/shared';
import {
  computeScore,
  calculateHitFactor,
  calculateStagePercentage,
  type ComputedScore,
} from '@hitfactor/shared';

export function useScoring(
  input: Ref<ScoreInput>,
  scoringType: Ref<ScoringType>,
) {
  const score = computed<ComputedScore>(() => {
    return computeScore(input.value, scoringType.value);
  });

  const hitFactor = computed(() => {
    return calculateHitFactor(input.value, scoringType.value);
  });

  const rawPoints = computed(() => score.value.raw_points);
  const penaltyPoints = computed(() => score.value.penalty_points);
  const totalPoints = computed(() => score.value.total_points);

  const hitFactorDisplay = computed(() => {
    return hitFactor.value.toFixed(4);
  });

  function getStagePercentage(stageWinnerHF: number): number {
    return calculateStagePercentage(hitFactor.value, stageWinnerHF);
  }

  return {
    score,
    hitFactor,
    rawPoints,
    penaltyPoints,
    totalPoints,
    hitFactorDisplay,
    getStagePercentage,
  };
}
