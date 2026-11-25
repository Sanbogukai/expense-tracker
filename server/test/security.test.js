// The app-wide guards: security headers, the body size limit, JSON errors and the built client.

// Vitest's test functions.
import { describe, expect, it } from 'vitest';
// Makes a throwaway client folder for the page tests.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Shared set-up.
import { BAD_REQUEST, KEY, NOT_FOUND, OK, TOO_LARGE, makeApp, newOwner } from './helpers.js';

// A body bigger than the 10 kB limit.
const OVERSIZED_NOTE = 'x'.repeat(20_000);

describe('security headers', () => {
  it('are on API answers', async () => {
    const { api } = makeApp();
    const res = await api.get('/api/categories');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // Express's "X-Powered-By: Express" is removed, so the stack is not advertised.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('are on the page too', async () => {
    // A minimal built client in a temporary folder.
    const clientDir = mkdtempSync(join(tmpdir(), 'expense-client-'));
    writeFileSync(join(clientDir, 'index.html'), '<!doctype html><title>Expense Tracker</title>');
    const { api } = makeApp({ clientDir });
    // Any page address gets index.html, with the headers.
    const res = await api.get('/some/page');
    expect(res.status).toBe(OK);
    expect(res.text).toContain('Expense Tracker');
    expect(res.headers['content-security-policy']).toBeTruthy();
  });
});

describe('request bodies', () => {
  it('over 10 kB are refused with 413', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const res = await api.post('/api/transactions').set(KEY, key).send({ note: OVERSIZED_NOTE });
    expect(res.status).toBe(TOO_LARGE);
    expect(res.body.error).toBeTruthy();
  });

  it('that are not JSON get a JSON 400', async () => {
    const { api } = makeApp();
    const key = await newOwner(api);
    const res = await api
      .post('/api/transactions')
      .set(KEY, key)
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(BAD_REQUEST);
    expect(res.body.error).toBeTruthy();
  });
});

describe('unknown API routes', () => {
  it('answer a JSON 404, not 401', async () => {
    const { api } = makeApp();
    const res = await api.get('/api/nothing-here');
    expect(res.status).toBe(NOT_FOUND);
    expect(res.body.error).toContain('/api/nothing-here');
  });
});
