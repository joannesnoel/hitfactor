<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h6">Match Officials</div>
      <q-space />
      <q-btn color="primary" icon="person_add" label="Assign Official" unelevated @click="openAssignDialog()" />
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <!-- Match-Level Officials -->
      <div class="text-subtitle1 text-weight-bold q-mb-sm">Match-Level Officials</div>
      <div v-if="matchLevelOfficers.length === 0" class="text-grey q-mb-lg q-pa-md">
        No match-level officials assigned yet.
      </div>
      <div v-else class="q-mb-lg">
        <q-list bordered separator class="rounded-borders">
          <q-item v-for="officer in matchLevelOfficers" :key="officer.user_id">
            <q-item-section avatar>
              <q-avatar :color="roleColor(officer.role)" text-color="white" size="40px">
                {{ officer.display_name.charAt(0).toUpperCase() }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ officer.display_name }}</q-item-label>
              <q-item-label caption>{{ officer.email }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge :color="roleColor(officer.role)" :label="officer.role" />
            </q-item-section>
            <q-item-section side>
              <q-btn
                v-if="officer.role !== 'MA'"
                flat round dense
                icon="delete"
                color="negative"
                @click="confirmRemove(officer)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Stage Officials Grid -->
      <div class="text-subtitle1 text-weight-bold q-mb-sm">Stage Officials</div>
      <div v-if="stages.length === 0" class="text-grey q-mb-lg q-pa-md">
        No stages created yet. <router-link :to="`/admin/matches/${matchId}/stages`">Add stages first.</router-link>
      </div>
      <div v-else class="q-gutter-md q-mb-lg">
        <q-card v-for="s in stages" :key="s.id" flat bordered>
          <q-card-section class="q-pb-none">
            <div class="row items-center justify-between">
              <div class="text-subtitle2 text-weight-bold">
                Stage {{ s.stage_number }}: {{ s.name }}
              </div>
              <q-btn
                flat dense
                icon="person_add"
                size="sm"
                color="primary"
                @click="openAssignDialog(s.id)"
              />
            </div>
          </q-card-section>
          <q-card-section>
            <div v-if="stageOfficerMap[s.id]?.length > 0" class="q-gutter-xs">
              <q-chip
                v-for="so in stageOfficerMap[s.id]"
                :key="`${so.user_id}-${so.role}`"
                removable
                @remove="removeStageOfficer(so)"
                :color="so.role === 'SCMO' ? 'deep-purple-1' : 'blue-grey-1'"
                text-color="dark"
              >
                <q-avatar
                  :color="so.role === 'SCMO' ? 'deep-purple' : 'blue-grey'"
                  text-color="white"
                  size="24px"
                  class="q-mr-xs"
                >
                  {{ so.display_name.charAt(0).toUpperCase() }}
                </q-avatar>
                {{ so.display_name }}
                <q-badge :label="so.role" :color="so.role === 'SCMO' ? 'deep-purple' : 'blue-grey'" class="q-ml-xs" />
              </q-chip>
            </div>
            <div v-else class="text-caption text-grey">No officers assigned</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- All Officers Summary -->
      <div class="text-subtitle1 text-weight-bold q-mb-sm">All Officers</div>
      <div v-if="allOfficersSummary.length === 0" class="text-grey q-pa-md">
        No officers assigned to this match.
      </div>
      <q-list v-else bordered separator class="rounded-borders">
        <q-item v-for="summary in allOfficersSummary" :key="summary.user_id">
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white" size="40px">
              {{ summary.display_name.charAt(0).toUpperCase() }}
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ summary.display_name }}</q-item-label>
            <q-item-label caption>{{ summary.email }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <div class="q-gutter-xs">
              <q-badge
                v-for="role in summary.roles"
                :key="role"
                :color="roleColor(role)"
                :label="role"
                class="q-mr-xs"
              />
            </div>
            <q-item-label v-if="summary.stageNumbers.length > 0" caption class="q-mt-xs">
              Stages: {{ summary.stageNumbers.join(', ') }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat round dense
              icon="delete"
              color="negative"
              @click="confirmRemove(summary)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- Assign Official Dialog -->
    <q-dialog v-model="showAssignDialog">
      <q-card style="min-width: 400px; max-width: 500px">
        <q-card-section class="text-h6">Assign Official</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="assignRole"
            :options="roleOptions"
            label="Role"
            emit-value
            map-options
            outlined
            dense
          />

          <q-select
            v-model="assignUserId"
            :options="userSearchOptions"
            label="Search by name or email..."
            use-input
            input-debounce="200"
            emit-value
            map-options
            outlined
            dense
            @filter="searchUsers"
          >
            <template #option="{ itemProps, opt }">
              <q-item v-bind="itemProps">
                <q-item-section avatar>
                  <q-avatar color="grey-4" text-color="grey-8" size="28px">
                    {{ opt.label.charAt(0).toUpperCase() }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                  <q-item-label caption>{{ opt.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">No users found</q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Stage selection for stage-level roles -->
          <div v-if="isStageRole(assignRole)" class="q-mt-sm">
            <div class="text-subtitle2 q-mb-xs">Assign to stages:</div>
            <div class="q-gutter-xs">
              <q-checkbox
                v-for="s in stages"
                :key="s.id"
                v-model="assignStageIds"
                :val="s.id"
                :label="`Stage ${s.stage_number}: ${s.name}`"
                dense
              />
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Assign"
            unelevated
            :disable="!canAssign"
            @click="handleAssign"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import {
  MATCH_LEVEL_OFFICIAL_ROLES,
  STAGE_LEVEL_OFFICIAL_ROLES,
  MATCH_OFFICIAL_ROLE_LABELS,
} from '@hitfactor/shared';
import type { Match, Stage, StageLevelOfficialRole } from '@hitfactor/shared';

interface OfficerEntry {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
}

interface StageOfficerEntry extends OfficerEntry {
  stage_id: string;
}

interface OfficerSummary {
  user_id: string;
  display_name: string;
  email: string;
  roles: string[];
  stageNumbers: number[];
}

const route = useRoute();
const $q = useQuasar();
const matchId = route.params.id as string;

const loading = ref(true);
const match = ref<Match | null>(null);
const stages = ref<Stage[]>([]);
const matchLevelOfficers = ref<OfficerEntry[]>([]);
const stageAssignments = ref<StageOfficerEntry[]>([]);

// Assign dialog state
const showAssignDialog = ref(false);
const assignRole = ref<string>('MO');
const assignUserId = ref<string | null>(null);
const assignStageIds = ref<string[]>([]);
const userSearchOptions = ref<{ label: string; value: string; caption: string }[]>([]);
const preselectedStageId = ref<string | null>(null);

const roleOptions = [
  ...MATCH_LEVEL_OFFICIAL_ROLES.map((r) => ({
    label: `${r} — ${MATCH_OFFICIAL_ROLE_LABELS[r]}`,
    value: r,
  })),
  ...STAGE_LEVEL_OFFICIAL_ROLES.map((r) => ({
    label: `${r} — ${MATCH_OFFICIAL_ROLE_LABELS[r]}`,
    value: r,
  })),
];

const stageOfficerMap = computed(() => {
  const map: Record<string, StageOfficerEntry[]> = {};
  for (const s of stages.value) {
    map[s.id] = stageAssignments.value.filter((sa) => sa.stage_id === s.id);
  }
  return map;
});

const allOfficersSummary = computed<OfficerSummary[]>(() => {
  const byUser = new Map<string, OfficerSummary>();

  for (const o of matchLevelOfficers.value) {
    if (!byUser.has(o.user_id)) {
      byUser.set(o.user_id, {
        user_id: o.user_id,
        display_name: o.display_name,
        email: o.email,
        roles: [],
        stageNumbers: [],
      });
    }
    const entry = byUser.get(o.user_id)!;
    if (!entry.roles.includes(o.role)) entry.roles.push(o.role);
  }

  for (const sa of stageAssignments.value) {
    if (!byUser.has(sa.user_id)) {
      byUser.set(sa.user_id, {
        user_id: sa.user_id,
        display_name: sa.display_name,
        email: sa.email,
        roles: [],
        stageNumbers: [],
      });
    }
    const entry = byUser.get(sa.user_id)!;
    if (!entry.roles.includes(sa.role)) entry.roles.push(sa.role);
    const stage = stages.value.find((s) => s.id === sa.stage_id);
    if (stage && !entry.stageNumbers.includes(stage.stage_number)) {
      entry.stageNumbers.push(stage.stage_number);
    }
  }

  return Array.from(byUser.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
});

const canAssign = computed(() => {
  if (!assignUserId.value || !assignRole.value) return false;
  if (isStageRole(assignRole.value) && assignStageIds.value.length === 0) return false;
  return true;
});

function isStageRole(role: string): boolean {
  return (STAGE_LEVEL_OFFICIAL_ROLES as readonly string[]).includes(role);
}

function roleColor(role: string): string {
  switch (role) {
    case 'MA': return 'red';
    case 'MM': return 'deep-orange';
    case 'ACMO': return 'purple';
    case 'CSPO': return 'teal';
    case 'SPO': return 'cyan';
    case 'CO': return 'brown';
    case 'LO': return 'blue-grey';
    case 'SCMO': return 'deep-purple';
    case 'MO': return 'blue-grey';
    default: return 'grey';
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [matchRes, stagesRes, officersRes] = await Promise.all([
      api.get<Match>(`/api/matches/${matchId}`),
      api.get<Stage[]>(`/api/matches/${matchId}/stages`),
      api.get<{ officers: OfficerEntry[]; stage_assignments: StageOfficerEntry[] }>(
        `/api/matches/${matchId}/officers`,
      ),
    ]);
    match.value = matchRes.data;
    stages.value = stagesRes.data;
    matchLevelOfficers.value = officersRes.data.officers ?? [];
    stageAssignments.value = officersRes.data.stage_assignments ?? [];
  } finally {
    loading.value = false;
  }
}

function openAssignDialog(stageId?: string) {
  // Guard against a call site passing the click Event instead of a stage id
  // (e.g. @click="openAssignDialog") — an event object would otherwise seed
  // stage_ids and get serialized into the request.
  const preset = typeof stageId === 'string' ? stageId : undefined;
  assignRole.value = 'MO';
  assignUserId.value = null;
  assignStageIds.value = preset ? [preset] : [];
  preselectedStageId.value = preset ?? null;
  showAssignDialog.value = true;
}

async function searchUsers(val: string, update: (fn: () => void) => void) {
  if (!val || val.length < 2) {
    update(() => { userSearchOptions.value = []; });
    return;
  }
  try {
    const response = await api.get<{ id: string; display_name: string; email: string }[]>(
      '/api/users/search',
      { params: { q: val } },
    );
    update(() => {
      userSearchOptions.value = response.data.map((u) => ({
        label: u.display_name,
        value: u.id,
        caption: u.email,
      }));
    });
  } catch {
    update(() => { userSearchOptions.value = []; });
  }
}

async function handleAssign() {
  if (!canAssign.value) return;
  try {
    const body: Record<string, unknown> = {
      user_id: assignUserId.value,
      role: assignRole.value,
    };
    if (isStageRole(assignRole.value)) {
      body.stage_ids = assignStageIds.value;
    }
    await api.post(`/api/matches/${matchId}/officers`, body);
    showAssignDialog.value = false;
    $q.notify({ type: 'positive', message: 'Official assigned!' });
    await loadData();
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to assign official' });
  }
}

function confirmRemove(officer: { user_id: string; display_name: string }) {
  $q.dialog({
    title: 'Remove Official',
    message: `Remove ${officer.display_name} from this match?`,
    cancel: true,
    persistent: true,
  }).onOk(() => handleRemove(officer.user_id));
}

async function handleRemove(userId: string) {
  try {
    await api.delete(`/api/matches/${matchId}/officers/${userId}`);
    $q.notify({ type: 'positive', message: 'Official removed' });
    await loadData();
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to remove official' });
  }
}

async function removeStageOfficer(so: StageOfficerEntry) {
  // Re-assign this user without this stage
  const otherStages = stageAssignments.value
    .filter((sa) => sa.user_id === so.user_id && sa.role === so.role && sa.stage_id !== so.stage_id)
    .map((sa) => sa.stage_id);

  try {
    if (otherStages.length === 0) {
      // No more stages — remove the officer entirely from stage role
      // Re-assign with empty doesn't work, so delete the stage officer entries
      // We need to re-assign to trigger the backend delete+insert flow
      // Just remove the user if they have no other roles
      const hasMatchRole = matchLevelOfficers.value.some((o) => o.user_id === so.user_id);
      const hasOtherStageRole = stageAssignments.value.some(
        (sa) => sa.user_id === so.user_id && (sa.role !== so.role || sa.stage_id !== so.stage_id),
      );
      if (!hasMatchRole && !hasOtherStageRole) {
        await api.delete(`/api/matches/${matchId}/officers/${so.user_id}`);
      } else {
        // Re-assign with a dummy then remove — or add a backend endpoint
        // For now, re-assign to no stages by posting with stage_ids containing only non-existent
        // Actually the backend deletes all for user+role then inserts — so posting with empty array would clear
        // But validation requires min 1 stage_id. Let's just delete and re-add match role if needed
        await api.delete(`/api/matches/${matchId}/officers/${so.user_id}`);
        // Re-add match-level roles
        const matchRoles = matchLevelOfficers.value.filter((o) => o.user_id === so.user_id);
        for (const mr of matchRoles) {
          await api.post(`/api/matches/${matchId}/officers`, {
            user_id: mr.user_id,
            role: mr.role,
          });
        }
        // Re-add remaining stage assignments
        const remainingStage = stageAssignments.value.filter(
          (sa) => sa.user_id === so.user_id && !(sa.role === so.role && sa.stage_id === so.stage_id),
        );
        const byRole = new Map<string, string[]>();
        for (const sa of remainingStage) {
          if (!byRole.has(sa.role)) byRole.set(sa.role, []);
          byRole.get(sa.role)!.push(sa.stage_id);
        }
        for (const [role, sids] of byRole) {
          await api.post(`/api/matches/${matchId}/officers`, {
            user_id: so.user_id,
            role,
            stage_ids: sids,
          });
        }
      }
    } else {
      // Re-assign with remaining stages
      await api.post(`/api/matches/${matchId}/officers`, {
        user_id: so.user_id,
        role: so.role,
        stage_ids: otherStages,
      });
    }
    $q.notify({ type: 'positive', message: 'Stage officer removed' });
    await loadData();
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to remove stage officer' });
  }
}

onMounted(loadData);
</script>
