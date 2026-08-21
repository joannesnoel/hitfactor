<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div class="row items-center q-mb-md q-gutter-sm">
        <div class="text-h6">Registrations ({{ registrations.length }})</div>
        <q-space />
        <q-input
          v-model="filter"
          dense
          outlined
          placeholder="Search..."
          clearable
          style="max-width: 240px"
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
        <q-btn
          color="primary"
          icon="person_add"
          label="Add shooter"
          unelevated
          no-caps
          @click="openAdd"
        />
      </div>

      <div v-if="registrations.length === 0" class="text-center text-grey q-pa-xl">
        <q-icon name="people" size="4em" class="q-mb-md" />
        <div>No registrations yet</div>
        <q-btn
          color="primary"
          icon="person_add"
          label="Add the first shooter"
          unelevated
          no-caps
          class="q-mt-md"
          @click="openAdd"
        />
      </div>

      <!-- Mobile: one card per registration (all fields incl. PF fit on a phone) -->
      <div v-else-if="$q.screen.lt.sm" class="column q-gutter-y-sm">
        <q-card
          v-for="r in filteredRegistrations"
          :key="r.id"
          flat
          bordered
        >
          <q-card-section class="q-py-sm row items-center no-wrap">
            <div class="col">
              <div class="text-weight-medium">{{ r.shooter_name }}</div>
              <div class="text-caption text-grey">
                {{ divLabel(r.division)
                }}<template v-if="r.classification">
                  · {{ r.classification }}</template
                ><template v-if="r.member_number"> · #{{ r.member_number }}</template>
              </div>
            </div>
            <q-badge
              :color="r.power_factor === 'Major' ? 'deep-orange' : 'blue'"
              :label="r.power_factor"
            />
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="grey-6"
              class="q-ml-sm"
              @click="confirmRemove(r)"
            />
          </q-card-section>
        </q-card>
        <div
          v-if="filteredRegistrations.length === 0"
          class="text-center text-grey q-pa-md"
        >
          No matches
        </div>
      </div>

      <!-- Desktop: table -->
      <q-table
        v-else
        :rows="registrations"
        :columns="columns"
        row-key="id"
        flat
        bordered
        dense
        :filter="filter"
        :pagination="{ rowsPerPage: 25 }"
      >
        <template #body-cell-actions="props">
          <q-td :props="props" class="text-right">
            <q-btn
              flat
              round
              dense
              size="sm"
              icon="delete"
              color="grey-6"
              @click="confirmRemove(props.row)"
            >
              <q-tooltip>Remove from match</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </template>

    <!-- Add shooter -->
    <q-dialog v-model="showAdd">
      <q-card style="min-width: 340px; max-width: 90vw">
        <q-card-section class="text-h6 q-pb-none">Add shooter</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="selectedShooter"
            label="Shooter"
            outlined
            use-input
            clearable
            input-debounce="300"
            :options="shooterOptions"
            option-label="display_name"
            option-value="id"
            hint="Search an existing shooter, or type a new name to add them"
            @filter="onShooterFilter"
            @input-value="onShooterInput"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.display_name }}</q-item-label>
                  <q-item-label caption>
                    {{ scope.opt.email || 'Unclaimed shooter' }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #no-option>
              <q-item>
                <q-item-section class="text-grey">
                  <template v-if="typedName.trim().length >= 2">
                    “{{ typedName.trim() }}” will be added as a new shooter
                  </template>
                  <template v-else>Type a name to search or add</template>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-select
            v-model="addForm.division"
            label="Division"
            outlined
            emit-value
            map-options
            :options="divisionOptions"
          />
          <q-select
            v-model="addForm.power_factor"
            label="Power Factor"
            outlined
            :options="POWER_FACTORS"
          />
          <q-input
            v-model="addForm.member_number"
            label="Member Number (optional)"
            outlined
          />
          <q-select
            v-model="addForm.classification"
            label="Classification (optional)"
            outlined
            clearable
            :options="CLASSIFICATIONS"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Add"
            unelevated
            :loading="adding"
            :disable="!canAdd"
            @click="submitAdd"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, inject } from 'vue';
import type { Ref } from 'vue';
import { useQuasar } from 'quasar';
import type { Registration, Match, PowerFactor, Classification } from '@hitfactor/shared';
import {
  getDivisionLabel,
  getDivisionsForOrg,
  DEFAULT_ORGANIZATION,
  POWER_FACTORS,
  CLASSIFICATIONS,
} from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';
import { api } from 'src/boot/axios';

const $q = useQuasar();

const ctx = inject<{
  match: Ref<Match | null>;
  registrations: Ref<Registration[]>;
  loading: Ref<boolean>;
}>('matchContext')!;

