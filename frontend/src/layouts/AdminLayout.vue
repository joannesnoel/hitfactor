<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title>HitFactor</q-toolbar-title>
        <SyncStatusIndicator />
        <q-btn flat round dense icon="account_circle">
          <q-menu>
            <q-list style="min-width: 150px">
              <q-item-label header>{{ userName }}</q-item-label>
              <q-separator />
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
      <q-list>
        <q-item-label header class="text-grey-8">Navigation</q-item-label>

        <!-- Admin Section -->
        <q-item
          clickable
          v-ripple
          :to="'/admin/dashboard'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="dashboard" />
          </q-item-section>
          <q-item-section>Admin Dashboard</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="'/admin/matches/create'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="add_circle" />
          </q-item-section>
          <q-item-section>Create Match</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="'/admin/import'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="upload_file" />
          </q-item-section>
          <q-item-section>Import Results</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="'/admin/officers'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="badge" />
          </q-item-section>
          <q-item-section>Match Officials</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="'/admin/ranges'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="location_on" />
          </q-item-section>
          <q-item-section>Shooting Ranges</q-item-section>
        </q-item>

        <q-separator spaced />

        <!-- Officer Section -->
        <q-item-label header class="text-grey-8">Officer</q-item-label>

        <q-item
          clickable
          v-ripple
          :to="'/officer/dashboard'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="sports_score" />
          </q-item-section>
          <q-item-section>Scoring Dashboard</q-item-section>
        </q-item>

        <q-separator spaced />

        <!-- Shooter Section -->
        <q-item-label header class="text-grey-8">Shooter</q-item-label>

        <q-item
          clickable
          v-ripple
          :to="'/shooter/dashboard'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="home" />
          </q-item-section>
          <q-item-section>Shooter Dashboard</q-item-section>
        </q-item>

        <q-item
          clickable
          v-ripple
          :to="'/shooter/profile'"
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon name="person" />
          </q-item-section>
          <q-item-section>Profile</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import SyncStatusIndicator from 'src/components/common/SyncStatusIndicator.vue';

const router = useRouter();
const authStore = useAuthStore();
const leftDrawerOpen = ref(false);

const userName = computed(() => authStore.user?.display_name ?? 'User');

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function goToProfile() {
  router.push('/shooter/profile');
}

async function handleLogout() {
  await authStore.logout();
  router.push('/auth/login');
}
</script>
