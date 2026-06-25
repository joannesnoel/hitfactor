<template>
  <div>
    <!-- Division Filter -->
    <q-select
      v-if="availableDivisions.length > 1"
      v-model="selectedDivision"
      :options="divisionOptions"
      label="Filter by Division"
      emit-value
      map-options
      outlined
      dense
      clearable
      class="q-mb-md"
      style="max-width: 300px"
    />

    <q-table
      :rows="filteredResults"
      :columns="columns"
      row-key="registration_id"
      flat
      bordered
      dense
      :pagination="{ rowsPerPage: 50 }"
      class="stage-results-table"
    >
      <template #body-cell-place="props">
        <q-td :props="props">
          <span :class="{ 'text-weight-bold text-primary': props.row.place <= 3 }">
            {{ props.row.dqed ? 'DQ' : props.row.dnf ? 'DNF' : props.row.place }}
          </span>
        </q-td>
      </template>

      <template #body-cell-hit_factor="props">
        <q-td :props="props">
          <span class="text-weight-bold">{{ props.row.hit_factor.toFixed(4) }}</span>
        </q-td>
      </template>

      <template #body-cell-stage_percentage="props">
        <q-td :props="props">
          <span class="text-weight-bold">{{ props.row.stage_percentage.toFixed(2) }}%</span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StageResultEntry, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const props = withDefaults(
  defineProps<{
    results: StageResultEntry[];
    organization?: Organization;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const selectedDivision = ref<string | null>(null);

const availableDivisions = computed(() => {
  const divs = new Set(props.results.map((r) => r.division));
  return Array.from(divs).sort();
});

const divisionOptions = computed(() => {
  return availableDivisions.value.map((d) => ({
    label: getDivisionLabel(props.organization, d),
    value: d,
  }));
});

const filteredResults = computed(() => {
  if (!selectedDivision.value) return props.results;
  return props.results.filter((r) => r.division === selectedDivision.value);
});

const columns = computed<QTableColumn[]>(() => [
  { name: 'place', label: 'Place', field: 'place', align: 'center', sortable: true },
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Div', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(props.organization, val) },
  { name: 'alpha_count', label: 'A', field: 'alpha_count', align: 'center', sortable: true },
  { name: 'charlie_count', label: 'C', field: 'charlie_count', align: 'center', sortable: true },
  { name: 'delta_count', label: 'D', field: 'delta_count', align: 'center', sortable: true },
  { name: 'miss_count', label: 'M', field: 'miss_count', align: 'center', sortable: true },
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
  { name: 'hit_factor', label: 'HF', field: 'hit_factor', align: 'center', sortable: true },
  { name: 'stage_percentage', label: 'Stage%', field: 'stage_percentage', align: 'center', sortable: true },
]);
</script>

<style scoped>
.stage-results-table {
  max-width: 100%;
  overflow-x: auto;
}
</style>
