<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <q-btn flat round icon="arrow_back" @click="$router.back()" />
      <div class="text-h5 text-weight-bold q-ml-sm">Create Match</div>
    </div>

    <q-card class="q-pa-md" style="max-width: 700px">
      <q-card-section>
        <q-form @submit.prevent="handleCreate" class="q-gutter-md">
          <q-input
            v-model="form.name"
            label="Match Name"
            outlined
            :rules="[(val: string) => !!val || 'Match name is required']"
          >
            <template #prepend>
              <q-icon name="emoji_events" />
            </template>
          </q-input>

          <div class="row q-gutter-md">
            <q-input
              v-model="form.start_date"
              label="Start Date"
              type="date"
              outlined
              class="col"
              :rules="[(val: string) => !!val || 'Start date is required']"
            >
              <template #prepend>
                <q-icon name="event" />
              </template>
            </q-input>

            <q-input
              v-model="form.end_date"
              label="End Date (optional)"
              type="date"
              outlined
              class="col"
              clearable
              hint="Leave empty for single-day events"
            >
              <template #prepend>
                <q-icon name="event" />
              </template>
            </q-input>
          </div>

          <!-- Location (shooting range) autocomplete -->
          <q-select
            v-model="selectedRange"
            label="Shooting Range / Location"
            :options="rangeOptions"
            option-label="name"
            option-value="id"
            outlined
            use-input
            clearable
            input-debounce="300"
            :rules="[(val: RangeOption | null) => !!val || 'Location is required']"
            @filter="onRangeFilter"
          >
            <template #prepend>
              <q-icon name="location_on" />
            </template>

            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.name }}</q-item-label>
                  <q-item-label v-if="scope.opt.address" caption>{{ scope.opt.address }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>

            <template v-slot:selected-item="scope">
              <span v-if="scope.opt">{{ scope.opt.name }}</span>
            </template>

            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey text-caption">
                  No ranges found.
                </q-item-section>
              </q-item>
              <q-item clickable @click="openCreateRangeDialog">
                <q-item-section avatar>
                  <q-icon name="add_location" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-primary">Add new shooting range...</q-item-label>
                </q-item-section>
              </q-item>
            </template>

            <template v-slot:after-options>
              <q-item clickable @click="openCreateRangeDialog">
                <q-item-section avatar>
                  <q-icon name="add_location" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-primary">Add new shooting range...</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input
            v-model="form.description"
            label="Description (optional)"
            type="textarea"
            outlined
            autogrow
          />

          <div class="row q-gutter-md">
            <q-select
              v-model="form.organization"
              :options="organizationOptions"
              label="Organization"
              emit-value
              map-options
              outlined
              class="col"
              hint="Determines division names for this match"
            />

            <q-select
              v-model="form.level"
              :options="levelOptions"
              label="Match Level"
              emit-value
              map-options
              outlined
              class="col"
            />
          </div>

          <q-input
            v-model.number="form.max_shooters"
            label="Max Shooters (optional)"
            type="number"
            outlined
          />

          <!-- Match Officials Section -->
          <q-separator class="q-my-sm" />
          <div class="text-subtitle1 text-weight-medium">
            Match Officials
            <span class="text-caption text-grey q-ml-sm">(optional)</span>
          </div>
          <div class="text-caption text-grey q-mb-sm">
            You will be automatically assigned as Match Administrator (MA).
          </div>

          <div
            v-for="role in assignableRoles"
            :key="role.value"
            class="row items-start q-gutter-sm"
          >
            <q-select
              v-model="officials[role.value]"
              :label="role.label"
              :options="getFilteredOptions(role.value)"
              option-label="display_name"
              option-value="id"
              outlined
              dense
              use-input
              clearable
              input-debounce="300"
              class="col"
              @filter="(val: string, update: (fn: () => void) => void) => onUserFilter(role.value, val, update)"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar>
                    <q-avatar color="grey-4" text-color="grey-8" size="28px">
                      {{ scope.opt.display_name.charAt(0).toUpperCase() }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.display_name }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.email }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>

              <template v-slot:selected-item="scope">
                <div class="row items-center no-wrap q-gutter-xs" v-if="scope.opt">
                  <q-avatar color="grey-4" text-color="grey-8" size="22px">
                    {{ scope.opt.display_name.charAt(0).toUpperCase() }}
                  </q-avatar>
                  <span>{{ scope.opt.display_name }}</span>
                  <span class="text-caption text-grey">({{ scope.opt.email }})</span>
                </div>
              </template>

              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey text-caption">
                    No users found.
                  </q-item-section>
                </q-item>
                <q-item clickable @click="openCreateOfficerDialog(role.value)">
                  <q-item-section avatar>
                    <q-icon name="person_add" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-primary">Create new officer...</q-item-label>
                  </q-item-section>
                </q-item>
              </template>

              <template v-slot:after-options>
                <q-item clickable @click="openCreateOfficerDialog(role.value)">
                  <q-item-section avatar>
                    <q-icon name="person_add" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-primary">Create new officer...</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>

          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn flat label="Cancel" @click="$router.back()" />
            <q-btn
              type="submit"
              color="primary"
              label="Create Match"
              unelevated
              :loading="saving"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Create Shooting Range Dialog -->
    <q-dialog v-model="showCreateRangeDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-h6">Add Shooting Range</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="newRange.name"
            label="Range Name"
            outlined
            dense
            :rules="[(val: string) => !!val || 'Name is required']"
          />
          <q-input
            v-model="newRange.address"
            label="Address (optional)"
            outlined
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            unelevated
            :loading="creatingRange"
            :disable="!newRange.name"
            @click="createNewRange"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create Officer Dialog -->
    <q-dialog v-model="showCreateOfficerDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-h6">Create New Officer</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="newOfficer.display_name"
            label="Full Name"
            outlined
            dense
            :rules="[(val: string) => !!val || 'Name is required']"
          />
          <q-input
            v-model="newOfficer.email"
            label="Email"
            type="email"
            outlined
            dense
            :rules="[
              (val: string) => !!val || 'Email is required',
              (val: string) => /.+@.+\..+/.test(val) || 'Invalid email',
            ]"
          />
          <q-input
            v-model="newOfficer.member_number"
            label="Member Number (optional)"
            outlined
            dense
          />
          <div class="text-caption text-grey">
            An account will be created with a temporary password.
            The officer can reset it later.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            unelevated
            :loading="creatingOfficer"
            :disable="!newOfficer.display_name || !newOfficer.email"
            @click="createNewOfficer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import {
  MATCH_LEVELS,
  MATCH_LEVEL_OFFICIAL_ROLES,
  MATCH_OFFICIAL_ROLE_LABELS,
  ORGANIZATIONS,
  DEFAULT_ORGANIZATION,
} from '@hitfactor/shared';
import type {
  CreateMatchInput,
  MatchLevel,
  Organization,
} from '@hitfactor/shared';

