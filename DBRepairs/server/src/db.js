import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export function createDatabase(config) {
  const dbPath = config.database.path || join(dirname(fileURLToPath(import.meta.url)), "..", "dbrepairs.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const applied = new Set(db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name));
  const files = readdirSync(migrationsDirectory).filter((n) => n.endsWith(".sql")).sort();
  const insert = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(migrationsDirectory, name), "utf8");
    db.exec(sql);
    insert.run(name);
  }
}
