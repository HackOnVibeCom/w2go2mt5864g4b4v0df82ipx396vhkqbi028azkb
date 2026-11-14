// A tiny Cloudflare-D1-compatible wrapper around Node's built-in SQLite, so the
// same API code runs on Workers (D1) in production and on Node for dev and tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

export function openSqliteD1(file = ':memory:') {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  for (const name of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(path.join(MIGRATIONS, name), 'utf8'));
  }
  return new SqliteD1(db);
}

class SqliteD1 {
  constructor(db) {
    this.db = db;
  }
  prepare(sql) {
    return new Statement(this.db, sql, []);
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const out = statements.map((s) => s.runSync());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
  close() {
    this.db.close();
  }
}

class Statement {
  constructor(db, sql, args) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.db, this.sql, args.map((a) => (a === undefined ? null : a)));
  }
  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.args);
    if (!row) return null;
    const plain = { ...row };
    return column ? plain[column] : plain;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.args).map((r) => ({ ...r })) };
  }
  async run() {
    return this.runSync();
  }
  runSync() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
