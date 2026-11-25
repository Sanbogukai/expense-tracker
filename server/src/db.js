// Opens the SQLite database and makes sure its tables exist. index.js opens the real file;
// each test opens a fresh one in memory.

// better-sqlite3 talks to SQLite synchronously: each query returns its result directly.
import Database from 'better-sqlite3';

// The tables, created only when missing, so starting the server never touches existing data.
const SCHEMA = `
  -- One row per browser. The browser keeps the random key and sends it with every request;
  -- transactions point at the id, so the key itself is stored only once.
  CREATE TABLE IF NOT EXISTS owners (
    -- Unique number for each owner; SQLite assigns it and never reuses one.
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    -- The random key (a UUID). UNIQUE also gives it an index, so lookups by key are fast.
    key          TEXT    NOT NULL UNIQUE,
    -- When the owner was made, as an ISO time (2026-11-24T10:00:00.000Z).
    created_at   TEXT    NOT NULL,
    -- When the owner last used the app; owners unseen for 30 days are removed. ISO times
    -- sort and compare correctly as plain text.
    last_seen_at TEXT    NOT NULL
  );

  -- One row per income or expense entry.
  CREATE TABLE IF NOT EXISTS transactions (
    -- Unique number for each row; SQLite assigns it and never reuses one.
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    -- The owner this row belongs to. ON DELETE CASCADE removes an owner's rows with it.
    owner_id     INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
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

  -- Every query asks for one owner's rows, usually by month and newest first, so the index
  -- leads with owner_id and then date.
  CREATE INDEX IF NOT EXISTS idx_transactions_owner_date ON transactions (owner_id, date);
`;

// Where an older database's shared transactions are moved to, untouched.
const OLD_TABLE = 'transactions_before_owners';

// Before owners existed, transactions had no owner_id column. Such a table is renamed out of
// the way rather than deleted, so its rows stay in the file, and a new table is created.
function moveSharedTable(db) {
  // One row per column of the transactions table; an empty list when the table is missing.
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  // No table yet, or already the new shape: nothing to move.
  if (columns.length === 0 || columns.some((column) => column.name === 'owner_id')) return;
  // Renames the old table; CREATE TABLE IF NOT EXISTS below then makes the new one.
  db.exec(`ALTER TABLE transactions RENAME TO ${OLD_TABLE}`);
  // Says what happened, so the missing rows are not a mystery.
  console.log(`Moved the shared transactions to ${OLD_TABLE}; each browser now has its own list.`);
}

// Opens the database at `path` (or ':memory:' for a throwaway one) and returns it.
export function openDatabase(path) {
  // Opens the file, creating it if it does not exist.
  const db = new Database(path);
  // Write-ahead logging: reads are not blocked while a write is happening.
  db.pragma('journal_mode = WAL');
  // SQLite ignores REFERENCES and ON DELETE CASCADE unless this is switched on, per connection.
  db.pragma('foreign_keys = ON');
  // An older shared table goes aside before the new tables are made.
  moveSharedTable(db);
  // Creates any missing table and index.
  db.exec(SCHEMA);
  // Hands the open connection to the caller.
  return db;
}
