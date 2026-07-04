<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleDrawer" />
        <q-toolbar-title class="ellipsis">
          {{ match?.name ?? 'Match' }}
        </q-toolbar-title>
        <q-badge
          v-if="match"
          :color="statusColor(match.status)"
          :label="match.status"
          class="q-mr-sm"
        />
        <SyncStatusIndicator />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawerOpen" show-if-above bordered class="bg-grey-1">
      <q-list>
        <q-item
          clickable
          v-ripple
          :to="'/admin/dashboard'"
          active-class="text-primary"
          class="text-grey-7"
        >
          <q-item-section avatar>
            <q-icon name="arrow_back" />
          </q-item-section>
          <q-item-section>Back to Dashboard</q-item-section>
        </q-item>

        <q-separator spaced />

        <q-item-label v-if="match" header class="text-grey-8 ellipsis">
          {{ match.name }}
        </q-item-label>

        <q-item
          clickable
          v-ripple
          :to="`/admin/matches/${matchId}`"
          exact
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="info" />
          </q-item-section>
          <q-item-section>Info</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="`/admin/matches/${matchId}/stages`"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="flag" />
          </q-item-section>
          <q-item-section>Stages</q-item-section>
          <q-item-section side>
            <q-badge v-if="stages.length" color="grey-5" text-color="white" :label="stages.length" />
          </q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="`/admin/matches/${matchId}/registrations`"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="people" />
          </q-item-section>
          <q-item-section>Registrations</q-item-section>
          <q-item-section side>
            <q-badge v-if="registrations.length" color="grey-5" text-color="white" :label="registrations.length" />
          </q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="`/admin/matches/${matchId}/officers`"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="security" />
          </q-item-section>
          <q-item-section>Officials</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="`/admin/matches/${matchId}/results`"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="leaderboard" />
          </q-item-section>
          <q-item-section>Results</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue';
import { useRoute } from 'vue-router';
import { useMatch } from 'src/composables/useMatch';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';

const route = useRoute();
const matchId = route.params.id as string;
const drawerOpen = ref(false);

const { match, stages, registrations, loading } = useMatch(matchId);

// Provide match data to child pages so they don't re-fetch
provide('matchContext', { match, stages, registrations, loading, matchId });

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return 'grey';
    case 'registration': return 'blue';
    case 'active': return 'green';
    case 'scoring': return 'orange';
    case 'final': return 'purple';
    case 'archived': return 'grey-7';
    default: return 'grey';
  }
}
</script>
