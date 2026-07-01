<template>
  <div>
    <!-- Division Tabs -->
    <q-tabs
      v-model="selectedDivision"
      dense
      class="text-grey q-mb-md"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
      align="left"
    >
      <q-tab
        v-for="div in availableDivisions"
        :key="div"
        :name="div"
        :label="getDivisionLabel(organization, div)"
      />
    </q-tabs>

    <q-table
      :rows="filteredResults"
      :columns="columns"
      row-key="registration_id"
      flat
      bordered
      dense
      :pagination="{ rowsPerPage: 50 }"
      class="standings-table"
    >
      <template #body-cell-place="props">
        <q-td :props="props">
          <span :class="{ 'text-weight-bold text-primary': props.row.place <= 3 }">
            {{ props.row.dqed ? 'DQ' : props.row.place }}
          </span>
        </q-td>
      </template>

      <template #body-cell-total_percentage="props">
        <q-td :props="props">
          <span class="text-weight-bold">{{ props.row.total_percentage.toFixed(2) }}%</span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MatchResultEntry, Stage, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const props = withDefaults(
  defineProps<{
    results: MatchResultEntry[];
    stages: Stage[];
    organization?: Organization;
  }>(),
  { organization: DEFAULT_ORGANIZATION }
);

const availableDivisions = computed(() => {
  const divs = new Set(props.results.map((r) => r.division));
  return Array.from(divs).sort();
});

const selectedDivision = ref<string>(availableDivisions.value[0] ?? '');

watch(availableDivisions, (divs) => {
  if (!selectedDivision.value && divs.length > 0) {
    selectedDivision.value = divs[0];
  }
});

const filteredResults = computed(() => {
  return props.results.filter((r) => r.division === selectedDivision.value);
});

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

const columns = computed<QTableColumn[]>(() => [
  { name: 'place', label: 'Place', field: 'place', align: 'center', sortable: true },
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Division', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(props.organization, val) },
  { name: 'classification', label: 'Class', field: 'classification', align: 'center', sortable: true, format: (val: string | null) => val ?? '-' },
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
</style>
