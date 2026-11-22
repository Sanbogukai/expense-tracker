// All /api routes: validate the input, run SQL, send JSON back.

// Router groups routes so index.js can mount them all under /api in one line.
import { Router } from 'express';
// Zod describes what valid input looks like and checks it.
import { z } from 'zod';
// The shared database connection from db.js.
import db from './db.js';

// The only categories the app accepts. Exported so other files could reuse the same list.
export const CATEGORIES = ['Food', 'Rent', 'Transport', 'Utilities', 'Fun', 'Salary', 'Other'];

// A month filter: four digits, a dash, then 01 to 12. The second argument is the error message.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

// Query string for GET /transactions: both filters may be left out.
const listQuery = z.object({
  // Must be one of CATEGORIES when given.
  category: z.enum(CATEGORIES).optional(),
  // Must look like 2026-11 when given.
  month: month.optional(),
});

// Query string for GET /summary: only a month, and it may be left out (all time).
const summaryQuery = z.object({
  month: month.optional(),
});

// Request body for POST /transactions.
const newTransaction = z.object({
  // Exactly "income" or "expense".
  type: z.enum(['income', 'expense']),
  // A whole number of cents, above zero, at most $100,000,000.00 (a sanity cap).
  amount_cents: z.number().int().positive().max(100_000_000_00),
  // Must be one of the known categories.
  category: z.enum(CATEGORIES),
  // A real calendar date in YYYY-MM-DD; impossible dates like 2026-11-31 fail here.
  date: z.iso.date(),
  // Optional note: spaces trimmed off both ends, at most 200 characters.
  note: z.string().trim().max(200).optional(),
});

// Turns a failed Zod parse into a 400 body the client can show next to each field.
function validationError(res, error) {
  // 400 means "your request was wrong"; the body says what was wrong, field by field.
  return res.status(400).json({
    // One summary line for the whole request.
    error: 'Validation failed',
    // Zod's issue list, reduced to the field name and a readable message.
    // path is an array like ['amount_cents']; join('.') makes it a plain string.
    issues: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  });
}

// Prepared statements: the SQL is compiled once at start-up and reused for every request.
// Values are passed separately as @named parameters, never pasted into the SQL text,
// which is what stops SQL injection.

// Adds one row. The @names are filled from the object passed to insert.run().
const insert = db.prepare(`
  INSERT INTO transactions (type, amount_cents, category, date, note)
  VALUES (@type, @amount_cents, @category, @date, @note)
`);
// Reads one row by id; the ? is filled from the argument to .get().
const findById = db.prepare('SELECT * FROM transactions WHERE id = ?');
// Deletes one row by id.
const deleteById = db.prepare('DELETE FROM transactions WHERE id = ?');
// Totals per type and category.
const summaryRows = db.prepare(`
  -- One output row per (type, category) pair, with the sum of its amounts.
  SELECT type, category, SUM(amount_cents) AS total_cents
  FROM transactions
  -- When @month is NULL every row counts (all time); otherwise only rows in that month.
  -- substr(date, 1, 7) takes the first 7 characters of 2026-11-05, which is 2026-11.
  WHERE (@month IS NULL OR substr(date, 1, 7) = @month)
  GROUP BY type, category
  -- Biggest totals first, which is the order the breakdown is shown in.
  ORDER BY total_cents DESC
`);

// The router that the routes below are attached to.
const router = Router();

// GET /api/categories: the category list, so the client never hard-codes its own copy.
router.get('/categories', (req, res) => {
  // res.json() sends the array as JSON with status 200.
  res.json(CATEGORIES);
});

