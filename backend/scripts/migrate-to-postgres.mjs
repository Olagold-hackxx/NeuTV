#!/usr/bin/env node
// Copy the SQLite stores into Postgres.
//
//   npm run migrate:postgres -- --url postgres://localhost:5432/neutv
//   npm run migrate:postgres -- --url ... --dry-run
//
// Every service keeps its own schema in Postgres, exactly as it kept its own
// file in SQLite. Rows are inserted with ON CONFLICT DO NOTHING, so running
// this twice is safe and a partial run can be resumed.
//
// The destination is migrated first, so the tables exist and match the schema
// the code expects rather than whatever shape the SQLite file happens to have.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openSqlite } from '../platform/db/sqlite.mjs';

import { openIdentityStore } from '../services/identity/store.mjs';
import { openWalletStore } from '../services/wallet/store.mjs';
import { openSocialStore } from '../services/social/store.mjs';
import { openLiveStore } from '../services/live/store.mjs';
import { openAdminStore } from '../services/admin/store.mjs';
import { openModerationStore } from '../services/moderation/store.mjs';

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Order matters within a service: parents before the rows that reference them.
const SERVICES = [
  { name: 'identity', open: openIdentityStore, tables: ['users', 'sessions'] },
  { name: 'wallet', open: openWalletStore, tables: ['transactions', 'entries'] },
  { name: 'social', open: openSocialStore, tables: ['posts', 'comments', 'upvotes', 'saves', 'follows'] },
  { name: 'live', open: openLiveStore, tables: ['presence', 'comments', 'reactions', 'chat_messages', 'tv_likes', 'stage_overrides'] },
  { name: 'admin', open: openAdminStore, tables: ['videos', 'programme', 'programme_history'] },
  { name: 'moderation', open: openModerationStore, tables: ['decisions'] },
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i++; } else { args[a.slice(2)] = true; }
}

const url = args.url || process.env.DATABASE_URL;
if (!url) {
  console.error('\n  Pass --url postgres://... or set DATABASE_URL\n');
  process.exit(1);
}
const dryRun = Boolean(args['dry-run']);

console.log(`\n  ${dryRun ? 'Dry run:' : 'Migrating'} SQLite -> ${url.replace(/\/\/[^@]*@/, '//***@')}\n`);

let grandTotal = 0;
for (const service of SERVICES) {
  const file = join(BACKEND_ROOT, 'services', service.name, 'data', `${service.name}.db`);
  if (!existsSync(file)) {
    console.log(`  ${service.name.padEnd(11)} no SQLite file, skipping`);
    continue;
  }

  const source = openSqlite(file);
  // Opening the destination runs its migrations, so the tables exist.
  const destination = await service.open(url, { schema: service.name });

  let moved = 0;
  for (const table of service.tables) {
    let rows;
    try {
      rows = await source.all(`SELECT * FROM ${table}`);
    } catch {
      continue; // table absent in an older file
    }
    if (!rows.length) continue;

    if (!dryRun) {
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(',');
      const sql = `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      await destination.tx(async (t) => {
        for (const row of rows) await t.run(sql, ...columns.map((c) => row[c]));
      });
    }
    moved += rows.length;
    console.log(`  ${service.name.padEnd(11)} ${String(rows.length).padStart(5)} ${table}`);
  }

  if (!moved) console.log(`  ${service.name.padEnd(11)} empty`);
  grandTotal += moved;
  await source.close();
  await destination.close();
}

console.log(`\n  ${dryRun ? 'Would copy' : 'Copied'} ${grandTotal} rows.`);
console.log('  Uploaded video files are NOT copied: point NEUTV_MEDIA_DRIVER at');
console.log('  object storage and re-upload, or keep serving them from disk.\n');
