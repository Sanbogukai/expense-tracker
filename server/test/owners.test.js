// Owners: creation with samples, the key check, the owner limit and the stale clean-up.

// Vitest's test functions.
import { describe, expect, it } from 'vitest';
// Shared set-up.
import { CREATED, KEY, NOW, OK, TOO_MANY, UNAUTHORIZED, makeApp, newOwner } from './helpers.js';
// The code under test, and its time constants.
import { DAY_MS, HOUR_MS, STALE_DAYS, ownerStore } from '../src/owners.js';
import { sampleTransactions } from '../src/samples.js';

// A moment `ms` milliseconds after NOW.
const later = (ms) => new Date(NOW.getTime() + ms);

describe('POST /api/owners', () => {
  it('returns a key whose owner holds the samples, dated in the current month', async () => {
    const { api } = makeApp();
    const res = await api.post('/api/owners');
    expect(res.status).toBe(CREATED);
    // Only the key comes back; the owner's id stays on the server.
    expect(Object.keys(res.body)).toEqual(['key']);
    // The key unlocks the list, which holds every sample in November 2026.
    const list = await api.get('/api/transactions?month=2026-11').set(KEY, res.body.key);
    expect(list.status).toBe(OK);
    expect(list.body).toHaveLength(sampleTransactions(NOW).length);
  });

  it('gives each owner a separate copy', async () => {
    const { api } = makeApp();
    const first = await newOwner(api);
    const second = await newOwner(api);
    // The first owner deletes a sample; the second still has all of them.
    const [victim] = (await api.get('/api/transactions').set(KEY, first)).body;
    await api.delete(`/api/transactions/${victim.id}`).set(KEY, first);
    const secondList = await api.get('/api/transactions').set(KEY, second);
    expect(secondList.body).toHaveLength(sampleTransactions(NOW).length);
  });

  it('answers 429 past the hourly limit per address', async () => {
    const { api } = makeApp({ ownerLimit: 1 });
    expect((await api.post('/api/owners')).status).toBe(CREATED);
    const blocked = await api.post('/api/owners');
    expect(blocked.status).toBe(TOO_MANY);
    expect(blocked.body.error).toContain('Too many');
    // Another address still gets one; trust proxy reads it from X-Forwarded-For.
    const other = await api.post('/api/owners').set('X-Forwarded-For', '203.0.113.9');
    expect(other.status).toBe(CREATED);
  });
});

describe('the owner key', () => {
  it('is required', async () => {
    const { api } = makeApp();
    const res = await api.get('/api/transactions');
    expect(res.status).toBe(UNAUTHORIZED);
    expect(res.body.error).toBeTruthy();
  });

  it('must be a UUID', async () => {
    const { api } = makeApp();
    expect((await api.get('/api/summary').set(KEY, 'not-a-key')).status).toBe(UNAUTHORIZED);
  });

  it('must belong to an owner', async () => {
    const { api } = makeApp();
    expect((await api.get('/api/summary').set(KEY, crypto.randomUUID())).status).toBe(UNAUTHORIZED);
  });

  it('is not needed for the category list', async () => {
    const { api } = makeApp();
    expect((await api.get('/api/categories')).status).toBe(OK);
  });
});

describe('last seen and the clean-up', () => {
  // The stored last-seen time of the owner with this key.
  const lastSeen = (db, key) => db.prepare('SELECT last_seen_at FROM owners WHERE key = ?').get(key).last_seen_at;

  it('writes last seen at most once an hour', async () => {
    const { api, db } = makeApp();
    const key = await newOwner(api);
    const owners = ownerStore(db);
    // Within the hour: unchanged.
    owners.findOwnerId(key, later(HOUR_MS));
    expect(lastSeen(db, key)).toBe(NOW.toISOString());
    // Past the hour: moved to the new time.
    const pastHour = later(HOUR_MS + 1);
    owners.findOwnerId(key, pastHour);
    expect(lastSeen(db, key)).toBe(pastHour.toISOString());
  });

  it('removes owners unseen for 30 days, with their transactions', async () => {
    const { api, db } = makeApp();
    const key = await newOwner(api);
    const owners = ownerStore(db);
    // Exactly 30 days later the owner is not yet past the cutoff.
    expect(owners.deleteStaleOwners(later(STALE_DAYS * DAY_MS))).toBe(0);
    // A moment after, it is removed, and the cascade takes its rows.
    expect(owners.deleteStaleOwners(later(STALE_DAYS * DAY_MS + 1))).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count).toBe(0);
    // The old key no longer works.
    expect((await api.get('/api/transactions').set(KEY, key)).status).toBe(UNAUTHORIZED);
  });
});
