<template>
  <div>
    <!-- Division selector — only when this table isn't already division-scoped
         by the parent. Always exactly one division, never combined. -->
    <q-select
      v-if="!division && availableDivisions.length > 1"
      v-model="internalDivision"
      :options="divisionOptions"
      label="Division"
      emit-value
      map-options
      outlined
      dense
      class="q-mb-md"
      style="max-width: 300px"
    />

    <!-- Find a shooter → scroll to + highlight their row -->
    <q-select
      v-if="filteredResults.length > 1"
      v-model="pick"
      :options="shooterOptions"
      use-input
      input-debounce="0"
      clearable
      dense
      outlined
      label="Find shooter"
      emit-value
      map-options
      class="q-mb-md"
      style="max-width: 320px"
      @filter="filterShooters"
      @update:model-value="onPick"
    >
      <template #prepend><q-icon name="search" /></template>
      <template #no-option>
        <q-item>
          <q-item-section class="text-grey">No match</q-item-section>
        </q-item>
      </template>
    </q-select>

    <!-- Mobile: one card per shooter, expand for zone/time/points detail -->
    <div v-if="$q.screen.lt.sm" class="column q-gutter-y-sm">
      <q-expansion-item
        v-for="row in filteredResults"
        :id="`stage-${row.registration_id}`"
        :key="row.registration_id"
        class="stage-result-card"
        :class="{ 'result-focus': focusId === row.registration_id }"
        dense-toggle
        expand-icon-toggle
      >
        <template #header>
          <q-item-section avatar class="result-place">
            <span
              :class="
                row.place <= 3 && !row.dqed && !row.dnf
                  ? 'text-weight-bold text-primary text-h6'
                  : 'text-subtitle1'
              "
            >
              {{ row.dqed ? 'DQ' : row.dnf ? 'DNF' : row.place }}
            </span>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{
              row.shooter_name
            }}</q-item-label>
            <q-item-label caption>
              {{ getDivisionLabel(organization, row.division) }} ·
              {{ row.power_factor }}
            </q-item-label>
          </q-item-section>
          <q-item-section side class="text-right">
            <q-item-label class="text-weight-bold text-body1 text-grey-9">
              {{ row.stage_percentage.toFixed(2) }}%
            </q-item-label>
            <q-item-label caption>
              {{ (row.stage_points ?? 0).toFixed(2) }} pts ·
              HF {{ row.hit_factor.toFixed(4) }}
            </q-item-label>
          </q-item-section>
        </template>
        <q-card flat bordered>
          <q-card-section class="row q-col-gutter-sm text-center">
            <div class="col-4">
              <div class="text-caption text-grey">A / C / D</div>
              <div class="text-weight-medium">
                {{ row.alpha_count + row.steel_hits }} / {{ row.charlie_count }} /
                {{ row.delta_count }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">M / NS / Proc</div>
              <div class="text-weight-medium">
                {{ row.miss_count + row.steel_misses }} / {{ row.no_shoot_count }} /
                {{ row.procedural_count }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">Steel</div>
              <div class="text-weight-medium">
                {{ row.steel_hits }}/{{ row.steel_hits + row.steel_misses }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">Time</div>
              <div class="text-weight-medium">{{ row.time.toFixed(2) }}s</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">Points</div>
              <div class="text-weight-medium">{{ row.total_points }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">Stage Pts</div>
              <div class="text-weight-medium">
                {{ (row.stage_points ?? 0).toFixed(2) }}
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </div>

    <q-table
      v-else
      :rows="filteredResults"
      :columns="columns"
      row-key="registration_id"
      flat
      bordered
      dense
      :pagination="{ rowsPerPage: 0 }"
      hide-bottom
      class="stage-results-table"
    >
      <template #body="props">
        <q-tr
          :id="`stage-${props.row.registration_id}`"
          :props="props"
          :class="{ 'result-focus': focusId === props.row.registration_id }"
        >
          <q-td key="place" :props="props">
            <span
              :class="{
                'text-weight-bold text-primary':
                  props.row.place <= 3 && !props.row.dqed && !props.row.dnf,
              }"
            >
              {{ props.row.dqed ? 'DQ' : props.row.dnf ? 'DNF' : props.row.place }}
            </span>
          </q-td>
          <q-td key="shooter_name" :props="props" class="text-left">
            {{ props.row.shooter_name }}
          </q-td>
          <q-td key="division" :props="props">
            {{ getDivisionLabel(organization, props.row.division) }}
          </q-td>
          <q-td key="power_factor" :props="props">{{ props.row.power_factor }}</q-td>
          <q-td key="alpha_count" :props="props">
            {{ props.row.alpha_count + props.row.steel_hits }}
          </q-td>
          <q-td key="charlie_count" :props="props">{{ props.row.charlie_count }}</q-td>
          <q-td key="delta_count" :props="props">{{ props.row.delta_count }}</q-td>
          <q-td key="miss_count" :props="props">
            {{ props.row.miss_count + props.row.steel_misses }}
          </q-td>
          <q-td key="no_shoot_count" :props="props">{{ props.row.no_shoot_count }}</q-td>
          <q-td key="procedural_count" :props="props">
            {{ props.row.procedural_count }}
          </q-td>
          <q-td key="steel" :props="props">
            {{ props.row.steel_hits }}/{{
              props.row.steel_hits + props.row.steel_misses
            }}
          </q-td>
          <q-td key="time" :props="props">{{ props.row.time.toFixed(2) }}</q-td>
          <q-td key="total_points" :props="props">{{ props.row.total_points }}</q-td>
          <q-td key="stage_percentage" :props="props">
            <span class="text-weight-bold">{{
              props.row.stage_percentage.toFixed(2)
            }}%</span>
          </q-td>
          <q-td key="stage_points" :props="props">
            {{ (props.row.stage_points ?? 0).toFixed(2) }}
          </q-td>
          <q-td key="hit_factor" :props="props">
            {{ props.row.hit_factor.toFixed(4) }}
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import type { StageResultEntry, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';
import {
  usePreferredDivision,
  pickInitialDivision,
} from 'src/composables/usePreferredDivision';

const $q = useQuasar();

const props = withDefaults(
  defineProps<{
    results: StageResultEntry[];
    // When set, the parent controls the (single) division and the local
    // selector is hidden. When absent, we default to the sticky/first division.
    division?: string;
    // Default selection (e.g. the shooter's division) when there's no preference.
    defaultDivision?: string;
    organization?: Organization;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const { remember } = usePreferredDivision();

const availableDivisions = computed(() => {
  const divs = new Set(props.results.map((r) => r.division));
  return Array.from(divs).sort();
});

// Local selection used only when the parent doesn't pass a division. Always
// resolves to a real division — never null/combined.
const internalDivision = ref<string>('');
watchEffect(() => {
  if (
    !props.division &&
    !availableDivisions.value.includes(internalDivision.value)
  ) {
    internalDivision.value = pickInitialDivision(
      availableDivisions.value,
      props.defaultDivision
    );
  }
});
watch(internalDivision, (v) => {
  if (!props.division && v) remember(v);
});

const activeDivision = computed(() => props.division ?? internalDivision.value);

const divisionOptions = computed(() => {
  return availableDivisions.value.map((d) => ({
    label: getDivisionLabel(props.organization, d),
    value: d,
  }));
});

const filteredResults = computed(() => {
  if (activeDivision.value === 'combined') {
    return props.results.filter((r) => r.combined);
  }
  return props.results.filter(
    (r) => r.division === activeDivision.value && !r.combined
  );
});

// ── Find-a-shooter search → scroll to + highlight their row ──
const pick = ref<string | null>(null);
const focusId = ref<string>('');
const shooterOptions = ref<{ label: string; value: string }[]>([]);

function allShooterOptions() {
  return filteredResults.value.map((r) => ({
    label: `${r.dqed ? 'DQ' : r.dnf ? 'DNF' : r.place}. ${r.shooter_name}`,
    value: r.registration_id,
  }));
}

function filterShooters(val: string, update: (fn: () => void) => void) {
  update(() => {
    const q = val.toLowerCase();
    shooterOptions.value = q
      ? allShooterOptions().filter((o) => o.label.toLowerCase().includes(q))
      : allShooterOptions();
  });
}

function onPick(registrationId: string | null) {
  if (!registrationId) {
    focusId.value = '';
    return;
  }
  focusId.value = registrationId;
  void nextTick(() => {
    document
      .getElementById(`stage-${registrationId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  window.setTimeout(() => {
    if (focusId.value === registrationId) focusId.value = '';
  }, 3000);
}

const columns = computed<QTableColumn[]>(() => [
  { name: 'place', label: 'Place', field: 'place', align: 'center', sortable: true },
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Div', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(props.organization, val) },
  { name: 'power_factor', label: 'PF', field: 'power_factor', align: 'center', sortable: true },
  // Steel folds into A (hits) and M (misses), matching the scoring screen's tally.
  { name: 'alpha_count', label: 'A', field: (row: StageResultEntry) => row.alpha_count + row.steel_hits, align: 'center', sortable: true },
  { name: 'charlie_count', label: 'C', field: 'charlie_count', align: 'center', sortable: true },
  { name: 'delta_count', label: 'D', field: 'delta_count', align: 'center', sortable: true },
  { name: 'miss_count', label: 'M', field: (row: StageResultEntry) => row.miss_count + row.steel_misses, align: 'center', sortable: true },
  { name: 'no_shoot_count', label: 'NS', field: 'no_shoot_count', align: 'center', sortable: true },
  { name: 'procedural_count', label: 'Proc', field: 'procedural_count', align: 'center', sortable: true },
  {
    name: 'steel',
    label: 'Steel',
    field: (row: StageResultEntry) => `${row.steel_hits}/${row.steel_hits + row.steel_misses}`,
    align: 'center',
    sortable: false,
  },
  { name: 'time', label: 'Time', field: 'time', align: 'center', sortable: true, format: (val: number) => val.toFixed(2) },
  { name: 'total_points', label: 'Points', field: 'total_points', align: 'center', sortable: true },
  // Ranking signal first (Stage%), then what it earns (Stage Pts), then the raw HF.
  { name: 'stage_percentage', label: 'Stage%', field: 'stage_percentage', align: 'center', sortable: true },
  // Stage points = stage% of the stage's max points (rounds × 5); feeds match points.
  // Not sortable: Stage Pts and HF order exactly as Stage% does, so sorting by them is redundant.
  { name: 'stage_points', label: 'Stage Pts', field: 'stage_points', align: 'center', sortable: false, format: (val: number) => (val ?? 0).toFixed(2) },
  { name: 'hit_factor', label: 'HF', field: 'hit_factor', align: 'center', sortable: false },
]);
</script>

<style scoped>
.stage-results-table {
  max-width: 100%;
  overflow-x: auto;
}
.stage-result-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: #fff;
}
.result-place {
  min-width: 40px;
  align-items: center;
}
/* Flash the searched-for shooter's row/card */
.result-focus {
  background-color: #fff8e1 !important;
  box-shadow: inset 3px 0 0 var(--q-primary);
  transition: background-color 0.4s ease;
}
.result-focus :deep(td) {
  background-color: #fff8e1;
}
</style>
