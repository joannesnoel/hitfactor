import { boot } from 'quasar/wrappers';
import { useSyncStore } from 'src/stores/sync.store';

type PSDb = import('@powersync/web').PowerSyncDatabase;

let db: PSDb | null = null;
let available = false;
let connectSettled = false;
let readyResolvers: Array<(db: PSDb | null) => void> = [];

export function getPowerSyncDb() {
  return db;
}

export function isPowerSyncAvailable() {
  return available;
}

/**
 * Resolves with the connected PowerSync db once it finishes connecting, or
 * `null` if PowerSync is unavailable / fell back to API-only. Lets pages await
 * readiness instead of racing the asynchronous connect (which starts after
 * login). This is the correct way to obtain the db — `inject('powerSyncDb')`
 * only ever yields the boot-time `null`.
 */
export function whenPowerSyncReady(): Promise<PSDb | null> {
  if (db) return Promise.resolve(db);
  if (connectSettled || !available) return Promise.resolve(null);
  return new Promise((resolve) => readyResolvers.push(resolve));
}

function settleReady(value: PSDb | null) {
  connectSettled = true;
  const resolvers = readyResolvers;
  readyResolvers = [];
  resolvers.forEach((r) => r(value));
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
    const { PowerSyncDatabase, SyncStreamConnectionMethod } = await import('@powersync/web');
    const { powerSyncSchema } = await import('src/db/powersync-schema');
    const { PowerSyncConnector } = await import('src/db/connector');

    db = new PowerSyncDatabase({
      database: { dbFilename: 'hitfactor.db' },
      schema: powerSyncSchema,
    });

    const connector = new PowerSyncConnector();
    await db.init();
    // Force HTTP streaming. The default (WebSocket) does not establish through
    // the Cloudflare proxy in front of the sync service, leaving clients stuck
    // in API-only mode (nothing syncs). HTTP streaming works through the proxy.
    await db.connect(connector, {
      connectionMethod: SyncStreamConnectionMethod.HTTP,
    });
    console.log('[PowerSync] Connected');
    const syncStore = useSyncStore();
    syncStore.updateStatus('connected');
    settleReady(db);
  } catch (err) {
    console.warn('[PowerSync] Connect failed, falling back to API-only:', err);
    db = null;
    const syncStore = useSyncStore();
    syncStore.updateStatus('api-only');
    settleReady(null);
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
  connectSettled = false;
}
