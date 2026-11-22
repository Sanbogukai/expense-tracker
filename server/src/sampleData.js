// Sample data for demos: about three months of CAD transactions, September to November 2026.
// seedDatabase() empties the table first, so the totals are always the same after a seed.

// The shared database connection.
import db from './db.js';

// One array per transaction: [type, amount in cents, category, date, note].
// 240000 cents is $2,400.00; null means no note. Exported so seed.js can report the count.
export const rows = [
  // September 2026
  ['income', 240000, 'Salary', '2026-09-01', 'Paycheque'],
  ['expense', 165000, 'Rent', '2026-09-01', null],
  ['expense', 8640, 'Food', '2026-09-06', 'Groceries'],
  ['expense', 15600, 'Transport', '2026-09-08', 'Monthly transit pass'],
  ['expense', 9215, 'Utilities', '2026-09-12', 'Hydro'],
  ['income', 240000, 'Salary', '2026-09-15', 'Paycheque'],
  ['expense', 4250, 'Fun', '2026-09-20', 'Movie night'],
  // October 2026
  ['income', 240000, 'Salary', '2026-10-01', 'Paycheque'],
  ['expense', 165000, 'Rent', '2026-10-01', null],
  ['expense', 11275, 'Food', '2026-10-04', 'Groceries'],
  ['expense', 6500, 'Utilities', '2026-10-10', 'Internet'],
  ['expense', 15600, 'Transport', '2026-10-08', 'Monthly transit pass'],
  ['income', 240000, 'Salary', '2026-10-15', 'Paycheque'],
  ['expense', 3890, 'Food', '2026-10-18', 'Takeout'],
  // November 2026
  ['income', 240000, 'Salary', '2026-11-01', 'Paycheque'],
  ['expense', 165000, 'Rent', '2026-11-01', null],
  ['expense', 9730, 'Food', '2026-11-05', 'Groceries'],
  ['expense', 15600, 'Transport', '2026-11-08', 'Monthly transit pass'],
  ['expense', 10480, 'Utilities', '2026-11-12', 'Hydro'],
  ['income', 240000, 'Salary', '2026-11-15', 'Paycheque'],
  ['expense', 7999, 'Fun', '2026-11-16', 'Concert tickets'],
  ['expense', 1650, 'Food', '2026-11-19', 'Coffee and bagel'],
];

// Adds one row. The five ? are filled, in order, from the five values of a row above.
const insert = db.prepare(`
  INSERT INTO transactions (type, amount_cents, category, date, note)
  VALUES (?, ?, ?, ?, ?)
`);

// One transaction: either the whole seed lands or nothing changes.
// db.transaction() wraps the function so its statements commit together, or roll back on error.
export const seedDatabase = db.transaction(() => {
  // Empties the table, so the totals are always the same after a seed.
  db.prepare('DELETE FROM transactions').run();
  // Resets the id counter AUTOINCREMENT keeps in sqlite_sequence, so ids start at 1 again.
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'transactions'").run();
  // Inserts every sample row; ...row spreads its five values into the five ? slots.
  for (const row of rows) insert.run(...row);
});

// Used on start-up when SEED_IF_EMPTY=1, so a freshly wiped host (Render's free disk) has demo data.
export function seedIfEmpty() {
  // Counts the rows already there; .get() returns the single result row as { count }.
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM transactions').get();
  // Data already present: leave it alone, so nothing anyone added is wiped.
  if (count > 0) return false;
  // Empty table: load the samples.
  seedDatabase();
  // Tells the caller that seeding happened.
  return true;
}
