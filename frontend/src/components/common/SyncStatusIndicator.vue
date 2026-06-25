<template>
  <div class="row items-center no-wrap q-mr-sm">
    <q-icon
      :name="statusIcon"
      :class="['sync-indicator', syncStore.syncStatus]"
      size="20px"
    />
    <q-badge
      v-if="syncStore.pendingUploads > 0"
      color="orange"
      floating
      rounded
      :label="syncStore.pendingUploads"
    />
    <q-tooltip>
      <div>Status: {{ statusLabel }}</div>
      <div v-if="syncStore.lastSyncTime">
        Last sync: {{ formatTime(syncStore.lastSyncTime) }}
      </div>
      <div v-if="syncStore.pendingUploads > 0">
        Pending uploads: {{ syncStore.pendingUploads }}
      </div>
      <div v-if="syncStore.errorMessage">
        Error: {{ syncStore.errorMessage }}
      </div>
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSyncStore } from 'src/stores/sync.store';

const syncStore = useSyncStore();

const statusIcon = computed(() => {
  switch (syncStore.syncStatus) {
    case 'connected':
      return 'cloud_done';
    case 'syncing':
      return 'cloud_sync';
    case 'api-only':
      return 'cloud';
    case 'offline':
      return 'cloud_off';
    case 'error':
      return 'cloud_off';
    default:
      return 'cloud_off';
  }
});

const statusLabel = computed(() => {
  switch (syncStore.syncStatus) {
    case 'connected':
      return 'Connected';
    case 'syncing':
      return 'Syncing...';
    case 'api-only':
      return 'Online (no offline sync)';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
});

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}
</script>
