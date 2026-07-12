<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-xs">Accounts</div>
    <div class="text-grey-7 q-mb-lg">
      Shooters who have signed up (claimed an account). Edit a name here to fix a
      typo — it updates the account and future imports, but leaves past match
      results as-is.
    </div>

    <q-table
      :rows="accounts"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="loading"
      :pagination="{ rowsPerPage: 0, sortBy: 'display_name' }"
      hide-bottom
    >
      <template #body-cell-email_verified="props">
        <q-td :props="props">
          <q-badge
            :color="props.row.email_verified ? 'green' : 'orange'"
            :label="props.row.email_verified ? 'verified' : 'unverified'"
          />
        </q-td>
      </template>
      <template #body-cell-roles="props">
        <q-td :props="props">
          <q-badge
            v-for="r in props.row.roles"
            :key="r"
            color="grey-3"
            text-color="grey-9"
            class="q-mr-xs"
            :label="r"
          />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            dense
            round
            icon="edit"
            color="primary"
            @click="openEdit(props.row)"
          >
            <q-tooltip>Edit name</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-if="!loading && accounts.length === 0" class="text-center text-grey q-pa-xl">
      No accounts yet — shooters appear here once they sign up.
    </div>

    <!-- Edit dialog -->
    <q-dialog v-model="editOpen">
      <q-card style="min-width: 360px">
        <q-card-section class="text-h6">Edit account</q-card-section>
        <q-card-section class="q-pt-none">
          <div class="text-caption text-grey-7 q-mb-sm">
            {{ editing?.email }}
          </div>
          <q-input
            v-model="editName"
            label="Name"
            outlined
            dense
            autofocus
            :rules="[(v: string) => !!(v && v.trim()) || 'Name is required']"
            @keyup.enter="save"
          />
          <div class="text-caption text-grey-6 q-mt-xs">
            Format: LAST, FIRST. This changes the account and future imports; it
            doesn't rewrite past match standings.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup :disable="saving" />
          <q-btn
            color="primary"
            unelevated
            label="Save"
            :loading="saving"
            :disable="!editName.trim() || editName.trim() === editing?.display_name"
            @click="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import type { QTableColumn } from 'quasar';

interface Account {
  id: string;
  display_name: string;
  email: string | null;
  member_number: string | null;
  email_verified: boolean;
  roles: string[];
  created_at: string;
}

const $q = useQuasar();
const accounts = ref<Account[]>([]);
const loading = ref(false);

const editOpen = ref(false);
const editing = ref<Account | null>(null);
const editName = ref('');
const saving = ref(false);

const columns: QTableColumn[] = [
  { name: 'display_name', label: 'Name', field: 'display_name', align: 'left', sortable: true },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'email_verified', label: 'Verified', field: 'email_verified', align: 'center' },
  { name: 'member_number', label: 'Member #', field: (r) => r.member_number ?? '-', align: 'center' },
  { name: 'roles', label: 'Roles', field: 'roles', align: 'left' },
  {
    name: 'created_at',
    label: 'Signed up',
    field: 'created_at',
    align: 'center',
    format: (v: string) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    sortable: true,
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await api.get<Account[]>('/api/users/accounts');
    accounts.value = data;
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load accounts' });
  } finally {
    loading.value = false;
  }
}

function openEdit(row: Account): void {
  editing.value = row;
  editName.value = row.display_name;
  editOpen.value = true;
}

async function save(): Promise<void> {
  if (!editing.value) return;
  const name = editName.value.trim();
  if (!name || name === editing.value.display_name) return;
  saving.value = true;
  try {
    const { data } = await api.patch<Account>(`/api/users/${editing.value.id}`, {
      display_name: name,
    });
    const idx = accounts.value.findIndex((a) => a.id === data.id);
    if (idx !== -1) accounts.value[idx] = { ...accounts.value[idx], ...data };
    $q.notify({ type: 'positive', message: 'Name updated' });
    editOpen.value = false;
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Update failed';
    $q.notify({ type: 'negative', message: msg });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
