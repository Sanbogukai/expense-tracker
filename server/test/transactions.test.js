// Transactions: listing, adding, deleting and the summary, each limited to the owner's own rows.

// Vitest's test functions.
import { describe, expect, it } from 'vitest';
// Shared set-up.
import {
  BAD_REQUEST,
  CREATED,
  KEY,
  NO_CONTENT,
  NOT_FOUND,
  OK,
  UNPROCESSABLE,
  entry,
  makeApp,
  newOwner,
} from './helpers.js';

// The samples a new owner starts with, as the routes see them.
const SAMPLE_COUNT = 3;

describe('adding and listing', () => {
  it('adds a transaction and lists it newest first', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const added = await api.post('/api/transactions').set(KEY, key).send(entry({ date: '2026-11-30' }));
    expect(added.status).toBe(CREATED);
    expect(added.body).toMatchObject({ amount_cents: 1250, category: 'Food', note: 'Lunch' });
    // The owner's id is never sent back.
    expect(added.body).not.toHaveProperty('owner_id');
    const list = await api.get('/api/transactions').set(KEY, key);
    expect(list.body).toHaveLength(SAMPLE_COUNT + 1);
    expect(list.body[0].id).toBe(added.body.id);
  });

  it('filters by category and month', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    await api.post('/api/transactions').set(KEY, key).send(entry({ date: '2026-10-05' }));
    const october = await api.get('/api/transactions?month=2026-10').set(KEY, key);
    expect(october.body).toHaveLength(1);
    const rent = await api.get('/api/transactions?category=Rent').set(KEY, key);
    expect(rent.body.map((row) => row.category)).toEqual(['Rent']);
  });

  it('refuses bad input with the field named', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const res = await api.post('/api/transactions').set(KEY, key).send(entry({ amount_cents: -5 }));
    expect(res.status).toBe(BAD_REQUEST);
    expect(res.body.issues[0].field).toBe('amount_cents');
  });

  it('refuses a body that tries to set its own owner', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const res = await api.post('/api/transactions').set(KEY, key).send(entry({ owner_id: 1 }));
    expect(res.status).toBe(BAD_REQUEST);
  });

  it('answers 422 once the owner reaches the cap', async () => {
    // The samples already fill a cap of 3.
    const { api } = makeApp({ maxTransactions: SAMPLE_COUNT });
    const key = await newOwner(api);
    const res = await api.post('/api/transactions').set(KEY, key).send(entry());
    expect(res.status).toBe(UNPROCESSABLE);
    expect(res.body.error).toContain('at most 3');
  });
});

describe('deleting', () => {
  it('deletes one of the owner’s rows', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const [row] = (await api.get('/api/transactions').set(KEY, key)).body;
    expect((await api.delete(`/api/transactions/${row.id}`).set(KEY, key)).status).toBe(NO_CONTENT);
    expect((await api.delete(`/api/transactions/${row.id}`).set(KEY, key)).status).toBe(NOT_FOUND);
  });

  it('answers 400 for an id that is not a positive whole number', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    expect((await api.delete('/api/transactions/abc').set(KEY, key)).status).toBe(BAD_REQUEST);
  });
});

describe('another owner', () => {
  it('cannot see, delete or count someone else’s rows', async () => {
    const { api } = makeApp();
    const owner = await newOwner(api);
    const stranger = await newOwner(api);
    const [mine] = (await api.get('/api/transactions').set(KEY, owner)).body;
    // A delete of someone else's row looks exactly like a missing row.
    expect((await api.delete(`/api/transactions/${mine.id}`).set(KEY, stranger)).status).toBe(NOT_FOUND);
    // The owner's copy is untouched.
    expect((await api.get('/api/transactions').set(KEY, owner)).body).toHaveLength(SAMPLE_COUNT);
    // The stranger adds a big expense; the owner's totals do not move.
    const before = (await api.get('/api/summary').set(KEY, owner)).body;
    await api.post('/api/transactions').set(KEY, stranger).send(entry({ amount_cents: 999999 }));
    const after = (await api.get('/api/summary').set(KEY, owner)).body;
    expect(after).toEqual(before);
  });
});

describe('GET /api/summary', () => {
  it('totals the owner’s month', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const res = await api.get('/api/summary?month=2026-11').set(KEY, key);
    expect(res.status).toBe(OK);
    // Salary 2,400.00 in; rent 1,650.00 and groceries 97.30 out.
    expect(res.body).toMatchObject({ income_cents: 240000, expense_cents: 174730, balance_cents: 65270 });
  });
});
