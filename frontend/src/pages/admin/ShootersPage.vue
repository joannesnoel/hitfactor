<template>
  <q-page padding>
    <div class="text-h5 text-weight-bold q-mb-xs">Shooters</div>
    <div class="text-grey-7 q-mb-lg">
      Review the suggested duplicate shooters below (same person imported under a
      nickname, spelling, or middle-name variant), or search manually. Choose
      which record to keep, then merge — the merge is remembered for future imports.
    </div>

    <!-- Suggested duplicates: fuzzy-grouped candidates to review + merge -->
    <div v-if="loadingSuggestions" class="row items-center q-gutter-sm q-mb-lg text-grey-7">
      <q-spinner color="primary" size="1.5em" /> Scanning for likely duplicates…
    </div>
    <div v-else-if="suggestions.length" class="q-mb-lg">
      <div class="text-subtitle1 text-weight-medium q-mb-sm">
        Suggested matches
        <q-badge color="primary" class="q-ml-xs">{{ suggestions.length }}</q-badge>
      </div>
      <q-card
        v-for="(g, gi) in suggestions"
        :key="gi"
        flat
        bordered
        class="q-mb-sm"
      >
        <q-card-section class="q-py-sm">
          <div class="row items-center q-gutter-sm q-mb-xs">
            <q-badge :color="tierColor(g.tier)" :label="`${g.tier} · ${Math.round(g.confidence * 100)}%`" />
            <span class="text-caption text-grey-7">{{ g.reason }}</span>
            <q-space />
            <q-btn flat dense size="sm" color="grey-7" label="Dismiss" @click="dismiss(gi)" />
            <q-btn
              color="primary"
              unelevated
              dense
              size="sm"
              icon="merge"
              :label="`Merge ${g.shooters.length - 1} in`"
              :loading="g.merging"
              @click="mergeSuggestion(g, gi)"
            />
          </div>
          <q-list dense>
            <q-item
              v-for="s in g.shooters"
              :key="s.id"
              clickable
              @click="g.keepId = s.id"
            >
              <q-item-section side>
                <q-radio v-model="g.keepId" :val="s.id" dense />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ s.display_name }}
                  <q-badge v-if="s.id === g.keepId" color="green" class="q-ml-sm" label="keep" />
                </q-item-label>
                <q-item-label caption>
                  {{ s.match_count }} match{{ s.match_count === 1 ? '' : 'es' }} ·
                  {{ s.registration_count }} entries<span v-if="s.claimed"> · claimed</span><span v-if="s.member_number"> · #{{ s.member_number }}</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
    <div v-else class="text-grey-6 q-mb-lg">
      No likely duplicates found — everything looks already matched. Use search
      below for anything the suggestions miss (e.g. unrelated nicknames).
    </div>

    <div class="text-subtitle1 text-weight-medium q-mb-sm">Search all shooters</div>
    <q-input
      v-model="query"
      label="Search by name or member #"
      outlined
      dense
      debounce="300"
      clearable
      style="max-width: 420px"
      @update:model-value="search"
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <!-- Merge action bar -->
    <q-banner
      v-if="selected.length >= 2"
      class="bg-blue-1 rounded-borders q-mt-md"
      dense
    >
      <div class="row items-center q-gutter-md">
        <div>
          <span class="text-weight-medium">{{ selected.length }}</span> selected —
          keep:
          <q-select
            v-model="keepId"
            :options="keepOptions"
            dense
            options-dense
            emit-value
            map-options
            borderless
            style="display: inline-block; min-width: 220px"
          />
        </div>
        <q-space />
        <q-btn
          color="primary"
          unelevated
          dense
          icon="merge"
          :label="`Merge ${selected.length - 1} into this record`"
          :loading="merging"
          @click="confirmMerge"
        />
      </div>
    </q-banner>

    <q-table
      class="q-mt-md"
      :rows="rows"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="loading"
      :pagination="{ rowsPerPage: 0 }"
      hide-bottom
    >
      <template #body="props">
        <q-tr :props="props">
          <q-td key="select" :props="props">
            <q-checkbox
              :model-value="isSelected(props.row.id)"
              @update:model-value="(v) => toggle(props.row, v)"
            />
          </q-td>
          <q-td key="display_name" :props="props" class="text-left">
            {{ props.row.display_name }}
          </q-td>
          <q-td key="member_number" :props="props">
            {{ props.row.member_number ?? '-' }}
          </q-td>
          <q-td key="match_count" :props="props">{{ props.row.match_count }}</q-td>
          <q-td key="registration_count" :props="props">
            {{ props.row.registration_count }}
          </q-td>
          <q-td key="status" :props="props">
            <q-badge v-if="props.row.claimed" color="green" label="claimed" />
            <q-badge v-else color="grey-5" text-color="grey-9" label="imported" />
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <div
      v-if="!loading && trimmedQuery.length >= 2 && rows.length === 0"
      class="text-center text-grey q-pa-xl"
    >
      No shooters match “{{ query }}”.
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'src/boot/axios';
import type { QTableColumn } from 'quasar';

interface Shooter {
  id: string;
  display_name: string;
  member_number: string | null;
  claimed: boolean;
  roles: string[];
  match_count: number;
  registration_count: number;
}

interface SuggestionGroup {
  confidence: number;
  tier: 'high' | 'medium' | 'low';
  reason: string;
  suggested_keep_id: string;
  shooters: Shooter[];
  keepId: string; // local: which record to keep (defaults to suggested)
  merging: boolean; // local: per-group merge spinner
}

