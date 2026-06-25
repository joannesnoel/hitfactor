import { wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { getPowerSyncDb } from 'src/boot/powersync';
import * as schema from './schema';

export function useDatabase() {
  const powerSyncDb = getPowerSyncDb();
  const db = wrapPowerSyncWithDrizzle(powerSyncDb, { schema });
  return { db, powerSyncDb };
}

export { schema };
