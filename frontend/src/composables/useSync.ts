import { computed, onMounted, onUnmounted } from 'vue';
import { useSyncStore } from 'src/stores/sync.store';
import { whenPowerSyncReady } from 'src/boot/powersync';

export function useSync() {
  const syncStore = useSyncStore();
  let statusListener: (() => void) | null = null;

  const syncStatus = computed(() => syncStore.syncStatus);
  const pendingUploads = computed(() => syncStore.pendingUploads);
  const lastSyncTime = computed(() => syncStore.lastSyncTime);
  const isOnline = computed(() => syncStore.syncStatus === 'connected');
  const isSyncing = computed(() => syncStore.syncStatus === 'syncing');

  async function startTracking() {
    const db = await whenPowerSyncReady();
    if (!db) return;

    // Track connection status changes
    const subscription = db.registerListener({
      statusChanged: (status) => {
        if (status.connected) {
          syncStore.updateStatus('connected');
        } else if (status.dataFlowStatus?.uploading) {
          syncStore.updateStatus('syncing');
        } else {
          syncStore.updateStatus('offline');
        }

        // Track pending uploads
        const uploading = status.dataFlowStatus?.uploading;
        if (uploading) {
          syncStore.updateStatus('syncing');
        }
      },
    });

    statusListener = () => {
      subscription?.();
    };
  }

  onMounted(() => {
    void startTracking();
  });

  onUnmounted(() => {
    if (statusListener) {
      statusListener();
      statusListener = null;
    }
  });

  return {
    syncStatus,
    pendingUploads,
    lastSyncTime,
    isOnline,
    isSyncing,
  };
}
