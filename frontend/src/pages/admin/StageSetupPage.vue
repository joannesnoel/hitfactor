<template>
  <q-page padding>
    <!-- Loading: inline, so the page (and any rows already synced locally) stays usable -->
    <q-linear-progress v-if="loading" indeterminate color="primary" class="q-mb-md" />

    <div>
      <!-- Add Stage Button -->
      <div class="q-mb-md">
        <q-btn
          color="primary"
          icon="add"
          label="Add Stage"
          unelevated
          @click="showAddForm = !showAddForm"
        />
      </div>

      <!-- Add Stage Form -->
      <div v-if="showAddForm" class="q-mb-lg">
        <StageForm
          :hide-officers="isHost"
          :next-stage-number="nextStageNumber"
          :saving="saving"
          @submit="handleAddStage"
          @cancel="showAddForm = false"
        />
      </div>

      <!-- Stages List -->
      <div class="q-gutter-md q-mt-md">
        <div v-for="s in stages" :key="s.id">
          <StageCard :stage="s">
            <template #actions>
              <q-btn
                v-if="isHost"
                flat
                color="teal"
                icon="sports_score"
                label="Score"
                @click="router.push(`/shooter/host/matches/${matchId}/score/${s.id}`)"
              />
              <q-btn flat color="primary" label="Edit" :disable="saving" @click="startEdit(s)" />
              <q-btn flat color="negative" label="Delete" :disable="saving" @click="confirmDelete(s)">
                <q-tooltip v-if="scoredStageIds.has(s.id)">Has scores — can't be deleted</q-tooltip>
              </q-btn>
            </template>
          </StageCard>
        </div>
      </div>

      <div v-if="stages.length === 0 && !showAddForm && !loading" class="text-center text-grey q-pa-xl">
        <q-icon name="flag" size="4em" class="q-mb-md" />
        <div class="text-h6">No stages yet</div>
        <div>Click "Add Stage" to create your first stage</div>
      </div>
    </div>

    <!-- Edit Stage Dialog -->
    <q-dialog v-model="showEditDialog" :full-width="!$q.screen.lt.sm" :maximized="$q.screen.lt.sm">
      <StageForm
        :stage="editingStage ?? undefined"
        :fullscreen="$q.screen.lt.sm"
        :existing-officers="editingStageOfficers"
        :hide-officers="isHost"
        :saving="saving"
        :score-locked="!!editingStage && scoredStageIds.has(editingStage.id)"
        @submit="handleUpdateStage"
        @cancel="showEditDialog = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import type { PowerSyncDatabase } from '@powersync/web';
import { api } from 'src/boot/axios';
import { getPowerSyncDb, whenPowerSyncReady } from 'src/boot/powersync';
import { useMatch } from 'src/composables/useMatch';
import {
  computeStageRounds,
  changedLockedStageFields,
  defaultStageName,
  STAGE_HAS_SCORES_MESSAGE,
  STAGE_DELETE_HAS_SCORES_MESSAGE,
} from '@hitfactor/shared';
import type { Stage, CreateStageInput } from '@hitfactor/shared';
import StageCard from 'src/components/match/StageCard.vue';
import StageForm from 'src/components/match/StageForm.vue';
import type { StageFormData, StageOfficerAssignment } from 'src/components/match/StageForm.vue';

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const matchId = route.params.id as string;
// Reused by the shooter-host area — a private match has no stage-level officials.
const isHost = route.path.startsWith('/shooter/host');

const { stages, loading, loadStages } = useMatch(matchId);

// Next stage number = highest existing + 1 (so Add Stage prefills sensibly).
const nextStageNumber = computed(
  () => stages.value.reduce((max, s) => Math.max(max, s.stage_number), 0) + 1,
);

const saving = ref(false);

