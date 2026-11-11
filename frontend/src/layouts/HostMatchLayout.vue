<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <q-btn
          v-if="pageHeaderBackTo"
          flat
          dense
          round
          icon="arrow_back"
          aria-label="Back"
          @click="goBack"
        />
        <q-btn
          v-else-if="showDrawer"
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="drawerOpen = !drawerOpen"
        />
        <img src="/logo.png" alt="HitFactor" class="q-mr-sm" style="height: 28px" />
        <q-toolbar-title class="ellipsis">
          {{ pageHeaderTitle || match?.name || 'Match' }}
        </q-toolbar-title>
        <q-badge color="teal" label="Hosting" class="q-mr-sm" />
        <SyncStatusIndicator />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-if="showDrawer"
      v-model="drawerOpen"
      show-if-above
      bordered
      class="bg-grey-1"
    >
      <q-list>
        <q-item clickable v-ripple to="/shooter/dashboard" class="text-grey-7">
          <q-item-section avatar><q-icon name="arrow_back" /></q-item-section>
          <q-item-section>Back to Matches</q-item-section>
        </q-item>

        <q-separator spaced />

        <q-item-label v-if="match" header class="text-grey-8 ellipsis">
          {{ match.name }}
        </q-item-label>

        <q-item clickable v-ripple :to="base" exact active-class="text-primary">
          <q-item-section avatar><q-icon name="qr_code_2" /></q-item-section>
          <q-item-section>Overview &amp; Invite</q-item-section>
        </q-item>

        <q-item clickable v-ripple :to="`${base}/stages`" active-class="text-primary">
          <q-item-section avatar><q-icon name="flag" /></q-item-section>
          <q-item-section>Stages</q-item-section>
          <q-item-section side>
            <q-badge v-if="stages.length" color="grey-5" text-color="white" :label="stages.length" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple :to="`${base}/registrations`" active-class="text-primary">
          <q-item-section avatar><q-icon name="people" /></q-item-section>
          <q-item-section>Shooters</q-item-section>
          <q-item-section side>
            <q-badge v-if="registrations.length" color="grey-5" text-color="white" :label="registrations.length" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple :to="`${base}/results`" active-class="text-primary">
          <q-item-section avatar><q-icon name="leaderboard" /></q-item-section>
          <q-item-section>Results</q-item-section>
        </q-item>

        <!-- Hosts who shot in their own match: their personal analysis -->
        <q-item
          v-if="iShot"
          clickable
          v-ripple
          :to="{ path: `/shooter/matches/${matchId}`, query: { tab: 'analysis' } }"
        >
          <q-item-section avatar><q-icon name="insights" /></q-item-section>
          <q-item-section>My analysis</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMatch } from 'src/composables/useMatch';
import { useSync } from 'src/composables/useSync';
import { useAuthStore } from 'src/stores/auth.store';
import { pageHeaderTitle, pageHeaderBackTo } from 'src/composables/usePageHeader';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';

const route = useRoute();
const router = useRouter();
const matchId = route.params.id as string;
const base = `/shooter/host/matches/${matchId}`;
const drawerOpen = ref(false);

const { match, stages, registrations, loading } = useMatch(matchId);
const authStore = useAuthStore();
// Whether the host is also a shooter in this match (has their own registration).
const iShot = computed(() =>
  registrations.value.some((r) => r.user_id === authStore.user?.id),
);
// Drive the header sync indicator (status, pending uploads, upload errors).
useSync();

// Scoring runs full-width (no drawer); a page there drives the header + back
// button via setPageHeader, matching the officer scoring experience.
const showDrawer = computed(() => !route.path.includes('/score/'));

provide('matchContext', { match, stages, registrations, loading, matchId });

function goBack() {
  if (pageHeaderBackTo.value) void router.push(pageHeaderBackTo.value);
  else if (window.history.length > 1) router.back();
  else void router.push(base);
}
</script>