const { match, registrations, loading } = ctx;
const filter = ref('');

// ─── Add shooter ────────────────────────────────
interface ShooterOption {
  id: string;
  display_name: string;
  email: string | null;
}

const showAdd = ref(false);
const adding = ref(false);
const shooterOptions = ref<ShooterOption[]>([]);
// Either an option picked from search, or null when the admin typed a new name.
const selectedShooter = ref<ShooterOption | null>(null);
const typedName = ref('');

const addForm = reactive<{
  division: string | null;
  power_factor: PowerFactor;
  member_number: string;
  classification: Classification | null;
}>({
  division: null,
  power_factor: 'Minor',
  member_number: '',
  classification: null,
});

const divisionOptions = computed(() =>
  getDivisionsForOrg(match.value?.organization ?? DEFAULT_ORGANIZATION).map(
    (d) => ({ label: d.label, value: d.key }),
  ),
);

// A name (picked or typed) plus division + PF are required.
const shooterName = computed(() =>
  selectedShooter.value
    ? selectedShooter.value.display_name
    : typedName.value.trim(),
);
const canAdd = computed(
  () => !!shooterName.value && !!addForm.division && !!addForm.power_factor,
);

function openAdd() {
  selectedShooter.value = null;
  typedName.value = '';
  shooterOptions.value = [];
  addForm.division = null;
  addForm.power_factor = 'Minor';
  addForm.member_number = '';
  addForm.classification = null;
  showAdd.value = true;
}

// Remote search of existing shooter accounts (claimed + unclaimed).
async function onShooterFilter(
  val: string,
  update: (fn: () => void) => void,
) {
  if (val.trim().length < 2) {
    update(() => {
      shooterOptions.value = [];
    });
    return;
  }
  try {
    const { data } = await api.get<ShooterOption[]>('/api/users/search', {
      params: { q: val.trim() },
    });
    update(() => {
      shooterOptions.value = data;
    });
  } catch {
    update(() => {
      shooterOptions.value = [];
    });
  }
}

// Track raw typed text so an un-matched name can be added as a new shooter.
function onShooterInput(val: string) {
  typedName.value = val;
  if (!val) selectedShooter.value = null;
}

async function submitAdd() {
  if (!canAdd.value || !match.value) return;
  adding.value = true;
  try {
    const body: Record<string, unknown> = {
      shooter_name: shooterName.value,
      division: addForm.division,
      power_factor: addForm.power_factor,
    };
    if (selectedShooter.value) body.user_id = selectedShooter.value.id;
    if (addForm.member_number.trim()) body.member_number = addForm.member_number.trim();
    if (addForm.classification) body.classification = addForm.classification;

    const { data } = await api.post<Registration>(
      `/api/matches/${match.value.id}/registrations`,
      body,
    );
    registrations.value = [...registrations.value, data].sort((a, b) =>
      a.shooter_name.localeCompare(b.shooter_name),
    );
    $q.notify({ type: 'positive', message: `${data.shooter_name} added` });
    showAdd.value = false;
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? 'Failed to add shooter';
    $q.notify({ type: 'negative', message });
  } finally {
    adding.value = false;
  }
}

function confirmRemove(r: Registration) {
  $q.dialog({
    title: 'Remove shooter',
    message: `Remove ${r.shooter_name} from this match? Any of their scores for this match will also be deleted.`,
    cancel: true,
    ok: { label: 'Remove', color: 'negative', unelevated: true },
  }).onOk(async () => {
    if (!match.value) return;
    try {
      await api.delete(`/api/matches/${match.value.id}/registrations/${r.id}`);
      registrations.value = registrations.value.filter((x) => x.id !== r.id);
      $q.notify({ type: 'positive', message: `${r.shooter_name} removed` });
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to remove shooter' });
    }
  });
}

function divLabel(division: string): string {
  return getDivisionLabel(
    match.value?.organization ?? DEFAULT_ORGANIZATION,
    division,
  );
}

// Mobile card list honours the same search box as the desktop table.
const filteredRegistrations = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return registrations.value;
  return registrations.value.filter((r) =>
    [
      r.shooter_name,
      divLabel(r.division),
      r.classification ?? '',
      r.power_factor,
      r.member_number ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
});

const columns: QTableColumn[] = [
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Division', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(match.value?.organization ?? DEFAULT_ORGANIZATION, val) },
  { name: 'classification', label: 'Class', field: 'classification', align: 'center', sortable: true, format: (val: string | null) => val ?? '-' },
  { name: 'power_factor', label: 'PF', field: 'power_factor', align: 'center', sortable: true },
  { name: 'member_number', label: 'Member#', field: 'member_number', align: 'center', format: (val: string | null) => val ?? '-' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];
</script>
