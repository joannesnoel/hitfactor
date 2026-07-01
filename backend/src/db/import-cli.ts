import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from './schema.js';
import { parsePsc } from '../modules/import/practiscore-psc.js';
import { importMatch } from '../modules/import/import.service.js';

// Usage: tsx src/db/import-cli.ts <file.psc> [--dry-run] [--admin <email>]
async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const adminEmail =
    args[args.indexOf('--admin') + 1] && args.includes('--admin')
      ? args[args.indexOf('--admin') + 1]
      : 'admin@hitfactor.com';

  if (!file) {
    console.error('usage: import-cli <file.psc> [--dry-run] [--admin <email>]');
    process.exit(1);
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  if (!admin) {
    console.error(`Admin user ${adminEmail} not found — cannot attribute scores.`);
    process.exit(1);
  }

  const parsed = parsePsc(new Uint8Array(readFileSync(file)));
  console.log(
    `Parsed "${parsed.name}" (${parsed.date}): ${parsed.stages.length} stages, ${parsed.entries.length} entries`
  );

  const summary = await importMatch(parsed, admin.id, { dryRun });
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
