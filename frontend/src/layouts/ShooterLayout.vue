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
          class="q-mr-sm"
          @click="router.push(pageHeaderBackTo)"
        />
        <img v-else src="/logo.png" alt="HitFactor" class="q-mr-sm" style="height: 30px" />
        <q-toolbar-title class="ellipsis">{{ pageHeaderTitle || 'HitFactor' }}</q-toolbar-title>
        <SyncStatusIndicator />
        <q-btn flat round dense icon="account_circle">
          <q-menu>
            <q-list style="min-width: 180px">
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

    <q-page-container>
      <EmailVerifyBanner />
      <router-view />
    </q-page-container>

    <!-- Tabs hide on full-screen task pages (e.g. scoring a stage) -->
    <q-footer v-if="!pageHeaderBackTo" elevated class="bg-white text-primary">
      <q-tabs
        v-model="activeTab"
        active-color="primary"
        indicator-color="primary"
        class="text-grey-7"
        narrow-indicator
        dense
      >
        <q-route-tab
          name="dashboard"
          icon="emoji_events"
          label="Matches"
          :to="'/dashboard'"
        />
        <q-route-tab
          name="performance"
          icon="insights"
          label="Performance"
          :to="'/performance'"
        />
        <q-route-tab
          name="profile"
          icon="person"
          label="Profile"
          :to="'/profile'"
        />
      </q-tabs>
    </q-footer>
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

const { switchTargets } = useRoleSwitch();

const router = useRouter();
const authStore = useAuthStore();
const activeTab = ref('dashboard');

const userName = computed(() => authStore.user?.display_name ?? 'User');

async function handleLogout() {
  await authStore.logout();
  router.push('/auth/login');
}
</script>
