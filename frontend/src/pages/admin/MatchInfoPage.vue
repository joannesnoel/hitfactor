<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else-if="match">
      <q-card flat bordered class="q-pa-md">
        <div class="q-gutter-md">
          <div class="row q-gutter-md">
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Match Level</div>
              <div>Level {{ match.level }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Dates</div>
              <div>{{ formatDateRange(match.start_date, match.end_date) }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Location</div>
              <div>{{ match.location }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Max Shooters</div>
              <div>{{ match.max_shooters ?? 'Unlimited' }}</div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">Registration</div>
              <div>{{ match.registration_open ? 'Open' : 'Closed' }}</div>
            </div>
          </div>
          <div v-if="match.description">
            <div class="text-caption text-grey">Description</div>
            <div>{{ match.description }}</div>
          </div>
        </div>

        <q-separator class="q-my-md" />

        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            label="Edit Match"
            icon="edit"
            @click="openEditDialog"
          />
          <q-btn
            outline
            :color="match.registration_open ? 'orange' : 'green'"
            :label="match.registration_open ? 'Close Registration' : 'Open Registration'"
            @click="toggleRegistration"
          />
          <q-select
            v-model="newStatus"
            :options="statusOptions"
            label="Change Status"
            emit-value
            map-options
            outlined
            dense
            style="min-width: 180px"
            @update:model-value="updateStatus"
          />
        </div>
      </q-card>
    </template>

    <!-- Edit Dialog -->
    <q-dialog v-model="showEditDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-h6">Edit Match</q-card-section>
        <q-card-section>
          <q-form @submit.prevent="saveEdit" class="q-gutter-md">
            <q-input v-model="editForm.name" label="Name" outlined dense />
            <q-input v-model="editForm.start_date" label="Start Date" type="date" outlined dense />
            <q-input v-model="editForm.end_date" label="End Date (optional)" type="date" outlined dense clearable />
            <q-input v-model="editForm.location" label="Location" outlined dense />
            <q-input v-model="editForm.description" label="Description" type="textarea" outlined dense autogrow />
          </q-form>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" unelevated @click="saveEdit" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, inject } from 'vue';
import type { Ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import { MATCH_STATUSES } from '@hitfactor/shared';
import type { Match, MatchStatus } from '@hitfactor/shared';

const $q = useQuasar();

const ctx = inject<{
  match: Ref<Match | null>;
  matchId: string;
  loading: Ref<boolean>;
}>('matchContext')!;

const { match, matchId, loading } = ctx;

const showEditDialog = ref(false);
const newStatus = ref<MatchStatus | null>(null);

const editForm = reactive({
  name: '',
  start_date: '',
  end_date: '' as string | null,
  location: '',
  description: '',
});

const statusOptions = MATCH_STATUSES.map((s) => ({ label: s, value: s }));

function openEditDialog() {
  if (match.value) {
    editForm.name = match.value.name;
    editForm.start_date = match.value.start_date;
    editForm.end_date = match.value.end_date;
    editForm.location = match.value.location;
    editForm.description = match.value.description ?? '';
  }
  showEditDialog.value = true;
}

function formatDateRange(start: string, end: string | null): string {
  const startDate = new Date(start).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
  if (!end || end === start) return startDate;
  const endDate = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startDate} – ${endDate}`;
}

async function toggleRegistration() {
  if (!match.value) return;
  try {
    await api.patch(`/api/matches/${matchId}`, {
      registration_open: !match.value.registration_open,
    });
    match.value.registration_open = !match.value.registration_open;
    $q.notify({ type: 'positive', message: 'Registration updated' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update registration' });
  }
}

async function updateStatus(status: MatchStatus) {
  try {
    await api.patch(`/api/matches/${matchId}`, { status });
    if (match.value) match.value.status = status;
    $q.notify({ type: 'positive', message: `Status changed to ${status}` });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update status' });
  }
}

async function saveEdit() {
  try {
    await api.patch(`/api/matches/${matchId}`, editForm);
    if (match.value) {
      match.value.name = editForm.name;
      match.value.start_date = editForm.start_date;
      match.value.end_date = editForm.end_date || null;
      match.value.location = editForm.location;
      match.value.description = editForm.description || null;
    }
    $q.notify({ type: 'positive', message: 'Match updated' });
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update match' });
  }
}
</script>
