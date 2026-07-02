<template>
  <q-page padding>
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <div class="row items-center q-mb-md">
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
      </div>

      <div v-if="registrations.length === 0" class="text-center text-grey q-pa-xl">
        <q-icon name="people" size="4em" class="q-mb-md" />
        <div>No registrations yet</div>
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
      />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Ref } from 'vue';
import { useQuasar } from 'quasar';
import type { Registration, Match } from '@hitfactor/shared';
import { getDivisionLabel, DEFAULT_ORGANIZATION } from '@hitfactor/shared';
import type { QTableColumn } from 'quasar';

const $q = useQuasar();

const ctx = inject<{
  match: Ref<Match | null>;
  registrations: Ref<Registration[]>;
  loading: Ref<boolean>;
}>('matchContext')!;

const { match, registrations, loading } = ctx;
const filter = ref('');

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
];
</script>
