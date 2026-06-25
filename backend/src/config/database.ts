import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';

const connectionString =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.DB_USER ?? 'hitfactor'}:${process.env.DB_PASSWORD ?? 'hitfactor_dev_password'}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? 'hitfactor'}`;

// Connection for queries
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });

// Connection for migrations (max 1 connection)
export function getMigrationClient() {
  const migrationClient = postgres(connectionString, { max: 1 });
  return drizzle(migrationClient, { schema });
}

export { queryClient };