const router = useRouter();
const $q = useQuasar();
const saving = ref(false);

interface UserOption {
  id: string;
  display_name: string;
  email: string;
  roles?: string[];
}

interface RangeOption {
  id: string;
  name: string;
  address: string | null;
}

const form = reactive<{
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  level: MatchLevel;
  organization: Organization;
  max_shooters: number | undefined;
}>({
  name: '',
  start_date: '',
  end_date: '',
  description: '',
  level: 'I',
  organization: DEFAULT_ORGANIZATION,
  max_shooters: undefined,
});

// Location (shooting range)
const selectedRange = ref<RangeOption | null>(null);
const rangeOptions = ref<RangeOption[]>([]);
const showCreateRangeDialog = ref(false);
const creatingRange = ref(false);
const newRange = reactive({ name: '', address: '' });

// Officials — one optional user per match-level role (excluding MA)
const assignableRoles = MATCH_LEVEL_OFFICIAL_ROLES
  .filter((r) => r !== 'MA')
  .map((r) => ({
    value: r,
    label: `${r} — ${MATCH_OFFICIAL_ROLE_LABELS[r]}`,
  }));

const officials = reactive<Record<string, UserOption | null>>(
  Object.fromEntries(assignableRoles.map((r) => [r.value, null]))
);

const searchResults = reactive<Record<string, UserOption[]>>(
  Object.fromEntries(assignableRoles.map((r) => [r.value, []]))
);

