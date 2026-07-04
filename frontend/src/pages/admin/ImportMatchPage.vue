<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-xs">Import Match Results</div>
    <div class="text-body2 text-grey q-mb-lg">
      Upload a PractiScore <code>.psc</code> match file. Shooters become unclaimed
      accounts and are matched to existing ones by name across matches. Preview
      first, then import — re-importing the same match is safe (it updates in place).
    </div>

    <q-card flat bordered class="q-pa-md" style="max-width: 680px">
      <q-file
        v-model="file"
        label="PractiScore .psc file"
        accept=".psc"
        outlined
        dense
        clearable
        :disable="loading"
        @update:model-value="onFileChange"
      >
        <template #prepend><q-icon name="attach_file" /></template>
      </q-file>

      <q-checkbox
        v-model="inProgress"
        dense
        class="q-mt-sm"
        label="Match still in progress"
        :disable="loading"
      />
      <div class="text-caption text-grey q-ml-lg">
        Marks the match as ongoing (not completed). Re-upload the latest
        <code>.psc</code> any time to refresh scores — it updates the same match
        by its PractiScore ID and reconciles removed entries.
      </div>

      <div class="row q-gutter-sm q-mt-md">
        <q-btn
          color="primary"
          outline
          label="Preview"
          icon="visibility"
          :disable="!file || loading"
          :loading="loading && pending === 'preview'"
          @click="run(false)"
        />
        <q-btn
          color="primary"
          label="Import"
          icon="upload"
          :disable="!canCommit || loading"
          :loading="loading && pending === 'commit'"
          @click="run(true)"
        />
      </div>

      <q-banner v-if="error" class="bg-red-1 text-red-9 q-mt-md" rounded dense>
        <template #avatar><q-icon name="error" color="red" /></template>
        {{ error }}
      </q-banner>
    </q-card>

    <!-- Summary -->
    <q-card
      v-if="summary"
      flat
      bordered
      class="q-pa-md q-mt-lg"
      style="max-width: 680px"
    >
      <div class="text-subtitle1 text-weight-bold q-mb-md">
        <q-icon :name="summary.dryRun ? 'visibility' : 'check_circle'" :color="summary.dryRun ? 'primary' : 'green'" />
        {{ summary.dryRun ? 'Preview' : 'Imported' }} — {{ summary.match }}
      </div>

      <div class="row q-col-gutter-md q-mb-sm text-center">
        <div v-for="stat in stats" :key="stat.label" class="col-4 col-sm-2">
          <div class="text-h5 text-primary">{{ stat.value }}</div>
          <div class="text-caption text-grey">{{ stat.label }}</div>
        </div>
      </div>

      <q-banner
        v-if="summary.warnings.length"
        class="bg-orange-1 text-orange-9 q-mt-sm"
        rounded
        dense
      >
        <div class="text-weight-medium">{{ summary.warnings.length }} warning(s):</div>
        <div v-for="(w, i) in summary.warnings" :key="i" class="text-caption">• {{ w }}</div>
      </q-banner>

      <q-banner
        v-if="summary.dryRun"
        class="bg-blue-1 text-blue-9 q-mt-sm"
        rounded
        dense
      >
        This was a preview — nothing was saved. Click <b>Import</b> to commit.
      </q-banner>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';

interface ImportSummary {
  match: string;
  matchCreated: boolean;
  stages: number;
  shootersCreated: number;
  shootersMatched: number;
  registrations: number;
  scores: number;
  scored: number;
  scoresRemoved?: number;
  registrationsRemoved?: number;
  warnings: string[];
  dryRun: boolean;
}

const $q = useQuasar();
const file = ref<File | null>(null);
const inProgress = ref(false);
const summary = ref<ImportSummary | null>(null);
const loading = ref(false);
const pending = ref<'preview' | 'commit' | null>(null);
const error = ref<string | null>(null);

// Import is enabled only after a successful preview of the current file.
const canCommit = computed(() => Boolean(summary.value?.dryRun));

const stats = computed(() => {
  const p = summary.value;
  if (!p) return [];
  const rows = [
    { label: 'Stages', value: p.stages },
    { label: 'New shooters', value: p.shootersCreated },
    { label: 'Matched', value: p.shootersMatched },
    { label: 'Registrations', value: p.registrations },
    { label: 'Scores', value: p.scores },
    { label: 'Timed', value: p.scored },
  ];
  if (p.scoresRemoved) rows.push({ label: 'Scores removed', value: p.scoresRemoved });
  if (p.registrationsRemoved)
    rows.push({ label: 'Entries removed', value: p.registrationsRemoved });
  return rows;
});

function onFileChange() {
  summary.value = null;
  error.value = null;
}

async function run(commit: boolean) {
  if (!file.value) return;
  loading.value = true;
  pending.value = commit ? 'commit' : 'preview';
  error.value = null;
  try {
    const form = new FormData();
    form.append('file', file.value);
    const res = await api.post<ImportSummary>('/api/admin/import', form, {
      params: {
        commit: commit ? 'true' : 'false',
        in_progress: inProgress.value ? 'true' : 'false',
      },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    summary.value = res.data;
    if (commit) {
      $q.notify({ type: 'positive', message: 'Match imported', position: 'top' });
    }
  } catch (e) {
    const err = e as { response?: { data?: { message?: string } }; message?: string };
    error.value = err.response?.data?.message ?? err.message ?? 'Import failed';
    if (commit) summary.value = null;
  } finally {
    loading.value = false;
    pending.value = null;
  }
}
</script>
