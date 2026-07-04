<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">Dashboard</div>
      <q-space />
      <q-btn
        color="primary"
        outline
        icon="insights"
        label="My Performance"
        to="/shooter/performance"
        no-caps
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <template v-else>
      <!-- Upcoming Matches -->
      <div class="q-mb-lg">
        <div class="text-h6 text-weight-medium q-mb-md">Upcoming Matches</div>
        <div v-if="upcomingMatches.length === 0" class="text-grey q-pa-md">
          No upcoming matches
        </div>
        <div class="row q-gutter-md">
          <div
            v-for="m in upcomingMatches"
            :key="m.id"
            class="col-12 col-sm-6 col-md-4"
          >
            <MatchCard
              :match="m"
              @click="$router.push(`/shooter/matches/${m.id}`)"
            />
          </div>
        </div>
      </div>

      <!-- Recent Matches with Results -->
      <div>
        <div class="text-h6 text-weight-medium q-mb-md">Recent Results</div>
        <div v-if="recentMatches.length === 0" class="text-grey q-pa-md">
          No recent match results
        </div>
        <div class="row q-gutter-md">
          <div
            v-for="m in recentMatches"
            :key="m.id"
            class="col-12 col-sm-6 col-md-4"
          >
            <q-card class="cursor-pointer" @click="$router.push(`/shooter/matches/${m.id}`)">
              <q-card-section>
                <div class="text-subtitle1 text-weight-bold">{{ m.name }}</div>
                <div class="text-caption text-grey">{{ formatDate(m.start_date) }}</div>
                <q-badge
                  :color="m.status === 'final' ? 'purple' : 'green'"
                  :label="m.status"
                  class="q-mt-xs"
                />
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { PowerSyncDatabase } from '@powersync/web';
import { whenPowerSyncReady } from 'src/boot/powersync';
import type { Match } from '@hitfactor/shared';
import MatchCard from 'src/components/match/MatchCard.vue';

let db: PowerSyncDatabase | null = null;
const loading = ref(true);
const allMatches = ref<Match[]>([]);

const today = new Date().toISOString().split('T')[0];

const upcomingMatches = computed(() => {
  return allMatches.value
    .filter((m) => m.start_date >= today && ['registration', 'active', 'scoring'].includes(m.status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6);
});

const recentMatches = computed(() => {
  return allMatches.value
    .filter((m) => m.start_date < today || m.status === 'final')
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 6);
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

onMounted(async () => {
  db = await whenPowerSyncReady();
  if (!db) {
    loading.value = false;
    return;
  }

  try {
    allMatches.value = await db.getAll<Match>(
      'SELECT * FROM matches ORDER BY start_date DESC',
    );
  } finally {
    loading.value = false;
  }
});
</script>
