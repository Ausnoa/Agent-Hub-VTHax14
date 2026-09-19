import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrations } from "./migrations.ts";

export function databasePath(): string {
  return process.env.COMPOSER_DB ?? ".data/composer.sqlite";
}

/** Opens a connection with the project's pragmas and brings the schema up to date. */
export function openDatabase(path = databasePath()): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    migrate(db);
    return db;
  } catch (error) { db.close(); throw error; }
}

export function schemaVersion(db: DatabaseSync): number {
  return Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
}

/** Applies each pending migration in its own transaction; safe when the app and worker start together. */
export function migrate(db: DatabaseSync) {
  for (const migration of migrations) {
    transaction(db, () => {
      const current = schemaVersion(db);
      if (migration.version <= current) return;
      if (migration.version !== current + 1) throw new Error(`Migration ${migration.version} cannot follow schema version ${current}`);
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/** Runs synchronous work in one write transaction. Never await network calls inside it. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    if (result instanceof Promise) throw new Error("Transactions must be synchronous");
    db.exec("COMMIT");
    return result;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
