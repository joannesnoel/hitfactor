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
            <div class="row items-center no-wrap">
              <div class="col" style="min-width: 0">
                <div class="text-h6 text-weight-bold ellipsis">{{ am.match.name }}</div>
                <div class="text-grey ellipsis">{{ formatDate(am.match.start_date) }} | {{ am.match.location }}</div>
              </div>
              <q-badge
                :color="am.match.status === 'scoring' ? 'orange' : 'green'"
                :label="am.match.status"
                class="match-status-badge q-ml-sm"
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

          <q-separator />

          <q-card-actions>
            <q-btn
              flat
              color="primary"
              icon="leaderboard"
              label="Partial results"
              @click="$router.push(`/officer/matches/${am.match.id}/results`)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PowerSyncDatabase } from '@powersync/web';
import type { Match, Stage } from '@hitfactor/shared';
import { useAuthStore } from 'src/stores/auth.store';
import { whenPowerSyncReady } from 'src/boot/powersync';

interface AssignedMatch {
  match: Match;
  stages: Stage[];
}

const authStore = useAuthStore();
const loading = ref(true);
const assignedMatches = ref<AssignedMatch[]>([]);

onMounted(async () => {
  if (!authStore.user) {
    loading.value = false;
    return;
  }
  const userId = authStore.user.id;
  // Wait for the real connected db (PowerSync connects asynchronously after
  // login). inject('powerSyncDb') only ever yields the boot-time null.
  const db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }
  // Reactive: (re)load whenever this officer's match_officers rows change — e.g.
  // when an assignment syncs in shortly after the page mounts. A one-shot query
  // here would race the initial sync and show "no matches" until a manual reload.
  db.watch(
    'SELECT match_id FROM match_officers WHERE user_id = ?',
    [userId],
    { onResult: () => { void loadAssignedMatches(db, userId); } },
  );
});

async function loadAssignedMatches(db: PowerSyncDatabase, userId: string): Promise<void> {
  try {
    const officerAssignments = await db.getAll<{ match_id: string }>(
      'SELECT DISTINCT match_id FROM match_officers WHERE user_id = ?',
      [userId],
    );

    const result: AssignedMatch[] = [];
    for (const assignment of officerAssignments) {
      const matchRow = await db.get<Match>(
        'SELECT * FROM matches WHERE id = ?',
        [assignment.match_id],
      );

      // Stages this officer is assigned to (fallback: all stages of the match)
      const stageAssignments = await db.getAll<{ stage_id: string }>(
        'SELECT stage_id FROM stage_officers WHERE user_id = ? AND match_id = ?',
        [userId, assignment.match_id],
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
        stageRows = await db.getAll<Stage>(
          'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
          [assignment.match_id],
        );
      }

      result.push({ match: matchRow as Match, stages: stageRows });
    }

    // Fallback: only a global admin (who can score any stage) sees all active/
    // scoring matches when they have no explicit assignments. A regular officer
    // must be assigned — otherwise the match would look scoreable here but the
    // server would reject their pushes (they aren't an assigned officer).
    if (result.length === 0 && authStore.isAdmin) {
      const activeMatches = await db.getAll<Match>(
        'SELECT * FROM matches WHERE status IN (?, ?) ORDER BY start_date DESC',
        ['active', 'scoring'],
      );
      for (const m of activeMatches) {
        const stageRows = await db.getAll<Stage>(
          'SELECT * FROM stages WHERE match_id = ? ORDER BY stage_number',
          [m.id],
        );
        result.push({ match: m as Match, stages: stageRows });
      }
    }

    assignedMatches.value = result;
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
</script>