const $q = useQuasar();
const query = ref('');
const rows = ref<Shooter[]>([]);
const loading = ref(false);
const merging = ref(false);
const selected = ref<Shooter[]>([]);
const keepId = ref<string>('');
const suggestions = ref<SuggestionGroup[]>([]);
const loadingSuggestions = ref(false);
// `clearable` sets the model to null on clear, so guard before trimming.
const trimmedQuery = computed(() => (query.value ?? '').trim());

onMounted(loadSuggestions);

async function loadSuggestions(): Promise<void> {
  loadingSuggestions.value = true;
  try {
    const { data } = await api.get<SuggestionGroup[]>('/api/users/shooters/duplicates');
    suggestions.value = data.map((g) => ({
      ...g,
      keepId: g.suggested_keep_id,
      merging: false,
    }));
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load suggestions' });
  } finally {
    loadingSuggestions.value = false;
  }
}

function tierColor(tier: string): string {
  return tier === 'high' ? 'green-7' : tier === 'medium' ? 'orange-8' : 'grey-6';
}

function dismiss(index: number): void {
  suggestions.value.splice(index, 1);
}

async function mergeSuggestion(g: SuggestionGroup, index: number): Promise<void> {
  const keep = g.shooters.find((s) => s.id === g.keepId);
  const dups = g.shooters.filter((s) => s.id !== g.keepId);
  if (!keep || dups.length === 0) return;
  const claimedDup = dups.find((s) => s.claimed);
  if (claimedDup) {
    $q.notify({
      type: 'warning',
      message: `“${claimedDup.display_name}” is a claimed account — make it the keep record.`,
    });
    return;
  }
  g.merging = true;
  try {
    for (const d of dups) {
      await api.post(`/api/users/${d.id}/merge`, { into: keep.id });
    }
    $q.notify({
      type: 'positive',
      message: `Merged ${dups.length} into ${keep.display_name}.`,
    });
    suggestions.value.splice(index, 1);
    if (trimmedQuery.value.length >= 2) await search();
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Merge failed';
    $q.notify({ type: 'negative', message: msg });
  } finally {
    g.merging = false;
  }
}

const columns: QTableColumn[] = [
  { name: 'select', label: '', field: 'id', align: 'center' },
  { name: 'display_name', label: 'Name', field: 'display_name', align: 'left', sortable: true },
  { name: 'member_number', label: 'Member #', field: 'member_number', align: 'center' },
  { name: 'match_count', label: 'Matches', field: 'match_count', align: 'center', sortable: true },
  { name: 'registration_count', label: 'Entries', field: 'registration_count', align: 'center', sortable: true },
  { name: 'status', label: 'Status', field: 'claimed', align: 'center' },
];

const keepOptions = computed(() =>
  selected.value.map((s) => ({
    label: `${s.display_name}${s.member_number ? ` (#${s.member_number})` : ''}`,
    value: s.id,
  }))
);

function isSelected(id: string): boolean {
  return selected.value.some((s) => s.id === id);
}

function toggle(row: Shooter, on: boolean): void {
  if (on) {
    selected.value = [...selected.value, row];
    // Prefer a claimed record as the keep target; otherwise the first selected.
    if (!keepId.value || (row.claimed && !selected.value.some((s) => s.claimed && s.id === keepId.value))) {
      keepId.value = selected.value.find((s) => s.claimed)?.id ?? selected.value[0].id;
    }
  } else {
    selected.value = selected.value.filter((s) => s.id !== row.id);
    if (keepId.value === row.id) {
      keepId.value = selected.value.find((s) => s.claimed)?.id ?? selected.value[0]?.id ?? '';
    }
  }
}

async function search(): Promise<void> {
  const q = trimmedQuery.value;
  if (q.length < 2) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.get<Shooter[]>('/api/users/shooters', { params: { q } });
    rows.value = data;
  } catch {
    $q.notify({ type: 'negative', message: 'Search failed' });
  } finally {
    loading.value = false;
  }
}

function confirmMerge(): void {
  const keep = selected.value.find((s) => s.id === keepId.value);
  const dups = selected.value.filter((s) => s.id !== keepId.value);
  if (!keep || dups.length === 0) return;
  const claimedDup = dups.find((s) => s.claimed);
  if (claimedDup) {
    $q.notify({
      type: 'warning',
      message: `“${claimedDup.display_name}” is a claimed account — make it the keep record instead.`,
    });
    return;
  }
  $q.dialog({
    title: 'Merge shooters',
    message:
      `Merge ${dups.length} record(s) into <b>${keep.display_name}</b>? ` +
      `Their match history moves to the kept record and the duplicates are deleted. This can't be undone.`,
    html: true,
    cancel: true,
    persistent: true,
  }).onOk(() => void doMerge(keep, dups));
}

async function doMerge(keep: Shooter, dups: Shooter[]): Promise<void> {
  merging.value = true;
  let moved = 0;
  try {
    for (const dup of dups) {
      const { data } = await api.post<{ registrations_moved: number }>(
        `/api/users/${dup.id}/merge`,
        { into: keep.id }
      );
      moved += data.registrations_moved;
    }
    $q.notify({
      type: 'positive',
      message: `Merged ${dups.length} record(s) into ${keep.display_name} — ${moved} entries moved.`,
    });
    selected.value = [];
    keepId.value = '';
    await search();
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Merge failed';
    $q.notify({ type: 'negative', message: msg });
  } finally {
    merging.value = false;
  }
}
</script>
