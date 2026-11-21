import { Router } from 'express';
import { z } from 'zod';
import db from './db.js';

export const CATEGORIES = ['Food', 'Rent', 'Transport', 'Utilities', 'Fun', 'Salary', 'Other'];

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

const listQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  month: month.optional(),
});

const summaryQuery = z.object({
  month: month.optional(),
});

const newTransaction = z.object({
  type: z.enum(['income', 'expense']),
  amount_cents: z.number().int().positive().max(100_000_000_00),
  category: z.enum(CATEGORIES),
  date: z.iso.date(),
  note: z.string().trim().max(200).optional(),
});

// Turns a failed Zod parse into a 400 body the client can show next to each field.
function validationError(res, error) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  });
}

const insert = db.prepare(`
  INSERT INTO transactions (type, amount_cents, category, date, note)
  VALUES (@type, @amount_cents, @category, @date, @note)
`);
const findById = db.prepare('SELECT * FROM transactions WHERE id = ?');
const deleteById = db.prepare('DELETE FROM transactions WHERE id = ?');
const summaryRows = db.prepare(`
  SELECT type, category, SUM(amount_cents) AS total_cents
  FROM transactions
  WHERE (@month IS NULL OR substr(date, 1, 7) = @month)
  GROUP BY type, category
  ORDER BY total_cents DESC
`);

const router = Router();

router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

router.get('/transactions', (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const { category, month } = parsed.data;

  const where = [];
  const params = {};
  if (category) {
    where.push('category = @category');
    params.category = category;
  }
  if (month) {
    where.push('substr(date, 1, 7) = @month');
    params.month = month;
  }

  const sql = `
    SELECT * FROM transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, id DESC
  `;
  res.json(db.prepare(sql).all(params));
});

router.post('/transactions', (req, res) => {
  const parsed = newTransaction.safeParse(req.body ?? {});
  if (!parsed.success) return validationError(res, parsed.error);

  const { note, ...rest } = parsed.data;
  const { lastInsertRowid } = insert.run({ ...rest, note: note || null });
  res.status(201).json(findById.get(lastInsertRowid));
});

router.delete('/transactions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }
  const { changes } = deleteById.run(id);
  if (changes === 0) return res.status(404).json({ error: 'Transaction not found' });
  res.status(204).end();
});

router.get('/summary', (req, res) => {
  const parsed = summaryQuery.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const rows = summaryRows.all({ month: parsed.data.month ?? null });
  const total = (type) =>
    rows.filter((r) => r.type === type).reduce((sum, r) => sum + r.total_cents, 0);
  const income_cents = total('income');
  const expense_cents = total('expense');

  res.json({
    month: parsed.data.month ?? null,
    income_cents,
    expense_cents,
    balance_cents: income_cents - expense_cents,
    by_category: rows,
  });
});

export default router;