// GET /api/transactions?category=Food&month=2026-11: the filtered list, newest first.
router.get('/transactions', (req, res) => {
  // safeParse checks without throwing: it returns { success, data } or { success, error }.
  const parsed = listQuery.safeParse(req.query);
  // Bad filters stop here with a 400.
  if (!parsed.success) return validationError(res, parsed.error);
  // The validated filters; either may be undefined.
  const { category, month } = parsed.data;

  // WHERE conditions collected as text, joined with AND below.
  const where = [];
  // Values for the @parameters, kept apart from the SQL text.
  const params = {};
  // Only add the category condition when a category was given.
  if (category) {
    // Fixed SQL text; the value travels separately as @category.
    where.push('category = @category');
    // The value that fills @category.
    params.category = category;
  }
  // Only add the month condition when a month was given.
  if (month) {
    // Compares the YYYY-MM part of the stored date.
    where.push('substr(date, 1, 7) = @month');
    // The value that fills @month.
    params.month = month;
  }

  // Builds the query. Only the fixed strings above are joined into it, never user input.
  // id DESC breaks ties, so entries on the same day show newest first.
  const sql = `
    SELECT * FROM transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, id DESC
  `;
  // Runs it with the parameter values and sends every matching row as JSON.
  res.json(db.prepare(sql).all(params));
});

// POST /api/transactions: adds one entry from the JSON body.
router.post('/transactions', (req, res) => {
  // `?? {}` turns a missing body into an empty object, so Zod reports the missing fields.
  const parsed = newTransaction.safeParse(req.body ?? {});
  // Invalid body: 400 with the per-field issues.
  if (!parsed.success) return validationError(res, parsed.error);

  // Splits note off from the other fields (rest holds type, amount_cents, category, date).
  const { note, ...rest } = parsed.data;
  // Inserts the row; an empty note is stored as NULL rather than ''.
  // lastInsertRowid is the id SQLite gave the new row.
  const { lastInsertRowid } = insert.run({ ...rest, note: note || null });
  // 201 means "created"; the body is the saved row, including its id and created_at.
  res.status(201).json(findById.get(lastInsertRowid));
});

// DELETE /api/transactions/:id: removes one entry. :id is read from the URL.
router.delete('/transactions/:id', (req, res) => {
  // URL parts are always strings, so convert to a number first.
  const id = Number(req.params.id);
  // Rejects things like /abc, /1.5 or /0 before touching the database.
  if (!Number.isInteger(id) || id < 1) {
    // 400: the id itself is malformed.
    return res.status(400).json({ error: 'id must be a positive integer' });
  }
  // changes is how many rows the DELETE removed: 1 or 0.
  const { changes } = deleteById.run(id);
  // Nothing removed means no row had that id: 404 "not found".
  if (changes === 0) return res.status(404).json({ error: 'Transaction not found' });
  // 204 means "done, nothing to send back"; end() sends the empty response.
  res.status(204).end();
});

// GET /api/summary?month=2026-11: income, expense and balance totals plus per-category sums.
router.get('/summary', (req, res) => {
  // Checks the optional month.
  const parsed = summaryQuery.safeParse(req.query);
  // A bad month is a 400.
  if (!parsed.success) return validationError(res, parsed.error);

  // Runs the grouped query. A missing month becomes NULL, which the SQL reads as "all time".
  const rows = summaryRows.all({ month: parsed.data.month ?? null });
  // Adds up the per-category totals of one type ('income' or 'expense').
  // filter keeps that type's rows; reduce sums their total_cents, starting from 0.
  const total = (type) =>
    rows.filter((r) => r.type === type).reduce((sum, r) => sum + r.total_cents, 0);
  // Sum of all income categories.
  const income_cents = total('income');
  // Sum of all expense categories.
  const expense_cents = total('expense');

  // Sends the summary. All amounts are in cents; the client formats them as dollars.
  res.json({
    // Echoes the month back (null for all time), so the client knows what the totals cover.
    month: parsed.data.month ?? null,
    // Total income.
    income_cents,
    // Total expenses.
    expense_cents,
    // Can be negative when spending exceeds income.
    balance_cents: income_cents - expense_cents,
    // The per-category rows, used for the breakdown under the cards.
    by_category: rows,
  });
});

// index.js imports this and mounts it at /api.
export default router;
