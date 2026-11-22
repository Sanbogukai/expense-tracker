// Sample data for demos: about three months of CAD transactions, September to November 2026.
// seedDatabase() empties the table first, so the totals are always the same after a seed.
import db from './db.js';

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

const insert = db.prepare(`
  INSERT INTO transactions (type, amount_cents, category, date, note)
  VALUES (?, ?, ?, ?, ?)
`);

// One transaction: either the whole seed lands or nothing changes.
export const seedDatabase = db.transaction(() => {
  db.prepare('DELETE FROM transactions').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'transactions'").run();
  for (const row of rows) insert.run(...row);
});

// Used on start-up when SEED_IF_EMPTY=1, so a freshly wiped host (Render's free disk) has demo data.
export function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM transactions').get();
  if (count > 0) return false;
  seedDatabase();
  return true;
}
