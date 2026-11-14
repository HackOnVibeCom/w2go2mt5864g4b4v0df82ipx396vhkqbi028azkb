// End-to-end smoke test of the HTTP API: create → join → claim → pay → confirm → growth.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createNodeHandler } from '../src/node-server.js';

let server;
let base;
let app;

before(async () => {
  app = createNodeHandler({ dbPath: ':memory:' });
  server = http.createServer(app.handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  app.close();
});

async function api(method, path, { body, token, vid } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (vid) headers['x-visitor'] = vid;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const newSplit = (extra = {}) => ({
  title: 'The Copper Kettle',
  payerName: 'Asha',
  currency: 'INR',
  items: [
    { name: 'Paneer Tikka', price: 34000, qty: 1 },
    { name: 'Beer', price: 90000, qty: 3 },
  ],
  extras: [{ label: 'GST 5%', amount: 6200 }],
  pay: { method: 'upi', handle: 'asha@okaxis' },
  payerClaims: { i2: 1 },
  ...extra,
});

test('full split lifecycle', async () => {
  const created = await api('POST', '/api/splits', { body: newSplit(), vid: 'visitor-asha-01' });
  assert.equal(created.status, 201);
  const { id, adminToken, participantId: payerId } = created.data;

  // Friend opens the link and joins
  const view = await api('GET', `/api/splits/${id}`);
  assert.equal(view.status, 200);
  assert.equal(view.data.totals.grandTotal, 130200);
  await api('POST', '/api/events', { body: { type: 'view', splitId: id }, vid: 'visitor-ravi-01' });

  const joined = await api('POST', `/api/splits/${id}/participants`, { body: { name: 'Ravi' }, vid: 'visitor-ravi-01' });
  assert.equal(joined.status, 201);
  const { participantId: raviId, participantToken: raviToken } = joined.data;

  // Duplicate names are refused with a helpful message
  const dup = await api('POST', `/api/splits/${id}/participants`, { body: { name: 'ravi' } });
  assert.equal(dup.status, 409);

  // Ravi taps his items
  const claimed = await api('PUT', `/api/splits/${id}/participants/${raviId}/claims`, {
    body: { claims: { i1: 1, i2: 2 } },
    token: raviToken,
  });
  assert.equal(claimed.status, 200);
  const ravi = claimed.data.participants.find((p) => p.id === raviId);
  assert.equal(ravi.subtotal, 34000 + 60000);
  assert.equal(claimed.data.totals.unclaimed.total, 0);
  const payer = claimed.data.participants.find((p) => p.id === payerId);
  assert.equal(ravi.total + payer.total, 130200);

  // Nobody else can edit Ravi's claims, and you can't claim 4 of 3 beers
  const forged = await api('PUT', `/api/splits/${id}/participants/${raviId}/claims`, {
    body: { claims: {} },
    token: 'nope',
  });
  assert.equal(forged.status, 403);
  const tooMany = await api('PUT', `/api/splits/${id}/participants/${raviId}/claims`, {
    body: { claims: { i2: 4 } },
    token: raviToken,
  });
  assert.equal(tooMany.status, 400);

  const premature = await api('POST', `/api/splits/${id}/participants/${raviId}/paid`, {
    body: { paid: true }, token: raviToken,
  });
  assert.equal(premature.status, 409);
  const denied = await api('PUT', `/api/splits/${id}/finalization`, {
    body: { finalized: true, rev: claimed.data.rev }, token: raviToken,
  });
  assert.equal(denied.status, 403);
  const finalized = await api('PUT', `/api/splits/${id}/finalization`, {
    body: { finalized: true, rev: claimed.data.rev }, token: adminToken,
  });
  assert.equal(finalized.status, 200);
  assert.ok(finalized.data.finalizedAt);
  const lockedClaim = await api('PUT', `/api/splits/${id}/participants/${raviId}/claims`, {
    body: { claims: {} }, token: raviToken,
  });
  assert.equal(lockedClaim.status, 409);
  const lateGuest = await api('POST', `/api/splits/${id}/participants`, { body: { name: 'Late guest' } });
  assert.equal(lateGuest.status, 409);

  // Ravi marks paid, payer confirms
  const paid = await api('POST', `/api/splits/${id}/participants/${raviId}/paid`, {
    body: { paid: true, finalizedAt: finalized.data.finalizedAt },
    token: raviToken,
  });
  assert.ok(paid.data.participants.find((p) => p.id === raviId).paidAt);
  assert.deepEqual((await api('GET', '/api/growth')).data.settled, []);
  const blockedReopen = await api('PUT', `/api/splits/${id}/finalization`, {
    body: { finalized: false, rev: paid.data.rev }, token: adminToken,
  });
  assert.equal(blockedReopen.status, 409);
  const notAdmin = await api('POST', `/api/splits/${id}/participants/${raviId}/confirm`, {
    body: { confirmed: true, finalizedAt: finalized.data.finalizedAt },
    token: raviToken,
  });
  assert.equal(notAdmin.status, 403);
  const confirmed = await api('POST', `/api/splits/${id}/participants/${raviId}/confirm`, {
    body: { confirmed: true, finalizedAt: finalized.data.finalizedAt },
    token: adminToken,
  });
  assert.ok(confirmed.data.participants.find((p) => p.id === raviId).confirmedAt);

  // Polling with the current rev returns 204 (nothing changed)
  const again = await fetch(`${base}/api/splits/${id}?rev=${confirmed.data.rev}`);
  assert.equal(again.status, 204);

  // Ravi later pays for a dinner and creates his own split from Asha's page
  const child = await api('POST', '/api/splits', {
    body: newSplit({ payerName: 'Ravi', ref: id, pay: { method: 'none' } }),
    vid: 'visitor-ravi-01',
  });
  assert.equal(child.status, 201);

  const g = await api('GET', '/api/growth');
  assert.equal(g.data.splits, 2);
  assert.equal(g.data.referredSplits, 1);
  assert.equal(g.data.peopleReached, 1);
  assert.equal(g.data.becameCreators, 1);
  assert.equal(g.data.longestChain, 2);
  assert.equal(g.data.kFactor, 0.5 * 1); // 1 person reached per 2 splits × 100% conversion
  assert.deepEqual(g.data.settled, [{ currency: 'INR', amount: ravi.total, n: 1 }]);
});

test('finalization checks outstanding claims and prevents stale payment amounts', async () => {
  const created = await api('POST', '/api/splits', { body: newSplit() });
  const { id, adminToken } = created.data;
  const path = `/api/splits/${id}`;
  const change = (finalized, rev) => api('PUT', `${path}/finalization`, {
    body: { finalized, rev }, token: adminToken,
  });
  const initial = await api('GET', path);
  assert.equal((await change(true, initial.data.rev)).status, 409);
  const joined = await api('POST', `${path}/participants`, { body: { name: 'Tara' } });
  const { participantId, participantToken } = joined.data;
  const claims = await api('PUT', `${path}/participants/${participantId}/claims`, {
    body: { claims: { i1: 1, i2: 2 } }, token: participantToken,
  });
  assert.equal((await change(true, initial.data.rev)).status, 409);
  const first = await change(true, claims.data.rev);
  const reopened = await change(false, first.data.rev);
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.finalizedAt, null);
  const locked = await change(true, reopened.data.rev);
  assert.ok(locked.data.finalizedAt > first.data.finalizedAt);
  const stale = await api('POST', `${path}/participants/${participantId}/paid`, {
    body: { paid: true, finalizedAt: first.data.finalizedAt }, token: participantToken,
  });
  assert.equal(stale.status, 409);
});

test('a recorded payment from a pre-finalization bill can still be confirmed', async () => {
  const { data: created } = await api('POST', '/api/splits', { body: newSplit() });
  const path = `/api/splits/${created.id}`;
  const { data: joined } = await api('POST', `${path}/participants`, { body: { name: 'Maya' } });
  await app.db.prepare('UPDATE participants SET paid_at = ?, paid_amount = ? WHERE id = ?')
    .bind(Date.now(), 30000, joined.participantId).run();
  const confirmed = await api('POST', `${path}/participants/${joined.participantId}/confirm`, {
    body: { confirmed: true }, token: created.adminToken,
  });
  assert.equal(confirmed.status, 200);
  const maya = confirmed.data.participants.find((p) => p.id === joined.participantId);
  assert.equal(maya.paidAmount, 30000);
  assert.ok(maya.confirmedAt);
});

test('validation rejects bad input with friendly messages', async () => {
  const noItems = await api('POST', '/api/splits', { body: newSplit({ items: [] }) });
  assert.equal(noItems.status, 400);
  assert.match(noItems.data.error, /at least one item/);
  const badUpi = await api('POST', '/api/splits', { body: newSplit({ pay: { method: 'upi', handle: 'not a upi' } }) });
  assert.equal(badUpi.status, 400);
  const upiUsd = await api('POST', '/api/splits', {
    body: newSplit({ currency: 'USD', pay: { method: 'upi', handle: 'a@okaxis' } }),
  });
  assert.equal(upiUsd.status, 400);
  const missing = await api('GET', '/api/splits/doesnotexist');
  assert.equal(missing.status, 404);
});

test('split pages get rich link previews', async () => {
  const created = await api('POST', '/api/splits', { body: newSplit() });
  const res = await fetch(`${base}/s/${created.data.id}`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /<meta property="og:title" content="Asha paid ₹1,302 at The Copper Kettle">/);
});

test('AI receipt reading reports itself disabled without a key', async () => {
  const cfg = await api('GET', '/api/config');
  assert.equal(cfg.data.aiParse, false);
  const res = await api('POST', '/api/parse', { body: { mediaType: 'image/png', data: 'AAAA' } });
  assert.equal(res.status, 501);
});