// Create officer dialog
const showCreateOfficerDialog = ref(false);
const creatingOfficer = ref(false);
const createForRole = ref('');
const newOfficer = reactive({
  display_name: '',
  email: '',
  member_number: '',
});

const levelOptions = MATCH_LEVELS.map((l) => ({ label: `Level ${l}`, value: l }));
const organizationOptions = ORGANIZATIONS.map((o) => ({ label: o, value: o }));

// ─── Range autocomplete ─────────────────────────

async function onRangeFilter(val: string, update: (fn: () => void) => void) {
  if (val.length < 2) {
    update(() => { rangeOptions.value = []; });
    return;
  }
  try {
    const response = await api.get('/api/ranges/search', { params: { q: val } });
    update(() => { rangeOptions.value = response.data; });
  } catch {
    update(() => { rangeOptions.value = []; });
  }
}

function openCreateRangeDialog() {
  newRange.name = '';
  newRange.address = '';
  showCreateRangeDialog.value = true;
}

async function createNewRange() {
  creatingRange.value = true;
  try {
    const response = await api.post('/api/ranges', {
      name: newRange.name,
      address: newRange.address || undefined,
    });
    const range: RangeOption = response.data;
    selectedRange.value = range;
    showCreateRangeDialog.value = false;
    $q.notify({ type: 'positive', message: `Range "${range.name}" created` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create range';
    $q.notify({ type: 'negative', message });
  } finally {
    creatingRange.value = false;
  }
}

// ─── Officer autocomplete ───────────────────────

function getFilteredOptions(role: string): UserOption[] {
  return searchResults[role] ?? [];
}

async function onUserFilter(
  role: string,
  val: string,
  update: (fn: () => void) => void
) {
  if (val.length < 2) {
    update(() => { searchResults[role] = []; });
    return;
  }
  try {
    const response = await api.get('/api/users/search', { params: { q: val } });
    update(() => { searchResults[role] = response.data; });
  } catch {
    update(() => { searchResults[role] = []; });
  }
}

function openCreateOfficerDialog(role: string) {
  createForRole.value = role;
  newOfficer.display_name = '';
  newOfficer.email = '';
  newOfficer.member_number = '';
  showCreateOfficerDialog.value = true;
}

async function createNewOfficer() {
  creatingOfficer.value = true;
  try {
    const response = await api.post('/api/users/officers', {
      display_name: newOfficer.display_name,
      email: newOfficer.email,
      member_number: newOfficer.member_number || undefined,
    });
    const user: UserOption = response.data;
    officials[createForRole.value] = user;
    showCreateOfficerDialog.value = false;
    $q.notify({ type: 'positive', message: `Officer "${user.display_name}" created` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create officer';
    $q.notify({ type: 'negative', message });
  } finally {
    creatingOfficer.value = false;
  }
}

// ─── Create match ───────────────────────────────

async function handleCreate() {
  if (!selectedRange.value) return;

  saving.value = true;
  try {
    const input: CreateMatchInput = {
      name: form.name,
      start_date: form.start_date,
      location: selectedRange.value.name,
      level: form.level,
      organization: form.organization,
    };
    if (form.end_date) input.end_date = form.end_date;
    if (form.description) input.description = form.description;
    if (form.max_shooters) input.max_shooters = form.max_shooters;

    const response = await api.post('/api/matches', input);
    const matchId = response.data.id;

    // Assign each selected official
    const assignments = Object.entries(officials)
      .filter(([, user]) => user !== null)
      .map(([role, user]) =>
        api.post(`/api/matches/${matchId}/officers`, {
          user_id: (user as UserOption).id,
          role,
        })
      );

    if (assignments.length > 0) {
      await Promise.all(assignments);
    }

    $q.notify({ type: 'positive', message: 'Match created!' });
    router.push(`/admin/matches/${matchId}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create match';
    $q.notify({ type: 'negative', message });
  } finally {
    saving.value = false;
  }
}
</script>
