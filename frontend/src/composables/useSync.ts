import { computed, onMounted, onUnmounted } from 'vue';
import { useSyncStore } from 'src/stores/sync.store';
import { whenPowerSyncReady } from 'src/boot/powersync';

export function useSync() {
  const syncStore = useSyncStore();
  let statusListener: (() => void) | null = null;
  let pendingTimer: ReturnType<typeof setInterval> | null = null;
  let unmounted = false;

  const syncStatus = computed(() => syncStore.syncStatus);
  const pendingUploads = computed(() => syncStore.pendingUploads);
  const lastSyncTime = computed(() => syncStore.lastSyncTime);
  const isOnline = computed(() => syncStore.syncStatus === 'connected');
  const isSyncing = computed(() => syncStore.syncStatus === 'syncing');

  async function startTracking() {
    const db = await whenPowerSyncReady();
    if (!db || unmounted) return;

    // Pending uploads: the CRUD queue has no change event, so refresh it on every
    // status change and on a short poll (cheap local query) while tracking.
    const refreshPending = async () => {
      try {
        syncStore.setPendingUploads((await db.getUploadQueueStats()).count);
      } catch {
        // db closed (e.g. logout) — leave the last value
      }
    };
    void refreshPending();
    pendingTimer = setInterval(() => void refreshPending(), 2000);

    // Track connection status changes
    const subscription = db.registerListener({
      statusChanged: (status) => {
        const flow = status.dataFlowStatus;
        const err = flow?.uploadError ?? flow?.downloadError;
        if (err) {
          // e.g. a failing upload keeps retrying and blocks the queue — show it.
          syncStore.setError(err.message || 'Sync error');
        } else if (flow?.uploading || flow?.downloading) {
          syncStore.updateStatus('syncing');
        } else if (status.connected) {
          syncStore.updateStatus('connected');
        } else {
          syncStore.updateStatus('offline');
        }
        if (status.lastSyncedAt) syncStore.lastSyncTime = status.lastSyncedAt;
        void refreshPending();
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
    unmounted = true;
    if (statusListener) {
      statusListener();
      statusListener = null;
    }
    if (pendingTimer) {
      clearInterval(pendingTimer);
      pendingTimer = null;
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
