import {
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type CrudEntry,
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

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await this.uploadCrudEntry(op);
      }
      await transaction.complete();
    } catch (error) {
      console.error('Upload data error:', error);
      throw error;
    }
  }

  private async uploadCrudEntry(entry: CrudEntry): Promise<void> {
    const { op, type: table, id } = entry;
    const data = entry.opData;

    let method: 'PUT' | 'PATCH' | 'DELETE';
    switch (op) {
      case 'PUT':
        method = 'PUT';
        break;
      case 'PATCH':
        method = 'PATCH';
        break;
      case 'DELETE':
        method = 'DELETE';
        break;
      default:
        method = 'PUT';
    }

    await api({
      method: method === 'DELETE' ? 'delete' : method === 'PUT' ? 'put' : 'patch',
      url: '/api/powersync/data',
      data: {
        table,
        id,
        data,
      },
    });
  }
}
