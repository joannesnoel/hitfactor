import { boot } from 'quasar/wrappers';
import { useSyncStore } from 'src/stores/sync.store';

let db: import('@powersync/web').PowerSyncDatabase | null = null;
let available = false;

export function getPowerSyncDb() {
  return db;
}

export function isPowerSyncAvailable() {
  return available;
}

export default boot(({ app }) => {
  // Check if secure context (required for navigator.locks / WASM workers)
  available =
    typeof navigator !== 'undefined' &&
    !!navigator.locks &&
    (globalThis.isSecureContext ?? false);

  if (!available) {
    console.warn(
      '[PowerSync] Skipping — insecure context. Use HTTPS or http://localhost.',
    );
    const syncStore = useSyncStore();
    syncStore.updateStatus('api-only');
  }

  // Provide null initially; connectPowerSync() will set the real db later
  app.provide('powerSyncDb', null);
});

/**
 * Call after successful login to create the database and start syncing.
 */
export async function connectPowerSync() {
  if (!available || db) return;

  try {
    const { PowerSyncDatabase } = await import('@powersync/web');
    const { powerSyncSchema } = await import('src/db/powersync-schema');
    const { PowerSyncConnector } = await import('src/db/connector');

    db = new PowerSyncDatabase({
      database: { dbFilename: 'hitfactor.db' },
      schema: powerSyncSchema,
    });

    const connector = new PowerSyncConnector();
    await db.init();
    await db.connect(connector);
    console.log('[PowerSync] Connected');
    const syncStore = useSyncStore();
    syncStore.updateStatus('connected');
  } catch (err) {
    console.warn('[PowerSync] Connect failed, falling back to API-only:', err);
    db = null;
    const syncStore = useSyncStore();
    syncStore.updateStatus('api-only');
  }
}

/**
 * Call on logout to disconnect and clear local data.
 */
export async function disconnectPowerSync() {
  if (!db) return;
  try {
    await db.disconnectAndClear();
  } catch {
    // ignore
  }
  db = null;
}
