<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">Shooting Ranges</div>
      <q-space />
      <q-btn color="primary" icon="add" label="Add Range" unelevated @click="openCreateDialog" />
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div v-if="ranges.length === 0" class="text-center text-grey q-pa-xl">
        <q-icon name="location_on" size="4em" class="q-mb-md" />
        <div class="text-h6">No ranges yet</div>
        <div>Click "Add Range" to register your first shooting range</div>
      </div>

      <div v-else class="q-gutter-md">
        <q-card v-for="range in ranges" :key="range.id" flat bordered>
          <q-card-section>
            <div class="row items-center no-wrap">
              <q-icon name="location_on" size="sm" color="primary" class="q-mr-sm" />
              <div class="col">
                <div class="text-weight-bold text-body1">{{ range.name }}</div>
                <div v-if="range.address" class="text-caption text-grey">{{ range.address }}</div>
                <div v-else class="text-caption text-grey-5 text-italic">No address</div>
              </div>
              <q-btn flat round dense icon="edit" size="sm" color="primary" @click="openEditDialog(range)">
                <q-tooltip>Edit</q-tooltip>
              </q-btn>
              <q-btn flat round dense icon="delete" size="sm" color="negative" @click="confirmDelete(range)">
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </template>

    <!-- Create/Edit Dialog -->
    <q-dialog v-model="showDialog">
      <q-card style="min-width: 450px">
        <q-card-section class="text-h6">
          {{ editing ? 'Edit Range' : 'Add Range' }}
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="form.name"
            label="Range Name"
            outlined
            dense
            :rules="[v => !!v?.trim() || 'Required']"
          />
          <q-input
            v-model="form.address"
            label="Address (optional)"
            outlined
            dense
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            :label="editing ? 'Save' : 'Create'"
            unelevated
            :disable="!form.name?.trim()"
            :loading="saving"
            @click="handleSave"
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
import type { ShootingRange } from '@hitfactor/shared';

const $q = useQuasar();
const loading = ref(true);
const saving = ref(false);
const ranges = ref<ShootingRange[]>([]);

const showDialog = ref(false);
const editing = ref<ShootingRange | null>(null);
const form = ref({ name: '', address: '' });

onMounted(() => loadRanges());

async function loadRanges() {
  loading.value = true;
  try {
    const response = await api.get<ShootingRange[]>('/api/ranges');
    ranges.value = response.data;
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load ranges' });
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editing.value = null;
  form.value = { name: '', address: '' };
  showDialog.value = true;
}

function openEditDialog(range: ShootingRange) {
  editing.value = range;
  form.value = { name: range.name, address: range.address ?? '' };
  showDialog.value = true;
}

async function handleSave() {
  saving.value = true;
  try {
    const body = {
      name: form.value.name.trim(),
      address: form.value.address.trim() || undefined,
    };

    if (editing.value) {
      await api.patch(`/api/ranges/${editing.value.id}`, body);
      $q.notify({ type: 'positive', message: 'Range updated' });
    } else {
      await api.post('/api/ranges', body);
      $q.notify({ type: 'positive', message: 'Range created' });
    }

    showDialog.value = false;
    await loadRanges();
  } catch {
    $q.notify({ type: 'negative', message: `Failed to ${editing.value ? 'update' : 'create'} range` });
  } finally {
    saving.value = false;
  }
}

function confirmDelete(range: ShootingRange) {
  $q.dialog({
    title: 'Delete Range',
    message: `Delete "${range.name}"? This cannot be undone.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/api/ranges/${range.id}`);
      $q.notify({ type: 'positive', message: 'Range deleted' });
      await loadRanges();
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to delete range' });
    }
  });
}
</script>
