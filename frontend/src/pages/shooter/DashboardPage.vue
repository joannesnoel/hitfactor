<template>
  <q-page padding>
    <div class="row items-center q-mb-lg">
      <div class="text-h5 text-weight-bold">Dashboard</div>
      <q-space />
      <q-btn
        color="primary"
        outline
        icon="qr_code_2"
        label="Host a match"
        to="/shooter/host"
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
              :participated="participatedIds.has(m.id)"
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
              :participated="participatedIds.has(m.id)"
              @click="$router.push(`/shooter/matches/${m.id}`)"
            />
          </div>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMatch } from 'src/composables/useMatch';
import { whenPowerSyncReady } from 'src/boot/powersync';
import { useAuthStore } from 'src/stores/auth.store';
import MatchCard from 'src/components/match/MatchCard.vue';

// useMatch() loads the match list via a reactive db.watch — so matches appear
// as they sync in after login, without needing to leave and return to the page.
const { matches: allMatches, loading } = useMatch();

// Matches this shooter is registered in — PowerSync syncs their own
// registrations, so a reactive watch keeps the "participated" markers current.
const auth = useAuthStore();
const participatedIds = ref<Set<string>>(new Set());

onMounted(async () => {
  const db = await whenPowerSyncReady();
  if (!db || !auth.user) return;
  db.watch(
    'SELECT DISTINCT match_id FROM registrations WHERE user_id = ?',
    [auth.user.id],
    {
      onResult: (result) => {
        const rows = (result.rows?._array as { match_id: string }[]) ?? [];
        participatedIds.value = new Set(rows.map((r) => r.match_id));
      },
    },
  );
});

const today = new Date().toISOString().split('T')[0];

// The dashboard shows every public match, plus private matches the shooter
// actually participated in (their own hosted-but-not-entered matches live under
// /shooter/host). participatedIds syncs from their registrations.
const myMatches = computed(() =>
  allMatches.value.filter(
    (m) => !m.is_private || participatedIds.value.has(m.id),
  ),
);

const upcomingMatches = computed(() => {
  return myMatches.value
    .filter((m) => m.start_date >= today && ['registration', 'active', 'scoring'].includes(m.status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6);
});

const recentMatches = computed(() => {
  return myMatches.value
    .filter((m) => m.start_date < today || m.status === 'final')
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .slice(0, 6);
});
</script>
