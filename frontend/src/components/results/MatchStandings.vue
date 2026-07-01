<template>
  <div>
    <!-- Mobile: one tappable card per shooter, expand for per-stage detail -->
    <div v-if="$q.screen.lt.sm" class="column q-gutter-y-sm">
      <q-expansion-item
        v-for="row in filteredResults"
        :key="row.registration_id"
        class="standings-card"
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
              {{ getDivisionLabel(organization, row.division)
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
import { computed } from 'vue';
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
</style>
