import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../config/database.js';

async function reset() {
  console.log('Resetting database...');

  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  console.log('All tables truncated.');
  console.log('Running seed...\n');

  // Import and run seed inline
  await import('./seed.js');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
