// Store factory + migration runner.
//
// A migration is either a plain SQL string (when both engines accept it
// verbatim, which is most of them) or { sqlite, postgres } when they genuinely
// differ. Declared, not translated: a rewriter that is subtly wrong fails only
// in production, and the differences here amount to a handful of column types.

import { openSqlite } from './sqlite.mjs';
import { openPostgres } from './postgres.mjs';

export { toNumberedPlaceholders, coerceRow } from './sql.mjs';

/**
 * The one dialect substitution applied to schema SQL.
 *
 * SQLite's INTEGER is up to 8 bytes; Postgres's INTEGER is 4 and overflows at
 * 2.1 billion. Every millisecond timestamp in this schema (1.79e12 and rising)
 * would silently fail to insert. Coin amounts, counts and 0/1 flags are all
 * comfortably inside BIGINT too, so promoting every INTEGER column is correct
 * as well as simple.
 *
 * This is deliberately the ONLY rewrite. Anything else that differs between the
 * engines is declared per dialect in the migration itself.
 */
export const portableDdl = (sql, dialect) =>
  (dialect === 'postgres' ? sql.replace(/\bINTEGER\b/g, 'BIGINT') : sql);

/**
 * @param {string} target ':memory:', a file path, or a postgres:// URL
 * @param {Record<string, string | {sqlite: string, postgres: string}>} migrations
 */
export async function openStore(target, migrations, options = {}) {
  const isPostgres = /^postgres(ql)?:\/\//.test(target);

  // The schema has to exist before a pooled connection can point search_path at
  // it, so it is created on a throwaway connection with no search_path set.
  if (isPostgres && options.schema) {
    const bootstrap = openPostgres(target, { max: 1 });
    try {
      await bootstrap.exec(`CREATE SCHEMA IF NOT EXISTS "${options.schema}"`);
    } finally {
      await bootstrap.close();
    }
  }

  const store = isPostgres ? openPostgres(target, options) : openSqlite(target);

  await store.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)',
  );

  // Postgres allows several backends to boot at once, so migrating has to be
  // serialised or two of them race to CREATE TABLE. An advisory lock is held
  // for the duration and released automatically when the session ends.
  // Namespaced by schema so two services can migrate concurrently; they only
  // contend when they are migrating the same namespace.
  const LOCK = 8_147_231;
  const lockKey = LOCK + (options.schema ? [...options.schema].reduce((a, c) => a + c.charCodeAt(0), 0) : 0);
  if (isPostgres) await store.exec(`SELECT pg_advisory_lock(${lockKey})`);

  try {
    const applied = new Set((await store.all('SELECT id FROM _migrations')).map((r) => r.id));

    for (const [id, definition] of Object.entries(migrations)) {
      if (applied.has(id)) continue;
      const declared = typeof definition === 'string' ? definition : definition[store.dialect];
      if (declared === undefined) throw new Error(`Migration ${id} has no SQL for ${store.dialect}`);
      const sql = typeof definition === 'string' ? portableDdl(declared, store.dialect) : declared;

      try {
        // DDL is transactional in both engines, so a half-applied migration is
        // not a state either database can end up in.
        await store.tx(async (t) => {
          await t.exec(sql);
          await t.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)', id, 0);
        });
      } catch (err) {
        throw new Error(`Migration ${id} failed on ${store.dialect}: ${err.message}`);
      }
    }
  } finally {
    if (isPostgres) await store.exec(`SELECT pg_advisory_unlock(${lockKey})`);
  }

  return store;
}

/**
 * Where a service's data lives, and how it is namespaced.
 *
 * With DATABASE_URL set every service shares one Postgres database but owns its
 * own SCHEMA - the same isolation a private SQLite file gave it. Without it,
 * each service keeps its own file, which is what tests and a zero-setup
 * checkout use.
 *
 * This is the single source of that convention. It used to be duplicated in
 * compose, and scripts/create-admin.mjs quietly disagreed with it: it opened
 * Postgres with no schema, wrote to public.users, and created an account the
 * gateway could not see.
 */
export function storeTarget(service, { databaseUrl = process.env.DATABASE_URL, dataDir, memory = false } = {}) {
  if (memory) return { target: ':memory:', options: {} };
  if (databaseUrl) return { target: databaseUrl, options: { schema: service } };
  return { target: `${dataDir}/${service}/data/${service}.db`, options: {} };
}

/** Open a service's store using the convention above. */
export function openServiceStore(openFn, service, config = {}) {
  const { target, options } = storeTarget(service, config);
  return openFn(target, options);
}
