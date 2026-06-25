<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-lg">Scoring Dashboard</div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Assigned Matches -->
    <template v-else>
      <div v-if="assignedMatches.length === 0" class="text-center text-grey q-pa-xl">
        <q-icon name="sports_score" size="4em" class="q-mb-md" />
        <div class="text-h6">No assigned matches</div>
        <div>You have not been assigned to any matches for scoring</div>
      </div>

      <div v-else class="q-gutter-lg">
        <q-card v-for="am in assignedMatches" :key="am.match.id" flat bordered>
          <q-card-section>
            <div class="row items-center justify-between">
              <div>
                <div class="text-h6 text-weight-bold">{{ am.match.name }}</div>
                <div class="text-grey">{{ formatDate(am.match.start_date) }} | {{ am.match.location }}</div>
              </div>
              <q-badge
                :color="am.match.status === 'scoring' ? 'orange' : 'green'"
                :label="am.match.status"
                class="match-status-badge"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Assigned Stages:</div>
            <div class="row q-gutter-sm">
              <q-btn
                v-for="stage in am.stages"
                :key="stage.id"
                outline
                color="primary"
                :label="`Stage ${stage.stage_number}: ${stage.name}`"
                @click="$router.push(`/officer/scoring/${am.match.id}/${stage.id}`)"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import type { PowerSyncDatabase } from '@powersync/web';
import type { Match, Stage } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';

interface AssignedMatch {
  match: Match;
  stages: Stage[];
}

const db = inject<PowerSyncDatabase>('powerSyncDb');
const authStore = useAuthStore();
const loading = ref(true);
const assignedMatches = ref<AssignedMatch[]>([]);

onMounted(async () => {
  if (!db || !authStore.user) {
    loading.value = false;
    return;
  }

  try {
    // Get matches where user is an officer
    const officerAssignments = await db.getAll<{ match_id: string }>(
      'SELECT DISTINCT match_id FROM match_officers WHERE user_id = ?',
      [authStore.user.id],
    );

    for (const assignment of officerAssignments) {
      const matchRow = await db.get<Match>(
        'SELECT * FROM matches WHERE id = ?',
        [assignment.match_id],
      );

      // Get stages assigned to this officer
      const stageAssignments = await db.getAll<{ stage_id: string }>(
        'SELECT stage_id FROM stage_officers WHERE user_id = ? AND match_id = ?',
        [authStore.user.id, assignment.match_id],
      );

      let stageRows: Stage[];
      if (stageAssignments.length > 0) {
        const stageIds = stageAssignments.map((s) => s.stage_id);
        const placeholders = stageIds.map(() => '?').join(',');
        stageRows = await db.getAll<Stage>(
          `SELECT * FROM stages WHERE id IN (${placeholders}) ORDER BY stage_number`,
          stageIds,
        );
      } else {
        // If no specific stage assignments, show all stages
        stageRows = await db.getAll<Stage>(
          'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
          [assignment.match_id],
        );
      }

      assignedMatches.value.push({
        match: matchRow as Match,
        stages: stageRows,
      });
    }

    // If no officer assignments found, try showing all active/scoring matches
    if (assignedMatches.value.length === 0) {
      const activeMatches = await db.getAll<Match>(
        'SELECT * FROM matches WHERE status IN (?, ?) ORDER BY start_date DESC',
        ['active', 'scoring'],
      );
      for (const m of activeMatches) {
        const stageRows = await db.getAll<Stage>(
          'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
          [m.id],
        );
        assignedMatches.value.push({ match: m as Match, stages: stageRows });
      }
    }
  } finally {
    loading.value = false;
  }
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
</script>
