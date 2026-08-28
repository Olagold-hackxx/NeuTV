// Per-service SQLite store.
//
// Each service owns exactly one database file and never opens another service's.
// That is the "no shared mutable state" rule enforced in code, not in a comment.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(file, migrations) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');

  const applied = new Set(db.prepare('SELECT id FROM _migrations').all().map((r) => r.id));
  const record = db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)');

  for (const [id, sql] of Object.entries(migrations)) {
    if (applied.has(id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      record.run(id, 0);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${id} failed: ${err.message}`);
    }
  }

  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = db.prepare(sql); cache.set(sql, s); }
    return s;
  };

  return {
    db,
    all: (sql, ...params) => stmt(sql).all(...params),
    get: (sql, ...params) => stmt(sql).get(...params),
    run: (sql, ...params) => stmt(sql).run(...params),
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    close: () => db.close(),
  };
}
