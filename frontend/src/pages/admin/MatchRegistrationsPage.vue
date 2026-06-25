<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div class="text-h6 q-mb-md">Registrations ({{ registrations.length }})</div>

      <q-table
        v-if="registrations.length > 0"
        :rows="registrations"
        :columns="columns"
        row-key="id"
        flat
        bordered
        dense
        :filter="filter"
        :pagination="{ rowsPerPage: 25 }"
      >
        <template #top-right>
          <q-input v-model="filter" dense outlined placeholder="Search..." clearable>
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
      </q-table>

      <div v-else class="text-center text-grey q-pa-xl">
        <q-icon name="people" size="4em" class="q-mb-md" />
        <div>No registrations yet</div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import type { Ref } from 'vue';
import type { Registration, Match } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const ctx = inject<{
  match: Ref<Match | null>;
  registrations: Ref<Registration[]>;
  loading: Ref<boolean>;
}>('matchContext')!;

const { match, registrations, loading } = ctx;
const filter = ref('');

const columns: QTableColumn[] = [
  { name: 'shooter_name', label: 'Name', field: 'shooter_name', align: 'left', sortable: true },
  { name: 'division', label: 'Division', field: 'division', align: 'center', sortable: true, format: (val: string) => getDivisionLabel(match.value?.organization ?? DEFAULT_ORGANIZATION, val) },
  { name: 'classification', label: 'Class', field: 'classification', align: 'center', sortable: true, format: (val: string | null) => val ?? '-' },
  { name: 'power_factor', label: 'PF', field: 'power_factor', align: 'center', sortable: true },
  { name: 'member_number', label: 'Member#', field: 'member_number', align: 'center', format: (val: string | null) => val ?? '-' },
];
</script>
