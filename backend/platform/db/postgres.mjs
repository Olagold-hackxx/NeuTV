// Postgres adapter.
//
// pg is the backend's only runtime dependency. There is no way to speak the
// Postgres wire protocol without a driver, and writing one would be absurd; pg
// is the standard, and it is what every other Node service in the world uses.
//
// Two engine differences are handled here so no service has to know about them:
//   - placeholders: services write "?", Postgres wants $1..$n
//   - integers: pg returns BIGINT and COUNT() as strings to avoid precision
//     loss, so they are coerced back to numbers on the way out

import pg from 'pg';
import { toNumberedPlaceholders, coerceRow } from './sql.mjs';

const { Pool, types } = pg;

// int8 (BIGINT). Every value this app stores in one - millisecond timestamps,
// coin balances, counts - is well inside Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

export function openPostgres(connectionString, { max = 10, schema = null } = {}) {
  // One schema per service, which is how Postgres expresses the isolation each
  // service got for free when it owned a SQLite file. Without it the services
  // collide: social and live both define a "comments" table, and whichever
  // migrated second failed with "relation already exists".
  //
  // search_path is set through the connection options rather than by issuing
  // SET on a 'connect' handler, so it is applied by the server before the
  // client can run anything and there is no window where it is unset.
  const pool = new Pool({
    connectionString,
    max,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
  // A pool error on an idle client must not take the process down.
  pool.on('error', (err) => console.error('[postgres] idle client error:', err.message));

  const bind = (runner) => ({
    dialect: 'postgres',
    async all(sql, ...params) {
      const res = await runner(toNumberedPlaceholders(sql), params);
      return res.rows.map(coerceRow);
    },
    async get(sql, ...params) {
      const res = await runner(toNumberedPlaceholders(sql), params);
      return res.rows.length ? coerceRow(res.rows[0]) : undefined;
    },
    async run(sql, ...params) {
      const res = await runner(toNumberedPlaceholders(sql), params);
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql) { await runner(sql, []); },
  });

  const handle = {
    schema,
    ...bind((sql, params) => pool.query(sql, params)),
    async tx(fn) {
      // A transaction has to run on ONE connection, not on the pool: statements
      // issued through the pool can land on different clients and would not be
      // in the transaction at all.
      const client = await pool.connect();
      const scoped = { ...bind((sql, params) => client.query(sql, params)), tx: (f) => f(scoped) };
      try {
        await client.query('BEGIN');
        const result = await fn(scoped);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* connection may be gone */ }
        throw err;
      } finally {
        client.release();
      }
    },
    async close() { await pool.end(); },
  };
  return handle;
}
