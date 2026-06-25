import { defineStore } from 'pinia';
import { ref, onUnmounted } from 'vue';

export type SyncStatusType = 'connected' | 'syncing' | 'offline' | 'error' | 'api-only';

export const useSyncStore = defineStore('sync', () => {
  const syncStatus = ref<SyncStatusType>('offline');
  const pendingUploads = ref(0);
  const lastSyncTime = ref<Date | null>(null);
  const errorMessage = ref<string | null>(null);
  // Track the "desired" status when online (connected vs api-only)
  const onlineStatus = ref<SyncStatusType>('api-only');

  function updateStatus(status: SyncStatusType) {
    syncStatus.value = status;
    if (status === 'connected' || status === 'api-only') {
      onlineStatus.value = status;
    }
    if (status === 'connected') {
      lastSyncTime.value = new Date();
      errorMessage.value = null;
    }
  }

  function setPendingUploads(count: number) {
    pendingUploads.value = count;
  }

  function setError(message: string) {
    syncStatus.value = 'error';
    errorMessage.value = message;
  }

  function handleOnline() {
    syncStatus.value = onlineStatus.value;
  }

  function handleOffline() {
    syncStatus.value = 'offline';
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Set initial status based on browser state
  if (!navigator.onLine) {
    syncStatus.value = 'offline';
  }

  return {
    syncStatus,
    pendingUploads,
    lastSyncTime,
    errorMessage,
    updateStatus,
    setPendingUploads,
    setError,
  };
});
