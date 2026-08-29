// SQLite adapter.
//
// Kept as a first-class engine, not a legacy path: it is what makes the gate
// suite run in memory in under two seconds with no server. The API is async so
// that a service cannot tell which engine it is talking to.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openSqlite(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };

  const handle = {
    dialect: 'sqlite',
    async all(sql, ...params) { return stmt(sql).all(...params); },
    async get(sql, ...params) { return stmt(sql).get(...params); },
    async run(sql, ...params) {
      const res = stmt(sql).run(...params);
      return { changes: Number(res.changes ?? 0) };
    },
    async exec(sql) { db.exec(sql); },
    async tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(handle);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async close() { db.close(); },
  };
  return handle;
}
