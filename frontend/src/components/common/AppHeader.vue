<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <slot name="left">
        <q-btn flat dense round icon="arrow_back" @click="$router.back()" />
      </slot>
      <q-toolbar-title>
        <slot name="title">HitFactor</slot>
      </q-toolbar-title>
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth.store';
import SyncStatusIndicator from './SyncStatusIndicator.vue';

const router = useRouter();
const authStore = useAuthStore();

const userName = computed(() => authStore.user?.display_name ?? 'User');

async function handleLogout() {
  await authStore.logout();
  router.push('/auth/login');
}
</script>
