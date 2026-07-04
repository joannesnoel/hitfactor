<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-dark text-white">
      <q-toolbar>
        <img src="/logo.png" alt="HitFactor" class="q-mr-sm" style="height: 30px" />
        <q-toolbar-title>HitFactor</q-toolbar-title>
        <SyncStatusIndicator />
        <q-btn flat round dense icon="account_circle">
          <q-menu>
            <q-list style="min-width: 150px">
              <q-item-label header>{{ userName }}</q-item-label>
              <q-separator />
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
      <router-view />
    </q-page-container>

    <q-footer elevated class="bg-white text-primary">
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
          :to="'/shooter/dashboard'"
        />
        <q-route-tab
          name="performance"
          icon="insights"
          label="Performance"
          :to="'/shooter/performance'"
        />
        <q-route-tab
          name="profile"
          icon="person"
          label="Profile"
          :to="'/shooter/profile'"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';

const router = useRouter();
const authStore = useAuthStore();
const activeTab = ref('dashboard');

const userName = computed(() => authStore.user?.display_name ?? 'User');

async function handleLogout() {
  await authStore.logout();
  router.push('/auth/login');
}
</script>