// Stages that already have scores (from the local db; the server enforces the
// same rule, so this only gives instant feedback). Empty without a local db.
const scoredStageIds = ref<Set<string>>(new Set());
const scoredAbort = new AbortController();
onMounted(async () => {
  const db = await whenPowerSyncReady();
  if (!db) return;
  db.watch(
    'SELECT DISTINCT stage_id FROM scores WHERE match_id = ?',
    [matchId],
    {
      onResult: (res) => {
        const rows = (res.rows?._array as Array<{ stage_id: string }> | undefined) ?? [];
        scoredStageIds.value = new Set(rows.map((r) => r.stage_id));
      },
    },
    { signal: scoredAbort.signal },
  );
});
onUnmounted(() => scoredAbort.abort());
const showAddForm = ref(false);
const showEditDialog = ref(false);
const editingStage = ref<Stage | null>(null);
const editingStageOfficers = ref<StageOfficerAssignment[]>([]);

async function assignOfficersToStage(stageId: string, officers: StageOfficerAssignment[]) {
  // Group officers by user_id+role since the API expects one call per user
  const byUser = new Map<string, StageOfficerAssignment>();
  for (const o of officers) {
    byUser.set(`${o.user_id}-${o.role}`, o);
  }

  await Promise.all(
    Array.from(byUser.values()).map((o) =>
      api.post(`/api/matches/${matchId}/officers`, {
        user_id: o.user_id,
        role: o.role,
        stage_ids: [stageId],
      }),
    ),
  );
}

// The host flow is local-first: writes go to local SQLite and PowerSync uploads
// them, so a stage appears instantly and works offline / on a bad signal. The
// admin flow assigns stage officers over REST right after creating the stage,
// which needs it to exist on the server first — so it (and any session without
// a local db) keeps using the REST API.
function localDb(): PowerSyncDatabase | null {
  return isHost ? getPowerSyncDb() : null;
}

function stageNumberTaken(stageNumber: number, excludeStageId?: string): boolean {
  return stages.value.some(
    (s) => s.stage_number === stageNumber && s.id !== excludeStageId,
  );
}

// Surface the server's message for a duplicate stage number (409).
function failureMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: { message?: string } } })
    ?.response;
  return res?.status === 409 && res.data?.message ? res.data.message : fallback;
}

async function insertStageLocally(db: PowerSyncDatabase, s: CreateStageInput) {
  const { min_rounds, max_points } = computeStageRounds(s);
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO stages (
      id, match_id, stage_number, name, description, scoring_type,
      min_rounds, max_points, number_of_targets, number_of_steel,
      number_of_no_shoots, paper_target_rounds, fixed_time, is_classifier,
      classifier_number, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(), matchId, s.stage_number, s.name ?? defaultStageName(s.stage_number), s.description ?? null,
      s.scoring_type, min_rounds, max_points, s.number_of_targets, s.number_of_steel,
      s.number_of_no_shoots,
      JSON.stringify(s.paper_target_rounds ?? Array(s.number_of_targets).fill(2)),
      s.fixed_time ?? null, s.is_classifier ? 1 : 0, s.classifier_number ?? null,
      now, now,
    ],
  );
}

async function updateStageLocally(db: PowerSyncDatabase, stageId: string, s: CreateStageInput) {
  const { min_rounds, max_points } = computeStageRounds(s);
  // Optional text fields use COALESCE so, like the REST PATCH, an omitted value
  // leaves the existing one untouched.
  await db.execute(
    `UPDATE stages SET
      stage_number = ?, description = COALESCE(?, description),
      scoring_type = ?, min_rounds = ?, max_points = ?, number_of_targets = ?,
      number_of_steel = ?, number_of_no_shoots = ?, paper_target_rounds = ?,
      fixed_time = COALESCE(?, fixed_time), is_classifier = ?,
      classifier_number = COALESCE(?, classifier_number), updated_at = ?
    WHERE id = ?`,
    [
      s.stage_number, s.description ?? null, s.scoring_type, min_rounds,
      max_points, s.number_of_targets, s.number_of_steel, s.number_of_no_shoots,
      JSON.stringify(s.paper_target_rounds ?? Array(s.number_of_targets).fill(2)),
      s.fixed_time ?? null, s.is_classifier ? 1 : 0, s.classifier_number ?? null,
      new Date().toISOString(), stageId,
    ],
  );
}

