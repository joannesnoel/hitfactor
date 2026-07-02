<template>
  <div>
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

    <!-- Mobile: one tappable card per shooter, expand for per-stage detail -->
    <div v-if="$q.screen.lt.sm" class="column q-gutter-y-sm">
      <q-expansion-item
        v-for="row in filteredResults"
        :id="`standing-${row.registration_id}`"
        :key="row.registration_id"
        class="standings-card"
        :class="{ 'result-focus': focusId === row.registration_id }"
        dense-toggle
        expand-icon-toggle
      >
        <template #header>
          <q-item-section avatar class="standings-place">
            <span
              :class="
                row.place <= 3 && !row.dqed
                  ? 'text-weight-bold text-primary text-h6'
                  : 'text-subtitle1'
              "
            >
              {{ row.dqed ? 'DQ' : row.place }}
            </span>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{
              row.shooter_name
            }}</q-item-label>
            <q-item-label caption>
              {{ getDivisionLabel(organization, row.division) }} ·
              {{ row.power_factor
              }}{{ row.classification ? ` · ${row.classification}` : '' }}
            </q-item-label>
          </q-item-section>
          <q-item-section side class="text-right">
            <q-item-label class="text-weight-bold text-body1 text-grey-9">
              {{ row.total_percentage.toFixed(2) }}%
            </q-item-label>
            <q-item-label caption>
              {{ (row.match_points ?? 0).toFixed(2) }} pts
            </q-item-label>
          </q-item-section>
        </template>
        <q-card flat bordered>
          <q-card-section class="row items-center q-gutter-xs">
            <q-chip
              v-for="stage in sortedStages"
              :key="stage.id"
              dense
              square
              size="md"
              color="grey-2"
              text-color="grey-9"
            >
              <span class="text-weight-bold q-mr-xs">S{{ stage.stage_number }}</span>
              {{ stagePercentage(row, stage.id) }}
            </q-chip>
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
      class="standings-table"
    >
      <template #body="props">
        <q-tr
          :id="`standing-${props.row.registration_id}`"
          :props="props"
          :class="{ 'result-focus': focusId === props.row.registration_id }"
        >
          <q-td key="place" :props="props">
            <span
              :class="{
                'text-weight-bold text-primary':
                  props.row.place <= 3 && !props.row.dqed,
              }"
            >
              {{ props.row.dqed ? 'DQ' : props.row.place }}
            </span>
          </q-td>
          <q-td key="shooter_name" :props="props" class="text-left">
            {{ props.row.shooter_name }}
          </q-td>
          <q-td key="division" :props="props">
            {{ getDivisionLabel(organization, props.row.division) }}
          </q-td>
          <q-td key="classification" :props="props">
            {{ props.row.classification ?? '-' }}
          </q-td>
          <q-td key="power_factor" :props="props">
            {{ props.row.power_factor }}
          </q-td>
          <q-td
            v-for="stage in sortedStages"
            :key="`stage_${stage.id}`"
            :props="props"
          >
            {{ stagePercentage(props.row, stage.id) }}
          </q-td>
          <q-td key="match_points" :props="props">
            {{ (props.row.match_points ?? 0).toFixed(2) }}
          </q-td>
          <q-td key="total_percentage" :props="props">
            <span class="text-weight-bold">
              {{ props.row.total_percentage.toFixed(2) }}%
            </span>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import type { MatchResultEntry, Stage, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const $q = useQuasar();

const props = withDefaults(
  defineProps<{
    results: MatchResultEntry[];
    stages: Stage[];
    // The single division to show — chosen by the parent MatchResultsViewer.
    division: string;
    organization?: Organization;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const filteredResults = computed(() =>
  props.results.filter((r) => r.division === props.division)
);

// ── Find-a-shooter search → scroll to + highlight their row ──
const pick = ref<string | null>(null);
const focusId = ref<string>('');
const shooterOptions = ref<{ label: string; value: string }[]>([]);

function allShooterOptions() {
  return filteredResults.value.map((r) => ({
    label: `${r.dqed ? 'DQ' : r.place}. ${r.shooter_name}`,
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
      .getElementById(`standing-${registrationId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  window.setTimeout(() => {
    if (focusId.value === registrationId) focusId.value = '';
  }, 3000);
}

const stageColumns = computed<QTableColumn[]>(() => {
  return props.stages
    .slice()
    .sort((a, b) => a.stage_number - b.stage_number)
    .map((stage) => ({
      name: `stage_${stage.id}`,
      label: `S${stage.stage_number}`,
      field: (row: MatchResultEntry) => {
        const pct = row.stage_percentages[stage.id];
        return pct !== undefined ? pct.toFixed(2) + '%' : '-';
      },
      align: 'center' as const,
      sortable: false,
    }));
});

// Mobile card view reuses the same data as the stage columns.
const sortedStages = computed(() =>
  props.stages.slice().sort((a, b) => a.stage_number - b.stage_number)
);

function stagePercentage(row: MatchResultEntry, stageId: string): string {
  const pct = row.stage_percentages[stageId];
  return pct !== undefined ? `${pct.toFixed(2)}%` : '-';
}

const columns = computed<QTableColumn[]>(() => [
  { name: 'place', label: 'Place', field: 'place', align: 'center', sortable: true },
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Division', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(props.organization, val) },
  { name: 'classification', label: 'Class', field: 'classification', align: 'center', sortable: true, format: (val: string | null) => val ?? '-' },
  { name: 'power_factor', label: 'PF', field: 'power_factor', align: 'center', sortable: true },
  ...stageColumns.value,
  { name: 'match_points', label: 'Match Pts', field: 'match_points', align: 'center', sortable: true, format: (val: number) => (val ?? 0).toFixed(2) },
  { name: 'total_percentage', label: 'Match%', field: 'total_percentage', align: 'center', sortable: true },
]);
</script>

<style scoped>
.standings-table {
  max-width: 100%;
  overflow-x: auto;
}
.standings-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: #fff;
}
.standings-place {
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
