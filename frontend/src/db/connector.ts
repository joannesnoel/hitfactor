import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
} from '@powersync/web';
import { api } from 'src/boot/axios';

export class PowerSyncConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const response = await api.get('/api/auth/powersync-token');
    const { endpoint, token, expiresAt } = response.data;
    return {
      endpoint,
      token,
      expiresAt: new Date(expiresAt),
    };
  }

  // Upload locally-queued writes to the API. The backend (PUT /api/powersync/data)
  // expects a single body of the form `{ operations: [{ op, type, id, data }] }`.
  // The previous per-entry shape (`{ table, id, data }`) made every upload 400, so
  // no client write — scores included — ever persisted; PowerSync just retried forever.
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      const operations = transaction.crud.map((entry) => ({
        op: entry.op, // 'PUT' | 'PATCH' | 'DELETE'
        type: entry.table,
        id: entry.id,
        data: entry.opData ?? undefined,
      }));

      const res = await api.put('/api/powersync/data', { operations });

      // 207 (partial success): surface rejected ops but still clear the queue so a
      // single permanently-rejected op can't wedge sync forever.
      if (res.data?.errors?.length) {
        console.error('[PowerSync] Some operations were rejected:', res.data.errors);
      }

      await transaction.complete();
    } catch (error) {
      console.error('Upload data error:', error);
      throw error;
    }
  }
}
