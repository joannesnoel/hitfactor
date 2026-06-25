<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-lg">
      <div class="text-h5 text-weight-bold">My Matches</div>
      <q-btn
        color="primary"
        icon="add"
        label="Create Match"
        unelevated
        :to="'/admin/matches/create'"
      />
    </div>

    <!-- Status Filter -->
    <q-tabs
      v-model="statusFilter"
      dense
      class="text-grey q-mb-md"
      active-color="primary"
      indicator-color="primary"
      narrow-indicator
      align="left"
    >
      <q-tab name="all" label="All" />
      <q-tab name="draft" label="Draft" />
      <q-tab name="registration" label="Registration" />
      <q-tab name="active" label="Active" />
      <q-tab name="scoring" label="Scoring" />
      <q-tab name="final" label="Final" />
    </q-tabs>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredMatches.length === 0" class="text-center q-pa-xl text-grey">
      <q-icon name="emoji_events" size="4em" class="q-mb-md" />
      <div class="text-h6">No matches found</div>
      <div>Create your first match to get started</div>
    </div>

    <!-- Match List -->
    <div v-else class="row q-gutter-md">
      <div
        v-for="m in filteredMatches"
        :key="m.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <MatchCard
          :match="m"
          @click="$router.push(`/admin/matches/${m.id}`)"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMatch } from 'src/composables/useMatch';
import MatchCard from 'src/components/match/MatchCard.vue';

const { matches, loading } = useMatch();

const statusFilter = ref('all');

const filteredMatches = computed(() => {
  if (statusFilter.value === 'all') return matches.value;
  return matches.value.filter((m) => m.status === statusFilter.value);
});
</script>
