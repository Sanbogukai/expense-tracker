// Opens the SQLite database and makes sure the transactions table exists.
// Every other server file imports `db` from here, so there is exactly one connection.

// better-sqlite3 is a synchronous SQLite driver: queries return results directly, no await needed.
import Database from 'better-sqlite3';
// Converts a file:// URL into a normal Windows or Linux path.
import { fileURLToPath } from 'node:url';

// Where the database file lives. DB_PATH (an environment variable) wins when set, so tests and
// Render can use another file; otherwise it is server/expenses.db, one folder up from this file.
// `??` means "use the right side only if the left side is null or undefined".
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../expenses.db', import.meta.url));

// Opens the file, creating it if it does not exist yet.
const db = new Database(dbPath);
// WAL (write-ahead log) mode lets reads carry on while a write is happening, and is faster.
db.pragma('journal_mode = WAL');

// exec() runs one or more SQL statements that return no rows.
// IF NOT EXISTS makes this safe to run on every start: it only creates what is missing.
db.exec(`
  -- One row per income or expense entry.
  CREATE TABLE IF NOT EXISTS transactions (
    -- Unique number for each row; SQLite assigns it and never reuses one.
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Only these two words are allowed; the database itself refuses anything else.
    type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    -- Money as whole cents ($12.50 is 1250), so sums never pick up floating-point errors.
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    -- One of the category names from routes.js; the API checks it before inserting.
    category     TEXT    NOT NULL,
    -- The date as text, YYYY-MM-DD. That format sorts correctly as plain text.
    date         TEXT    NOT NULL,
    -- Optional free text; NULL when left empty.
    note         TEXT,
    -- When the row was saved, filled in by SQLite (UTC).
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  -- An index on date makes month filters and newest-first sorting fast as the table grows.
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
`);

// Shares the one open connection with the rest of the server.
export default db;
