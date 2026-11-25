// All /api routes: find the owner from the key header, validate the input, run SQL, send
// JSON back. Every query is limited to the owner's own rows.

// Router groups routes so app.js can mount them all under /api in one line.
import { Router } from 'express';
// Counts requests per visitor and answers 429 past the limit.
import { rateLimit } from 'express-rate-limit';
// Zod describes what valid input looks like and checks it.
import { z } from 'zod';
// Owner creation and lookup.
import { HOUR_MS, ownerStore } from './owners.js';
// The rows a new owner starts with.
import { sampleTransactions } from './samples.js';

// The only categories the app accepts. Exported so other files could reuse the same list.
export const CATEGORIES = ['Food', 'Rent', 'Transport', 'Utilities', 'Fun', 'Salary', 'Other'];

// The header the browser sends its key in.
export const OWNER_HEADER = 'X-Owner-Key';

// HTTP status codes used here, by name.
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY = 429;

// Input limits: at most $100,000,000.00 per entry (a sanity cap), and 200 characters of note.
const AMOUNT_MAX_CENTS = 100_000_000_00;
const NOTE_MAX = 200;

// A month filter: four digits, a dash, then 01 to 12.
// Example: "2026-11" and "2026-01" match; "2026-13", "2026-1" and "26-11" do not.
// Try it: https://regex101.com/?regex=%5E%5Cd%7B4%7D-(0%5B1-9%5D%7C1%5B0-2%5D)%24&flavor=javascript&testString=2026-11
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
// The second argument is the error message.
const month = z.string().regex(MONTH_PATTERN, 'Use YYYY-MM');

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

// Request body for POST /transactions. strictObject refuses unknown fields, so a body cannot
// slip in an owner_id or an id of its own.
const newTransaction = z.strictObject({
  // Exactly "income" or "expense".
  type: z.enum(['income', 'expense']),
  // A whole number of cents, above zero, at most AMOUNT_MAX_CENTS.
  amount_cents: z.number().int().positive().max(AMOUNT_MAX_CENTS),
  // Must be one of the known categories.
  category: z.enum(CATEGORIES),
  // A real calendar date in YYYY-MM-DD; impossible dates like 2026-11-31 fail here.
  date: z.iso.date(),
  // Optional note: spaces trimmed off both ends, at most NOTE_MAX characters.
  note: z.string().trim().max(NOTE_MAX).optional(),
});

// The owner key: a UUID, as the owner store makes. Anything else cannot be a key.
const ownerKey = z.uuid();

// A row id from the URL: a positive whole number.
const idParam = z.coerce.number().int().positive();

// Turns a failed Zod parse into a 400 body the client can show next to each field.
function validationError(res, error) {
  // 400 means "your request was wrong"; the body says what was wrong, field by field.
  return res.status(HTTP_BAD_REQUEST).json({
    // One summary line for the whole request.
    error: 'Validation failed',
    // Zod's issue list, reduced to the field name and a readable message.
    // path is an array like ['amount_cents']; join('.') makes it a plain string.
    issues: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  });
}

// The 429 answer for both limits below, in the API's error shape.
function tooMany(_req, res) {
  res.status(HTTP_TOO_MANY).json({ error: 'Too many requests; try again later' });
}

