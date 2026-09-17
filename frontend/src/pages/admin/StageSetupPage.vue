<template>
  <q-page padding>
    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
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
              <q-btn flat color="primary" label="Edit" @click="startEdit(s)" />
              <q-btn flat color="negative" label="Delete" @click="confirmDelete(s)" />
            </template>
          </StageCard>
        </div>
      </div>

      <div v-if="stages.length === 0 && !showAddForm" class="text-center text-grey q-pa-xl">
        <q-icon name="flag" size="4em" class="q-mb-md" />
        <div class="text-h6">No stages yet</div>
        <div>Click "Add Stage" to create your first stage</div>
      </div>
    </template>

    <!-- Edit Stage Dialog -->
    <q-dialog v-model="showEditDialog" :full-width="!$q.screen.lt.sm" :maximized="$q.screen.lt.sm">
      <StageForm
        :stage="editingStage ?? undefined"
        :fullscreen="$q.screen.lt.sm"
        :existing-officers="editingStageOfficers"
        :hide-officers="isHost"
        @submit="handleUpdateStage"
        @cancel="showEditDialog = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { useMatch } from 'src/composables/useMatch';
import type { Stage } from '@hitfactor/shared';
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

async function handleAddStage(data: StageFormData) {
  try {
    const response = await api.post<Stage>(`/api/matches/${matchId}/stages`, data.stage);
    const newStageId = response.data.id;

    if (data.officers.length > 0) {
      await assignOfficersToStage(newStageId, data.officers);
    }

    await loadStages(matchId);
    showAddForm.value = false;
    $q.notify({ type: 'positive', message: 'Stage added!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to add stage' });
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
  if (!editingStage.value) return;
  try {
    await api.patch(`/api/matches/${matchId}/stages/${editingStage.value.id}`, data.stage);

    if (data.officers.length > 0) {
      await assignOfficersToStage(editingStage.value.id, data.officers);
    }

    await loadStages(matchId);
    showEditDialog.value = false;
    editingStage.value = null;
    $q.notify({ type: 'positive', message: 'Stage updated!' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update stage' });
  }
}

function confirmDelete(stage: Stage) {
  $q.dialog({
    title: 'Delete Stage',
    message: `Are you sure you want to delete Stage ${stage.stage_number}: ${stage.name}?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/api/matches/${matchId}/stages/${stage.id}`);
      await loadStages(matchId);
      $q.notify({ type: 'positive', message: 'Stage deleted' });
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to delete stage' });
    }
  });
}
</script>
