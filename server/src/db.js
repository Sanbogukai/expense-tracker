import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

// The database file sits in server/ unless DB_PATH says otherwise.
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../expenses.db', import.meta.url));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    category     TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    note         TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
`);

export default db;
