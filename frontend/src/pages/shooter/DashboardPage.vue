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
            <MatchCard
              :match="m"
              @click="$router.push(`/shooter/matches/${m.id}`)"
            />
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMatch } from 'src/composables/useMatch';
import MatchCard from 'src/components/match/MatchCard.vue';

// useMatch() loads the match list via a reactive db.watch — so matches appear
// as they sync in after login, without needing to leave and return to the page.
const { matches: allMatches, loading } = useMatch();

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
</script>
