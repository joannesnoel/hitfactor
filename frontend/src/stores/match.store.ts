import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Match, Stage, Registration } from '@hitfactor/shared';

export const useMatchStore = defineStore('match', () => {
  // Currently selected/active match
  const currentMatch = ref<Match | null>(null);
  const currentStages = ref<Stage[]>([]);
  const currentRegistrations = ref<Registration[]>([]);

  // UI state
  const selectedDivision = ref<string | null>(null);
  const selectedSquadId = ref<string | null>(null);

  function setCurrentMatch(match: Match) {
    currentMatch.value = match;
  }

  function setCurrentStages(stages: Stage[]) {
    currentStages.value = stages;
  }

  function setCurrentRegistrations(registrations: Registration[]) {
    currentRegistrations.value = registrations;
  }

  function clearCurrent() {
    currentMatch.value = null;
    currentStages.value = [];
    currentRegistrations.value = [];
    selectedDivision.value = null;
    selectedSquadId.value = null;
  }

  return {
    currentMatch,
    currentStages,
    currentRegistrations,
    selectedDivision,
    selectedSquadId,
    setCurrentMatch,
    setCurrentStages,
    setCurrentRegistrations,
    clearCurrent,
  };
});
