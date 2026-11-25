// The transactions every new owner starts with: a few rows in the current month, so the live
// demo never opens on an empty page. Three is enough to show the totals and the breakdown
// without crowding the list.

// Characters of an ISO time that make up the month (2026-11).
const MONTH_LENGTH = 7;

// Amounts in cents: $2,400.00 pay, $1,650.00 rent, $97.30 groceries.
const SALARY_CENTS = 240000;
const RENT_CENTS = 165000;
const GROCERIES_CENTS = 9730;

// The samples for an owner made at `now`, all on the 1st of the current month (in UTC), so
// they show under the month the app opens on and never fall on a day still to come.
export function sampleTransactions(now) {
  // "2026-11-24T10:00:00.000Z" as text; the month is its first characters.
  const iso = now.toISOString();
  // The 1st of the current month, such as 2026-11-01.
  const firstOfMonth = `${iso.slice(0, MONTH_LENGTH)}-01`;
  // Same fields as a POST /api/transactions body.
  return [
    { type: 'income', amount_cents: SALARY_CENTS, category: 'Salary', date: firstOfMonth, note: 'Paycheque' },
    { type: 'expense', amount_cents: RENT_CENTS, category: 'Rent', date: firstOfMonth, note: null },
    { type: 'expense', amount_cents: GROCERIES_CENTS, category: 'Food', date: firstOfMonth, note: 'Groceries' },
  ];
}
