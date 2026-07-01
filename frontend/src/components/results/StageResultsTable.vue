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

    <!-- Mobile: one card per shooter, expand for zone/time/points detail -->
    <div v-if="$q.screen.lt.sm" class="column q-gutter-y-sm">
      <q-expansion-item
        v-for="row in filteredResults"
        :key="row.registration_id"
        class="stage-result-card"
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
            <q-item-label caption>{{
              getDivisionLabel(organization, row.division)
            }}</q-item-label>
          </q-item-section>
          <q-item-section side class="text-right">
            <q-item-label class="text-weight-bold text-body1 text-grey-9">
              HF {{ row.hit_factor.toFixed(4) }}
            </q-item-label>
            <q-item-label caption>{{
              row.stage_percentage.toFixed(2)
            }}%</q-item-label>
          </q-item-section>
        </template>
        <q-card flat bordered>
          <q-card-section class="row q-col-gutter-sm text-center">
            <div class="col-4">
              <div class="text-caption text-grey">A / C / D</div>
              <div class="text-weight-medium">
                {{ row.alpha_count }} / {{ row.charlie_count }} /
                {{ row.delta_count }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">M / NS / Proc</div>
              <div class="text-weight-medium">
                {{ row.miss_count }} / {{ row.no_shoot_count }} /
                {{ row.procedural_count }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey">Steel</div>
              <div class="text-weight-medium">
                {{ row.steel_hits }}/{{ row.steel_hits + row.steel_misses }}
              </div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey">Time</div>
              <div class="text-weight-medium">{{ row.time.toFixed(2) }}s</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey">Points</div>
              <div class="text-weight-medium">{{ row.total_points }}</div>
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
import { useQuasar } from 'quasar';
import type { StageResultEntry, Organization } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const $q = useQuasar();

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
.stage-result-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: #fff;
}
.result-place {
  min-width: 40px;
  align-items: center;
}
</style>
