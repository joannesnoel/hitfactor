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

    <!-- Dedicated two-shooter picker -->
    <q-card flat bordered class="q-mb-lg" style="max-width: 720px">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-xs">
          Merge two shooters
        </div>
        <div class="text-caption text-grey-7 q-mb-md">
          Pick two records that are the same person, choose which to keep, then merge.
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="shooterA"
              :options="optionsA"
              :option-label="shooterLabel"
              label="Shooter A"
              outlined
              dense
              clearable
              use-input
              input-debounce="300"
              hide-dropdown-icon
              @filter="(v, u) => filterShooters(v, u, 'A')"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.display_name }}</q-item-label>
                    <q-item-label caption>{{ shooterMeta(scope.opt) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">Type a name or member #</q-item-section></q-item>
              </template>
            </q-select>
            <div v-if="shooterA" class="text-caption text-grey-7 q-mt-xs q-ml-xs">
              {{ shooterMeta(shooterA) }}
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="shooterB"
              :options="optionsB"
              :option-label="shooterLabel"
              label="Shooter B"
              outlined
              dense
              clearable
              use-input
              input-debounce="300"
              hide-dropdown-icon
              @filter="(v, u) => filterShooters(v, u, 'B')"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.display_name }}</q-item-label>
                    <q-item-label caption>{{ shooterMeta(scope.opt) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item><q-item-section class="text-grey">Type a name or member #</q-item-section></q-item>
              </template>
            </q-select>
            <div v-if="shooterB" class="text-caption text-grey-7 q-mt-xs q-ml-xs">
              {{ shooterMeta(shooterB) }}
            </div>
          </div>
        </div>

        <div
          v-if="shooterA && shooterB && shooterA.id === shooterB.id"
          class="text-negative text-caption q-mt-sm"
        >
          Those are the same record — pick two different shooters.
        </div>
        <div v-else-if="shooterA && shooterB" class="q-mt-md">
          <q-banner
            v-if="bothClaimed"
            class="bg-orange-1 text-orange-9"
            rounded
            dense
          >
            Both records have a login, so neither can be deleted. Merge isn't
            possible — sort out which account should be used directly.
          </q-banner>
          <template v-else>
            <div class="row items-center q-gutter-md">
              <q-btn-toggle
                v-model="keepSide"
                no-caps
                unelevated
                toggle-color="green-6"
                color="grey-3"
                text-color="grey-9"
                :disable="lockedKeepSide !== null"
                :options="keepToggleOptions"
              />
              <q-space />
              <q-btn
                color="primary"
                unelevated
                icon="merge"
                label="Merge"
                :loading="pickerMerging"
                @click="confirmPickerMerge"
              />
            </div>
            <div v-if="lockedKeepSide" class="text-caption text-grey-7 q-mt-xs">
              <q-icon name="lock" size="14px" />
              {{ (lockedKeepSide === 'A' ? shooterA : shooterB)?.display_name }}
              has a login, so it's kept. The other record's history moves to it,
              then it's deleted.
            </div>
            <div v-else class="text-caption text-grey-7 q-mt-xs">
              The other record's match history moves to the kept one, then it's deleted.
            </div>
          </template>
        </div>
      </q-card-section>
    </q-card>

    <div class="text-subtitle1 text-weight-medium q-mb-sm">
      Or browse &amp; multi-select
    </div>
    <div class="text-caption text-grey-7 q-mb-sm" style="max-width: 640px">
      Search a name and tick a shooter, then search the other name and tick
      them too — your picks stay selected across searches. Choose which record
      to keep, then Merge.
    </div>
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

    <!-- Merge action bar — shows every picked shooter, even ones from an
         earlier search that are no longer in the table below. -->
    <q-banner
      v-if="selected.length >= 1"
      class="bg-blue-1 rounded-borders q-mt-md"
    >
      <div class="text-weight-medium q-mb-xs">
        Selected to merge ({{ selected.length }})
      </div>
      <div class="row q-gutter-xs q-mb-sm">
        <q-chip
          v-for="s in selected"
          :key="s.id"
          removable
          :color="s.id === keepId ? 'green-6' : 'grey-4'"
          :text-color="s.id === keepId ? 'white' : 'grey-9'"
          @remove="toggle(s, false)"
        >
          {{ s.display_name }}<span v-if="s.member_number">&nbsp;#{{ s.member_number }}</span>
          <q-badge
            v-if="s.id === keepId"
            color="white"
            text-color="green-8"
            class="q-ml-xs"
            label="keep"
          />
        </q-chip>
      </div>
      <div class="row items-center q-gutter-md">
        <div>
          Keep:
          <q-select
            v-model="keepId"
            :options="keepOptions"
            dense
            options-dense
            emit-value
            map-options
            borderless
            :disable="!!selectedClaimed"
            style="display: inline-block; min-width: 220px"
          />
          <q-icon
            v-if="selectedClaimed"
            name="lock"
            size="14px"
            class="q-ml-xs text-grey-7"
          >
            <q-tooltip>Has a login — always kept</q-tooltip>
          </q-icon>
        </div>
        <q-space />
        <div v-if="selected.length < 2" class="text-caption text-grey-7">
          Pick a second shooter to merge.
        </div>
        <q-btn
          color="primary"
          unelevated
          dense
          icon="merge"
          :label="`Merge ${selected.length - 1} into this record`"
          :disable="selected.length < 2"
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
import { ref, computed, watch, onMounted } from 'vue';
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

// ── Dedicated two-shooter picker ────────────────────────────────────────────
const shooterA = ref<Shooter | null>(null);
const shooterB = ref<Shooter | null>(null);
const optionsA = ref<Shooter[]>([]);
const optionsB = ref<Shooter[]>([]);
const keepSide = ref<'A' | 'B'>('A');
const pickerMerging = ref(false);

function shooterLabel(s: Shooter | null): string {
  if (!s) return '';
  return s.member_number ? `${s.display_name} (#${s.member_number})` : s.display_name;
}

function shooterMeta(s: Shooter): string {
  const parts = [
    `${s.match_count} match${s.match_count === 1 ? '' : 'es'}`,
    `${s.registration_count} entries`,
  ];
  if (s.claimed) parts.push('claimed');
  return parts.join(' · ');
}

const keepToggleOptions = computed(() => [
  { label: `Keep ${shooterA.value?.display_name ?? 'A'}`, value: 'A' },
  { label: `Keep ${shooterB.value?.display_name ?? 'B'}`, value: 'B' },
]);

const bothClaimed = computed(
  () => !!(shooterA.value?.claimed && shooterB.value?.claimed),
);

// A record with a login must always be the one kept. When exactly one side is
// claimed, that side is forced (the keep toggle is locked to it).
const lockedKeepSide = computed<'A' | 'B' | null>(() => {
  if (shooterA.value?.claimed && !shooterB.value?.claimed) return 'A';
  if (shooterB.value?.claimed && !shooterA.value?.claimed) return 'B';
  return null;
});

async function filterShooters(
  val: string,
  update: (fn: () => void) => void,
  which: 'A' | 'B',
): Promise<void> {
  const q = (val ?? '').trim();
  if (q.length < 2) {
    update(() => {
      if (which === 'A') optionsA.value = [];
      else optionsB.value = [];
    });
    return;
  }
  try {
    const { data } = await api.get<Shooter[]>('/api/users/shooters', {
      params: { q },
    });
    update(() => {
      if (which === 'A') optionsA.value = data;
      else optionsB.value = data;
    });
  } catch {
    update(() => {});
  }
}

// A claimed record (has a login) must always be kept — force the keep side to
// it whenever exactly one side is claimed.
watch([shooterA, shooterB], () => {
  if (lockedKeepSide.value) keepSide.value = lockedKeepSide.value;
});

function confirmPickerMerge(): void {
  const a = shooterA.value;
  const b = shooterB.value;
  if (!a || !b || a.id === b.id) return;
  const keep = keepSide.value === 'A' ? a : b;
  const dup = keepSide.value === 'A' ? b : a;
  if (dup.claimed) {
    $q.notify({
      type: 'warning',
      message: `“${dup.display_name}” is a claimed account — keep that one instead.`,
    });
    return;
  }
  $q.dialog({
    title: 'Merge shooters',
    message:
      `Merge <b>${dup.display_name}</b> into <b>${keep.display_name}</b>? ` +
      `Their match history moves to the kept record and the duplicate is deleted. This can't be undone.`,
    html: true,
    cancel: true,
    persistent: true,
  }).onOk(() => void pickerMerge(keep, dup));
}

async function pickerMerge(keep: Shooter, dup: Shooter): Promise<void> {
  pickerMerging.value = true;
  try {
    const { data } = await api.post<{ registrations_moved: number }>(
      `/api/users/${dup.id}/merge`,
      { into: keep.id },
    );
    $q.notify({
      type: 'positive',
      message: `Merged ${dup.display_name} into ${keep.display_name} — ${data.registrations_moved} entries moved.`,
    });
    shooterA.value = null;
    shooterB.value = null;
    if (trimmedQuery.value.length >= 2) await search();
    await loadSuggestions();
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Merge failed';
    $q.notify({ type: 'negative', message: msg });
  } finally {
    pickerMerging.value = false;
  }
}

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

// A claimed record (has a login) must always be kept; lock the keep target to
// it when one is in the selection.
const selectedClaimed = computed(
  () => selected.value.find((s) => s.claimed) ?? null,
);
watch(selectedClaimed, (c) => {
  if (c) keepId.value = c.id;
});

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
