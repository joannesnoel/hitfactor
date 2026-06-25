<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">Match Officials</div>
      <q-space />
      <q-btn color="primary" icon="person_add" label="Add Official" unelevated @click="openCreateDialog" />
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <!-- Officers List -->
      <q-table
        :rows="officers"
        :columns="columns"
        row-key="id"
        flat
        bordered
        :filter="filter"
        :pagination="{ rowsPerPage: 25 }"
      >
        <template #top-right>
          <q-input v-model="filter" dense outlined placeholder="Search..." clearable>
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>

        <template #body-cell-roles="props">
          <q-td :props="props">
            <q-badge
              v-for="role in props.row.roles"
              :key="role"
              :color="roleColor(role)"
              text-color="white"
              class="q-mr-xs"
            >
              {{ role }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="q-gutter-xs">
            <q-btn flat round dense icon="edit" size="sm" color="primary" @click="openEditDialog(props.row)">
              <q-tooltip>Edit roles</q-tooltip>
            </q-btn>
            <q-btn flat round dense icon="delete" size="sm" color="negative" @click="confirmDelete(props.row)">
              <q-tooltip>Remove</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>

      <div v-if="officers.length === 0" class="text-center text-grey q-pa-xl">
        <q-icon name="security" size="4em" class="q-mb-md" />
        <div class="text-h6">No officials yet</div>
        <div>Click "Add Official" to create your first match official</div>
      </div>
    </template>

    <!-- Create Officer Dialog -->
    <q-dialog v-model="showCreateDialog">
      <q-card style="min-width: 450px">
        <q-card-section class="text-h6">Add Match Official</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-tabs v-model="createTab" dense active-color="primary" indicator-color="primary" narrow-indicator align="left">
            <q-tab name="new" label="New User" />
            <q-tab name="existing" label="Existing User" />
          </q-tabs>

          <q-tab-panels v-model="createTab" animated>
            <!-- Create new officer user -->
            <q-tab-panel name="new" class="q-pa-none q-pt-md">
              <q-input v-model="createForm.display_name" label="Display Name" outlined dense />
              <q-input v-model="createForm.email" label="Email" type="email" outlined dense class="q-mt-md" />
              <q-input v-model="createForm.member_number" label="Member Number (optional)" outlined dense class="q-mt-md" />
            </q-tab-panel>

            <!-- Promote existing user -->
            <q-tab-panel name="existing" class="q-pa-none q-pt-md">
              <q-input
                v-model="userSearchQuery"
                label="Search by name or email"
                outlined
                dense
                debounce="300"
                @update:model-value="searchUsers"
              >
                <template #append>
                  <q-icon name="search" />
                </template>
              </q-input>

              <q-list v-if="searchResults.length > 0" bordered separator class="rounded-borders q-mt-sm" style="max-height: 250px; overflow-y: auto">
                <q-item
                  v-for="user in searchResults"
                  :key="user.id"
                  clickable
                  @click="selectedExistingUser = user"
                  :active="selectedExistingUser?.id === user.id"
                  active-class="bg-blue-1"
                  dense
                >
                  <q-item-section avatar>
                    <q-avatar color="grey-4" text-color="grey-8" size="32px">
                      {{ user.display_name.charAt(0).toUpperCase() }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ user.display_name }}</q-item-label>
                    <q-item-label caption>{{ user.email }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge
                      v-for="role in user.roles"
                      :key="role"
                      :color="roleColor(role)"
                      text-color="white"
                      class="q-ml-xs"
                    >
                      {{ role }}
                    </q-badge>
                  </q-item-section>
                </q-item>
              </q-list>

              <q-banner v-if="selectedExistingUser" class="bg-blue-1 rounded-borders q-mt-sm" dense>
                Selected: <strong>{{ selectedExistingUser.display_name }}</strong> ({{ selectedExistingUser.email }})
                <div class="text-caption q-mt-xs">
                  Current roles: {{ selectedExistingUser.roles.join(', ') }}
                  <span v-if="selectedExistingUser.roles.includes('officer')" class="text-positive"> - already an officer</span>
                </div>
              </q-banner>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            :label="createTab === 'new' ? 'Create' : 'Add Officer Role'"
            unelevated
            :disable="!canCreate"
            :loading="saving"
            @click="handleCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Roles Dialog -->
    <q-dialog v-model="showEditDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="text-h6">Edit Roles</q-card-section>
        <q-card-section>
          <q-banner class="bg-blue-1 rounded-borders q-mb-md" dense>
            {{ editingUser?.display_name }} ({{ editingUser?.email }})
          </q-banner>
          <div class="q-gutter-sm">
            <q-checkbox v-model="editRoles" val="admin" label="Admin" dense />
            <q-checkbox v-model="editRoles" val="officer" label="Officer" dense />
            <q-checkbox v-model="editRoles" val="shooter" label="Shooter" dense />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" unelevated :loading="saving" @click="saveRoles" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import type { QTableColumn } from 'quasar';

interface OfficerUser {
  id: string;
  email: string;
  display_name: string;
  member_number: string | null;
  roles: string[];
  created_at: string;
}

interface SearchUser {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
}

const $q = useQuasar();
const loading = ref(true);
const saving = ref(false);
const officers = ref<OfficerUser[]>([]);
const filter = ref('');

// Create dialog
const showCreateDialog = ref(false);
const createTab = ref<'new' | 'existing'>('new');
const createForm = ref({ display_name: '', email: '', member_number: '' });
const userSearchQuery = ref('');
const searchResults = ref<SearchUser[]>([]);
const selectedExistingUser = ref<SearchUser | null>(null);

// Edit dialog
const showEditDialog = ref(false);
const editingUser = ref<OfficerUser | null>(null);
const editRoles = ref<string[]>([]);

const columns: QTableColumn[] = [
  { name: 'display_name', label: 'Name', field: 'display_name', align: 'left', sortable: true },
  { name: 'email', label: 'Email', field: 'email', align: 'left', sortable: true },
  { name: 'member_number', label: 'Member #', field: 'member_number', align: 'center', format: (val: string | null) => val ?? '-' },
  { name: 'roles', label: 'Roles', field: 'roles', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const canCreate = computed(() => {
  if (createTab.value === 'new') {
    return createForm.value.display_name.trim().length > 0 && createForm.value.email.trim().length > 0;
  }
  return selectedExistingUser.value !== null && !selectedExistingUser.value.roles.includes('officer');
});

onMounted(() => loadOfficers());

async function loadOfficers() {
  loading.value = true;
  try {
    const response = await api.get<OfficerUser[]>('/api/users/officers');
    officers.value = response.data;
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load officials' });
  } finally {
    loading.value = false;
  }
}

function roleColor(role: string): string {
  switch (role) {
    case 'admin': return 'red';
    case 'officer': return 'blue';
    case 'shooter': return 'green';
    default: return 'grey';
  }
}

function openCreateDialog() {
  createTab.value = 'new';
  createForm.value = { display_name: '', email: '', member_number: '' };
  userSearchQuery.value = '';
  searchResults.value = [];
  selectedExistingUser.value = null;
  showCreateDialog.value = true;
}

async function searchUsers(query: string) {
  if (!query || query.trim().length < 2) {
    searchResults.value = [];
    return;
  }
  try {
    const response = await api.get<SearchUser[]>('/api/users/search', { params: { q: query } });
    searchResults.value = response.data;
  } catch {
    searchResults.value = [];
  }
}

async function handleCreate() {
  saving.value = true;
  try {
    if (createTab.value === 'new') {
      await api.post('/api/users/officers', {
        display_name: createForm.value.display_name.trim(),
        email: createForm.value.email.trim(),
        member_number: createForm.value.member_number.trim() || undefined,
      });
      $q.notify({ type: 'positive', message: 'Official created' });
    } else if (selectedExistingUser.value) {
      const newRoles = [...new Set([...selectedExistingUser.value.roles, 'officer'])];
      await api.patch(`/api/users/${selectedExistingUser.value.id}/roles`, { roles: newRoles });
      $q.notify({ type: 'positive', message: `${selectedExistingUser.value.display_name} promoted to officer` });
    }
    showCreateDialog.value = false;
    await loadOfficers();
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to add official' });
  } finally {
    saving.value = false;
  }
}

function openEditDialog(user: OfficerUser) {
  editingUser.value = user;
  editRoles.value = [...user.roles];
  showEditDialog.value = true;
}

async function saveRoles() {
  if (!editingUser.value) return;
  if (editRoles.value.length === 0) {
    $q.notify({ type: 'warning', message: 'User must have at least one role' });
    return;
  }
  saving.value = true;
  try {
    await api.patch(`/api/users/${editingUser.value.id}/roles`, { roles: editRoles.value });
    $q.notify({ type: 'positive', message: 'Roles updated' });
    showEditDialog.value = false;
    await loadOfficers();
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to update roles' });
  } finally {
    saving.value = false;
  }
}

function confirmDelete(user: OfficerUser) {
  $q.dialog({
    title: 'Remove Official',
    message: `Remove ${user.display_name} (${user.email})? This will delete the user account entirely.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/api/users/${user.id}`);
      $q.notify({ type: 'positive', message: 'User removed' });
      await loadOfficers();
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to remove user' });
    }
  });
}
</script>
