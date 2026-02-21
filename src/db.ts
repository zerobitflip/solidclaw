import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { config } from "./config.js";

const dbPath = config.dbPath;
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

sqlite.run("PRAGMA journal_mode=WAL");

sqlite.run(`
CREATE TABLE IF NOT EXISTS device_sessions (
  device_code TEXT PRIMARY KEY,
  user_code TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  approved_at INTEGER,
  account_id TEXT,
  scopes TEXT
)
`);

sqlite.run(`
CREATE TABLE IF NOT EXISTS tokens (
  access_token TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  account_id TEXT,
  scopes TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
)
`);

sqlite.run(`
CREATE TABLE IF NOT EXISTS credentials (
  tool TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  metadata TEXT,
  updated_at INTEGER NOT NULL
)
`);

sqlite.run(`
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  tool TEXT,
  account_id TEXT,
  created_at INTEGER NOT NULL,
  meta TEXT
)
`);