async function handleAddStage(data: StageFormData) {
  if (saving.value) return;
  if (stageNumberTaken(data.stage.stage_number)) {
    $q.notify({ type: 'negative', message: `Stage ${data.stage.stage_number} already exists` });
    return;
  }

  saving.value = true;
  try {
    const db = localDb();
    if (db) {
      await insertStageLocally(db, data.stage);
    } else {
      const response = await api.post<Stage>(`/api/matches/${matchId}/stages`, data.stage);
      const newStageId = response.data.id;

      if (data.officers.length > 0) {
        await assignOfficersToStage(newStageId, data.officers);
      }

      await loadStages(matchId);
    }
    showAddForm.value = false;
    $q.notify({ type: 'positive', message: 'Stage added!' });
  } catch (err) {
    $q.notify({ type: 'negative', message: failureMessage(err, 'Failed to add stage') });
  } finally {
    saving.value = false;
  }
}

async function startEdit(stage: Stage) {
  editingStage.value = stage;

  // Private (host) matches have no stage officials — skip the lookup.
  if (isHost) {
    editingStageOfficers.value = [];
    showEditDialog.value = true;
    return;
  }

  // Load existing stage officers
  try {
    const response = await api.get<{
      officers: { user_id: string; display_name: string; email: string; role: string }[];
      stage_assignments: { user_id: string; display_name: string; email: string; role: string; stage_id: string }[];
    }>(`/api/matches/${matchId}/officers`);

    editingStageOfficers.value = (response.data.stage_assignments ?? [])
      .filter((sa) => sa.stage_id === stage.id)
      .map((sa) => ({
        user_id: sa.user_id,
        display_name: sa.display_name,
        email: sa.email,
        role: sa.role as 'SCMO' | 'MO',
      }));
  } catch {
    editingStageOfficers.value = [];
  }

  showEditDialog.value = true;
}

async function handleUpdateStage(data: StageFormData) {
  if (!editingStage.value || saving.value) return;
  const stageId = editingStage.value.id;
  if (
    scoredStageIds.value.has(stageId) &&
    changedLockedStageFields(editingStage.value, data.stage).length > 0
  ) {
    $q.notify({ type: 'negative', message: STAGE_HAS_SCORES_MESSAGE });
    return;
  }
  if (stageNumberTaken(data.stage.stage_number, stageId)) {
    $q.notify({ type: 'negative', message: `Stage ${data.stage.stage_number} already exists` });
    return;
  }

  saving.value = true;
  try {
    const db = localDb();
    if (db) {
      await updateStageLocally(db, stageId, data.stage);
    } else {
      await api.patch(`/api/matches/${matchId}/stages/${stageId}`, data.stage);

      if (data.officers.length > 0) {
        await assignOfficersToStage(stageId, data.officers);
      }

      await loadStages(matchId);
    }
    showEditDialog.value = false;
    editingStage.value = null;
    $q.notify({ type: 'positive', message: 'Stage updated!' });
  } catch (err) {
    $q.notify({ type: 'negative', message: failureMessage(err, 'Failed to update stage') });
  } finally {
    saving.value = false;
  }
}

function confirmDelete(stage: Stage) {
  if (scoredStageIds.value.has(stage.id)) {
    $q.notify({ type: 'negative', message: STAGE_DELETE_HAS_SCORES_MESSAGE });
    return;
  }
  $q.dialog({
    title: 'Delete Stage',
    message: `Are you sure you want to delete Stage ${stage.stage_number}?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    if (saving.value) return;
    saving.value = true;
    try {
      const db = localDb();
      if (db) {
        await db.execute('DELETE FROM stages WHERE id = ?', [stage.id]);
      } else {
        await api.delete(`/api/matches/${matchId}/stages/${stage.id}`);
        await loadStages(matchId);
      }
      $q.notify({ type: 'positive', message: 'Stage deleted' });
    } catch (err) {
      $q.notify({ type: 'negative', message: failureMessage(err, 'Failed to delete stage') });
    } finally {
      saving.value = false;
    }
  });
}
</script>
