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
          v-else
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <img src="/logo.png" alt="HitFactor" class="q-mr-sm" style="height: 30px" />
        <q-toolbar-title class="ellipsis">{{ pageHeaderTitle || 'HitFactor' }}</q-toolbar-title>
        <SyncStatusIndicator />
        <q-btn flat round dense icon="account_circle">
          <q-menu>
            <q-list style="min-width: 190px">
              <q-item-label header>{{ userName }}</q-item-label>
              <q-separator />
              <q-item
                v-for="t in switchTargets"
                :key="t.key"
                clickable
                v-close-popup
                :to="t.to"
              >
                <q-item-section avatar><q-icon :name="t.icon" /></q-item-section>
                <q-item-section>{{ t.label }}</q-item-section>
              </q-item>
              <q-separator v-if="switchTargets.length" />
              <q-item clickable v-close-popup @click="goToProfile">
                <q-item-section avatar>
                  <q-icon name="person" />
                </q-item-section>
                <q-item-section>Profile</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="handleLogout">
                <q-item-section avatar>
                  <q-icon name="logout" />
                </q-item-section>
                <q-item-section>Logout</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      class="bg-grey-1"
    >
      <!-- Officer area: only officer items -->
      <q-list v-if="currentArea === 'officer'">
        <q-item-label header class="text-grey-8">Officer</q-item-label>
        <q-item clickable v-ripple to="/officer/dashboard" exact active-class="text-primary">
          <q-item-section avatar><q-icon name="sports_score" /></q-item-section>
          <q-item-section>Scoring Dashboard</q-item-section>
        </q-item>
      </q-list>

      <!-- Admin area: only admin items -->
      <q-list v-else>
        <q-item-label header class="text-grey-8">Admin</q-item-label>
        <q-item clickable v-ripple to="/admin/dashboard" active-class="text-primary">
          <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
          <q-item-section>Dashboard</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/matches/create" active-class="text-primary">
          <q-item-section avatar><q-icon name="add_circle" /></q-item-section>
          <q-item-section>Create Match</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/import" active-class="text-primary">
          <q-item-section avatar><q-icon name="upload_file" /></q-item-section>
          <q-item-section>Import Results</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/officers" active-class="text-primary">
          <q-item-section avatar><q-icon name="badge" /></q-item-section>
          <q-item-section>Match Officials</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/shooters" active-class="text-primary">
          <q-item-section avatar><q-icon name="people" /></q-item-section>
          <q-item-section>Shooters</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/accounts" active-class="text-primary">
          <q-item-section avatar><q-icon name="manage_accounts" /></q-item-section>
          <q-item-section>Accounts</q-item-section>
        </q-item>
        <q-item clickable v-ripple to="/admin/ranges" active-class="text-primary">
          <q-item-section avatar><q-icon name="location_on" /></q-item-section>
          <q-item-section>Shooting Ranges</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <EmailVerifyBanner />
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import { useRoleSwitch } from 'src/composables/useRoleSwitch';
import { pageHeaderTitle, pageHeaderBackTo } from 'src/composables/usePageHeader';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';
import EmailVerifyBanner from 'src/components/common/EmailVerifyBanner.vue';

const router = useRouter();
const authStore = useAuthStore();
const { currentArea, switchTargets } = useRoleSwitch();
const leftDrawerOpen = ref(false);

const userName = computed(() => authStore.user?.display_name ?? 'User');

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.push(pageHeaderBackTo.value || '/');
}

function goToProfile() {
  router.push('/shooter/profile');
}

async function handleLogout() {
  await authStore.logout();
  router.push('/auth/login');
}
</script>