// Builds the router over the app's services: deps.db, deps.now, deps.ownerLimit and
// deps.maxTransactions (see app.js).
export function apiRouter(deps) {
  // The owner queries for this database.
  const owners = ownerStore(deps.db);

  // Prepared statements: the SQL is compiled once and reused for every request. Values are
  // passed separately as @named parameters, never pasted into the SQL text, which is what
  // stops SQL injection. Every statement names the owner, so no route can reach another
  // owner's rows.

  // Adds one row. The @names are filled from the object passed to insert.run().
  const insert = deps.db.prepare(`
    INSERT INTO transactions (owner_id, type, amount_cents, category, date, note)
    VALUES (@owner_id, @type, @amount_cents, @category, @date, @note)
  `);
  // Reads one of the owner's rows by id.
  const findById = deps.db.prepare(`
    SELECT id, type, amount_cents, category, date, note, created_at
    FROM transactions WHERE id = ? AND owner_id = ?
  `);
  // Deletes one of the owner's rows by id. Another owner's id matches nothing.
  const deleteById = deps.db.prepare('DELETE FROM transactions WHERE id = ? AND owner_id = ?');
  // How many rows the owner has, for the cap.
  const countRows = deps.db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE owner_id = ?');
  // The owner's rows, filtered. A NULL filter lets every row through, so one statement covers
  // all four combinations. id DESC breaks ties, so entries on the same day show newest first.
  const listRows = deps.db.prepare(`
    SELECT id, type, amount_cents, category, date, note, created_at
    FROM transactions
    WHERE owner_id = @owner_id
      AND (@category IS NULL OR category = @category)
      -- substr(date, 1, 7) takes the first 7 characters of 2026-11-05, which is 2026-11.
      AND (@month IS NULL OR substr(date, 1, 7) = @month)
    ORDER BY date DESC, id DESC
  `);
  // Totals per type and category for the owner.
  const summaryRows = deps.db.prepare(`
    -- One output row per (type, category) pair, with the sum of its amounts.
    SELECT type, category, SUM(amount_cents) AS total_cents
    FROM transactions
    -- When @month is NULL every row counts (all time); otherwise only rows in that month.
    WHERE owner_id = @owner_id AND (@month IS NULL OR substr(date, 1, 7) = @month)
    GROUP BY type, category
    -- Biggest totals first, which is the order the breakdown is shown in.
    ORDER BY total_cents DESC
  `);

  // Finds the owner from the key header, or answers 401. It is added to each route that needs
  // it rather than to the whole router, so an unknown /api path still gets a 404.
  function requireOwner(req, res, next) {
    // A key that is not even a UUID cannot exist, so it skips the database.
    const key = ownerKey.safeParse(req.get(OWNER_HEADER));
    // The owner's id, or null for a missing or unknown key.
    const ownerId = key.success ? owners.findOwnerId(key.data, deps.now()) : null;
    // No owner: stop here. The client answers a 401 by getting a new key.
    if (ownerId === null) return res.status(HTTP_UNAUTHORIZED).json({ error: 'Unknown or missing owner key' });
    // Later handlers read it from res.locals, Express's place for per-request values.
    res.locals.ownerId = ownerId;
    // On to the route.
    next();
  }

  // New owners per IP address per hour. Each owner copies the samples, so this keeps a script
  // from filling the database. The count is kept in memory and resets on restart.
  const ownerLimiter = rateLimit({
    windowMs: HOUR_MS,
    limit: deps.ownerLimit,
    // Sends the standard RateLimit header so a client can see how many are left.
    standardHeaders: 'draft-8',
    // Leaves out the older X-RateLimit-* headers.
    legacyHeaders: false,
    handler: tooMany,
  });

  // The router that the routes below are attached to.
  const router = Router();

  // POST /api/owners: a new owner with the samples. The answer holds only the key.
  router.post('/owners', ownerLimiter, (_req, res) => {
    // Makes the owner at the current time, with samples dated from it.
    const now = deps.now();
    // 201 means "created".
    res.status(HTTP_CREATED).json({ key: owners.createOwner(now, sampleTransactions(now)) });
  });

  // GET /api/categories: the category list, so the client never hard-codes its own copy.
  // It is the same for everyone, so it needs no key.
  router.get('/categories', (_req, res) => {
    // res.json() sends the array as JSON with status 200.
    res.json(CATEGORIES);
  });

  // GET /api/transactions?category=Food&month=2026-11: the owner's filtered list, newest first.
  router.get('/transactions', requireOwner, (req, res) => {
    // safeParse checks without throwing: it returns { success, data } or { success, error }.
    const parsed = listQuery.safeParse(req.query);
    // Bad filters stop here with a 400.
    if (!parsed.success) return validationError(res, parsed.error);
    // A missing filter becomes NULL, which the SQL reads as "any".
    const rows = listRows.all({
      owner_id: res.locals.ownerId,
      category: parsed.data.category ?? null,
      month: parsed.data.month ?? null,
    });
    // Every matching row as JSON.
    res.json(rows);
  });

  // POST /api/transactions: adds one entry from the JSON body.
  router.post('/transactions', requireOwner, (req, res) => {
    // `?? {}` turns a missing body into an empty object, so Zod reports the missing fields.
    const parsed = newTransaction.safeParse(req.body ?? {});
    // Invalid body: 400 with the per-field issues.
    if (!parsed.success) return validationError(res, parsed.error);
    // The owner's row count, checked before adding so one owner cannot fill the disk.
    const { count } = countRows.get(res.locals.ownerId);
    // At the cap: 422, "understood, but not allowed".
    if (count >= deps.maxTransactions) {
      return res
        .status(HTTP_UNPROCESSABLE)
        .json({ error: `You can keep at most ${deps.maxTransactions.toLocaleString('en-CA')} transactions` });
    }
    // Splits note off from the other fields (rest holds type, amount_cents, category, date).
    const { note, ...rest } = parsed.data;
    // Inserts the row for this owner; an empty note is stored as NULL rather than ''.
    // lastInsertRowid is the id SQLite gave the new row.
    const { lastInsertRowid } = insert.run({ ...rest, note: note || null, owner_id: res.locals.ownerId });
    // 201 means "created"; the body is the saved row, including its id and created_at.
    res.status(HTTP_CREATED).json(findById.get(lastInsertRowid, res.locals.ownerId));
  });

  // DELETE /api/transactions/:id: removes one of the owner's entries.
  router.delete('/transactions/:id', requireOwner, (req, res) => {
    // URL parts are always strings; coerce turns "12" into 12 and refuses /abc, /1.5 or /0.
    const id = idParam.safeParse(req.params.id);
    // A malformed id is a 400.
    if (!id.success) return validationError(res, id.error);
    // changes is how many rows the DELETE removed: 1 or 0.
    const { changes } = deleteById.run(id.data, res.locals.ownerId);
    // Nothing removed: no such row, or another owner's. Both answer 404, so ids reveal nothing.
    if (changes === 0) return res.status(HTTP_NOT_FOUND).json({ error: 'Transaction not found' });
    // 204 means "done, nothing to send back"; end() sends the empty response.
    res.status(HTTP_NO_CONTENT).end();
  });

  // GET /api/summary?month=2026-11: income, expense and balance totals plus per-category sums.
  router.get('/summary', requireOwner, (req, res) => {
    // Checks the optional month.
    const parsed = summaryQuery.safeParse(req.query);
    // A bad month is a 400.
    if (!parsed.success) return validationError(res, parsed.error);
    // Runs the grouped query. A missing month becomes NULL, which the SQL reads as "all time".
    const rows = summaryRows.all({ owner_id: res.locals.ownerId, month: parsed.data.month ?? null });
    // Adds up the per-category totals of one type ('income' or 'expense').
    // filter keeps that type's rows; reduce sums their total_cents, starting from 0.
    const total = (type) => rows.filter((r) => r.type === type).reduce((sum, r) => sum + r.total_cents, 0);
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

  // app.js mounts this at /api.
  return router;
}
