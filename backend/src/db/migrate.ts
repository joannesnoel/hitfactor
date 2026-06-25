import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getMigrationClient } from '../config/database.js';

async function runMigrations() {
  const db = getMigrationClient();

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');

  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
