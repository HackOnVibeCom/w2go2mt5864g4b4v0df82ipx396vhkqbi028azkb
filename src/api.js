// Tapsplit JSON API. Platform-neutral: takes a Web Request and an `env` with a
// D1-compatible `DB`, returns a Web Response. Runs on Cloudflare Workers and Node.
import { computeSplit } from '../public/lib/split.js';
import { isSupportedCurrency } from '../public/lib/money.js';
import { PAY_METHODS, cleanPayHandle } from '../public/lib/pay.js';
import { parseReceiptImage } from './ai.js';
import { HttpError } from './errors.js';

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ITEMS = 150;
const MAX_EXTRAS = 20;
const MAX_PEOPLE = 60;
const MAX_AMOUNT = 10_000_000_000; // minor units
const EVENT_TYPES = new Set(['view', 'share', 'cta']);

export async function handleApi(request, env, { ip = '', now = Date.now() } = {}) {
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
  try {
    const res = await route(request, env, { ip, now });
    return withCors(res);
  } catch (err) {
    if (err instanceof HttpError) return withCors(json({ error: err.message }, err.status));
    console.error('api error', err);
    return withCors(json({ error: 'Something went wrong on our side. Please try again.' }, 500));
  }
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(2); // drop "", "api"
  const method = request.method;
  const db = env.DB;
  if (!db) throw new HttpError(503, 'Database is not configured.');

  if (parts[0] === 'health' && method === 'GET') return json({ ok: true });
  if (parts[0] === 'config' && method === 'GET') return json({ aiParse: Boolean(env.ANTHROPIC_API_KEY) });
  if (parts[0] === 'growth' && method === 'GET') return json(await growth(db, ctx.now), 200, 'max-age=15');
  if (parts[0] === 'events' && method === 'POST') return logEvent(request, db, ctx);
  if (parts[0] === 'parse' && method === 'POST') {
    limit(ctx.ip, 'parse', 20);
    return json(await parseReceiptImage(await readJson(request, 8_000_000), env));
  }

  if (parts[0] === 'splits') {
    if (parts.length === 1 && method === 'POST') {
      limit(ctx.ip, 'write', 60);
      return createSplit(request, db, ctx);
    }
    const id = parts[1];
    if (!isId(id)) throw new HttpError(404, 'This split does not exist.');
    if (parts.length === 2 && method === 'GET') return getSplit(db, id, url.searchParams.get('rev'));
    if (parts[2] === 'participants') {
      limit(ctx.ip, 'write', 120);
      if (parts.length === 3 && method === 'POST') return join(request, db, id, ctx);
      const pid = parts[3];
      if (!isId(pid)) throw new HttpError(404, 'Unknown person.');
      if (parts[4] === 'claims' && method === 'PUT') return updateClaims(request, db, id, pid, ctx);
      if (parts[4] === 'paid' && method === 'POST') return markPaid(request, db, id, pid, ctx);
      if (parts[4] === 'confirm' && method === 'POST') return confirmPaid(request, db, id, pid, ctx);
    }
  }
  throw new HttpError(404, 'Not found.');
}

// ---------- splits ----------

async function createSplit(request, db, { now }) {
  const body = await readJson(request);
  const input = validateSplit(body);
  const id = randomId(8);
  const adminToken = randomId(24);
  const payerId = randomId(10);
  const payerToken = randomId(24);
  const vid = visitorId(request);
  let parentId = null;
  if (isId(body.ref)) {
    const parent = await db.prepare('SELECT id FROM splits WHERE id = ?').bind(body.ref).first();
    parentId = parent ? parent.id : null;
  }
  const payerClaims = validateClaims(body.payerClaims ?? {}, input.items);

  await db.batch([
    db
      .prepare(
        `INSERT INTO splits (id, admin_token, title, payer_name, currency, items, extras,
           pay_method, pay_handle, parent_id, creator_vid, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        adminToken,
        input.title,
        input.payerName,
        input.currency,
        JSON.stringify(input.items),
        JSON.stringify(input.extras),
        input.pay.method,
        input.pay.handle,
        parentId,
        vid,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO participants (id, split_id, name, token, claims, is_payer, vid, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(payerId, id, input.payerName, payerToken, JSON.stringify(payerClaims), vid, now, now),
  ]);

  return json({ id, adminToken, participantId: payerId, participantToken: payerToken }, 201);
}

async function loadSplit(db, id) {
  const row = await db.prepare('SELECT * FROM splits WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'This split does not exist (or the link is incomplete).');
  return {
    ...row,
    items: JSON.parse(row.items),
    extras: JSON.parse(row.extras),
  };
}

async function loadParticipants(db, id) {
  const { results } = await db
    .prepare('SELECT * FROM participants WHERE split_id = ? ORDER BY is_payer DESC, created_at ASC')
    .bind(id)
    .all();
  return results.map((p) => ({ ...p, claims: JSON.parse(p.claims) }));
}

async function getSplit(db, id, rev) {
  const split = await loadSplit(db, id);
  if (rev && rev === String(split.updated_at)) return new Response(null, { status: 204 });
  const participants = await loadParticipants(db, id);
  return json(publicView(split, participants));
}

export function publicView(split, participants) {
  const computed = computeSplit(split, participants);
  return {
    id: split.id,
    title: split.title,
    payerName: split.payer_name,
    currency: split.currency,
    items: split.items,
    extras: split.extras,
    pay: { method: split.pay_method, handle: split.pay_handle },
    createdAt: split.created_at,
    rev: String(split.updated_at),
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      isPayer: Boolean(p.is_payer),
      claims: p.claims,
      paidAt: p.paid_at,
      confirmedAt: p.confirmed_at,
      ...computed.participants[p.id],
    })),
    lines: computed.items,
    totals: {
      subtotal: computed.subtotal,
      extras: computed.extrasTotal,
      grandTotal: computed.grandTotal,
      unclaimed: computed.unclaimed,
    },
  };
}

// ---------- participants ----------

async function join(request, db, id, { now }) {
  const body = await readJson(request);
  const name = cleanText(body.name, 40);
  if (!name) throw new HttpError(400, 'Tell us your name so the payer knows who tapped what.');
  await loadSplit(db, id);
  const people = await loadParticipants(db, id);
  if (people.length >= MAX_PEOPLE) throw new HttpError(409, 'This split is full.');
  if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, `Someone called "${name}" already joined. Add an initial, like "${name} K".`);
  }
  const pid = randomId(10);
  const token = randomId(24);
  await db.batch([
    db
      .prepare(
        `INSERT INTO participants (id, split_id, name, token, claims, is_payer, vid, created_at, updated_at)
         VALUES (?, ?, ?, ?, '{}', 0, ?, ?, ?)`,
      )
      .bind(pid, id, name, token, visitorId(request), now, now),
    touch(db, id, now),
  ]);
  return json({ participantId: pid, participantToken: token }, 201);
}

async function authorize(request, db, splitId, pid) {
  const split = await loadSplit(db, splitId);
  const person = await db
    .prepare('SELECT * FROM participants WHERE id = ? AND split_id = ?')
    .bind(pid, splitId)
    .first();
  if (!person) throw new HttpError(404, 'Unknown person.');
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const isAdmin = safeEqual(token, split.admin_token);
  const isSelf = safeEqual(token, person.token);
  return { split, person, isAdmin, isSelf };
}

async function updateClaims(request, db, splitId, pid, { now }) {
  const { split, isAdmin, isSelf } = await authorize(request, db, splitId, pid);
  if (!isAdmin && !isSelf) throw new HttpError(403, 'You can only change your own items.');
  const body = await readJson(request);
  const claims = validateClaims(body.claims, split.items);
  await db.batch([
    db
      .prepare('UPDATE participants SET claims = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(claims), now, pid),
    touch(db, splitId, now),
  ]);
  return getSplit(db, splitId);
}

async function markPaid(request, db, splitId, pid, { now }) {
  const { isAdmin, isSelf, person } = await authorize(request, db, splitId, pid);
  if (!isAdmin && !isSelf) throw new HttpError(403, 'You can only mark your own payment.');
  if (person.is_payer) throw new HttpError(400, 'The payer does not owe themselves.');
  const body = await readJson(request);
  const paid = Boolean(body.paid);
  let amount = null;
  if (paid) {
    const split = await loadSplit(db, splitId);
    const people = await loadParticipants(db, splitId);
    amount = computeSplit(split, people).participants[pid].total;
  }
  await db.batch([
    db
      .prepare('UPDATE participants SET paid_at = ?, paid_amount = ?, confirmed_at = CASE WHEN ? THEN confirmed_at ELSE NULL END, updated_at = ? WHERE id = ?')
      .bind(paid ? now : null, amount, paid ? 1 : 0, now, pid),
    touch(db, splitId, now),
  ]);
  return getSplit(db, splitId);
}

async function confirmPaid(request, db, splitId, pid, { now }) {
  const { isAdmin, person } = await authorize(request, db, splitId, pid);
  if (!isAdmin) throw new HttpError(403, 'Only the payer can confirm money arrived.');
  if (person.is_payer) throw new HttpError(400, 'The payer does not owe themselves.');
  const body = await readJson(request);
  const confirmed = Boolean(body.confirmed);
  let amount = person.paid_amount;
  if (confirmed && amount == null) {
    const split = await loadSplit(db, splitId);
    amount = computeSplit(split, await loadParticipants(db, splitId)).participants[pid].total;
  }
  await db.batch([
    db
      .prepare(
        'UPDATE participants SET confirmed_at = ?, paid_at = COALESCE(paid_at, ?), paid_amount = ?, updated_at = ? WHERE id = ?',
      )
      .bind(confirmed ? now : null, confirmed ? now : null, amount, now, pid),
    touch(db, splitId, now),
  ]);
  return getSplit(db, splitId);
}

function touch(db, splitId, now) {
  return db.prepare('UPDATE splits SET updated_at = MAX(updated_at + 1, ?) WHERE id = ?').bind(now, splitId);
}

// ---------- growth loop analytics ----------

async function logEvent(request, db, { ip, now }) {
  limit(ip, 'event', 240);
  const body = await readJson(request);
  if (!EVENT_TYPES.has(body.type)) throw new HttpError(400, 'Unknown event.');
  const splitId = isId(body.splitId) ? body.splitId : null;
  const detail = cleanText(body.detail, 24) || null;
  await db
    .prepare('INSERT INTO events (type, split_id, vid, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(body.type, splitId, visitorId(request), detail, now)
    .run();
  return json({ ok: true }, 202);
}

export async function growth(db, now = Date.now()) {
  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;

  const splits = await one(
    'SELECT COUNT(*) AS n, COALESCE(SUM(parent_id IS NOT NULL), 0) AS referred FROM splits',
  );
  const people = await one(
    `SELECT COUNT(*) AS joined,
            COALESCE(SUM(paid_at IS NOT NULL), 0) AS paid,
            COALESCE(SUM(confirmed_at IS NOT NULL), 0) AS confirmed
       FROM participants WHERE is_payer = 0`,
  );
  // People reached: distinct visitors who opened a split someone else created.
  const reach = await one(
    `SELECT COUNT(DISTINCT e.vid) AS visitors, COUNT(DISTINCT e.split_id || ':' || e.vid) AS pairs
       FROM events e JOIN splits s ON s.id = e.split_id
      WHERE e.type = 'view' AND e.vid IS NOT NULL AND s.creator_vid IS NOT e.vid`,
  );
  // Of those, how many went on to create a split of their own.
  const converted = await one(
    `SELECT COUNT(DISTINCT s2.creator_vid) AS n FROM splits s2
      WHERE s2.creator_vid IS NOT NULL AND EXISTS (
        SELECT 1 FROM events e JOIN splits s ON s.id = e.split_id
         WHERE e.type = 'view' AND e.vid = s2.creator_vid
           AND s.creator_vid IS NOT s2.creator_vid AND e.created_at <= s2.created_at)`,
  );
  const depth = await one(
    `WITH RECURSIVE chain(id, depth) AS (
       SELECT id, 1 FROM splits WHERE parent_id IS NULL
       UNION ALL
       SELECT s.id, c.depth + 1 FROM splits s JOIN chain c ON s.parent_id = c.id)
     SELECT COALESCE(MAX(depth), 0) AS d FROM chain`,
  );
  const shares = await all(
    "SELECT COALESCE(detail, 'other') AS channel, COUNT(*) AS n FROM events WHERE type = 'share' GROUP BY channel ORDER BY n DESC",
  );
  const ctas = await one("SELECT COUNT(*) AS n FROM events WHERE type = 'cta'");
  const settled = await all(
    `SELECT s.currency AS currency, SUM(p.paid_amount) AS amount, COUNT(*) AS n
       FROM participants p JOIN splits s ON s.id = p.split_id
      WHERE p.is_payer = 0 AND p.paid_at IS NOT NULL AND p.paid_amount IS NOT NULL
      GROUP BY s.currency ORDER BY n DESC`,
  );
  const since = now - 13 * 86_400_000;
  const daily = await all(
    `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS splits
       FROM splits WHERE created_at >= ? GROUP BY day ORDER BY day`,
    since,
  );
  const dailyJoins = await all(
    `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS joins
       FROM participants WHERE is_payer = 0 AND created_at >= ? GROUP BY day ORDER BY day`,
    since,
  );

  const n = Number(splits.n);
  const reached = Number(reach.visitors);
  const invitesPerSplit = n ? Number(reach.pairs) / n : 0;
  const conversion = reached ? Number(converted.n) / reached : 0;
  const joinedByDay = Object.fromEntries(dailyJoins.map((d) => [d.day, Number(d.joins)]));
  const days = [];
  for (let t = since; t <= now; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const s = daily.find((d) => d.day === day);
    days.push({ day, splits: s ? Number(s.splits) : 0, joins: joinedByDay[day] || 0 });
  }

  return {
    splits: n,
    referredSplits: Number(splits.referred),
    peopleReached: reached,
    joined: Number(people.joined),
    paid: Number(people.paid),
    confirmed: Number(people.confirmed),
    becameCreators: Number(converted.n),
    invitesPerSplit,
    conversion,
    kFactor: invitesPerSplit * conversion,
    longestChain: Number(depth.d),
    shareClicks: shares.map((s) => ({ channel: s.channel, n: Number(s.n) })),
    ctaClicks: Number(ctas.n),
    settled: settled.map((s) => ({ currency: s.currency, amount: Number(s.amount), n: Number(s.n) })),
    days,
  };
}

// ---------- validation ----------

export function validateSplit(body) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Missing split details.');
  const title = cleanText(body.title, 80) || 'Shared bill';
  const payerName = cleanText(body.payerName, 40);
  if (!payerName) throw new HttpError(400, 'Add your name so friends know who to pay.');
  const currency = String(body.currency || '').toUpperCase();
  if (!isSupportedCurrency(currency)) throw new HttpError(400, 'Pick a valid currency.');

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Add at least one item from the bill.');
  }
  if (body.items.length > MAX_ITEMS) throw new HttpError(400, `Up to ${MAX_ITEMS} items per bill.`);
  const items = body.items.map((it, i) => {
    const name = cleanText(it?.name, 80);
    const price = Number(it?.price);
    const qty = it?.qty == null ? 1 : Number(it.qty);
    if (!name) throw new HttpError(400, `Item ${i + 1} needs a name.`);
    if (!Number.isInteger(price) || price < 0 || price > MAX_AMOUNT) {
      throw new HttpError(400, `"${name}" needs a valid price.`);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new HttpError(400, `"${name}" needs a quantity between 1 and 99.`);
    }
    return { id: `i${i + 1}`, name, price, qty };
  });

  const rawExtras = Array.isArray(body.extras) ? body.extras : [];
  if (rawExtras.length > MAX_EXTRAS) throw new HttpError(400, `Up to ${MAX_EXTRAS} tax/tip lines.`);
  const extras = rawExtras
    .map((e) => ({ label: cleanText(e?.label, 40) || 'Extra', amount: Number(e?.amount) }))
    .filter((e) => e.amount !== 0);
  for (const e of extras) {
    if (!Number.isInteger(e.amount) || Math.abs(e.amount) > MAX_AMOUNT) {
      throw new HttpError(400, `"${e.label}" needs a valid amount.`);
    }
  }
  const total = items.reduce((a, it) => a + it.price, 0) + extras.reduce((a, e) => a + e.amount, 0);
  if (total <= 0) throw new HttpError(400, 'The bill total must be more than zero.');

  const method = body.pay?.method && body.pay.method in PAY_METHODS ? body.pay.method : 'none';
  const handle = cleanPayHandle(method, body.pay?.handle);
  if (handle === null) {
    throw new HttpError(400, `That ${PAY_METHODS[method].label} handle doesn't look right.`);
  }
  if (method === 'upi' && currency !== 'INR') throw new HttpError(400, 'UPI only works with INR.');

  return { title, payerName, currency, items, extras, pay: { method, handle } };
}

export function validateClaims(raw, items) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'Bad claims.');
  const byId = new Map(items.map((it) => [it.id, it]));
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const item = byId.get(key);
    if (!item) throw new HttpError(400, 'That item is not on this bill.');
    const shares = Number(value);
    if (!Number.isInteger(shares) || shares < 0) throw new HttpError(400, 'Bad claim count.');
    if (shares > item.qty) throw new HttpError(400, `There are only ${item.qty} × ${item.name}.`);
    if (shares > 0) out[key] = shares;
  }
  return out;
}

// ---------- helpers ----------

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isId(v) {
  return typeof v === 'string' && /^[A-Za-z0-9]{6,32}$/.test(v);
}

function visitorId(request) {
  const v = request.headers.get('x-visitor') || '';
  return /^[A-Za-z0-9_-]{8,40}$/.test(v) ? v : null;
}

export function randomId(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readJson(request, maxBytes = 64_000) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'That request is too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'That request is too large.');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

const buckets = new Map();
function limit(ip, kind, perMinute) {
  if (!ip) return;
  const key = `${kind}:${ip}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + 60_000 };
    buckets.set(key, b);
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
  }
  b.count += 1;
  if (b.count > perMinute) throw new HttpError(429, 'Slow down a little and try again in a minute.');
}

function json(data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });
}

function withCors(res) {
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type, authorization, x-visitor');
  headers.set('access-control-max-age', '86400');
  return new Response(res.body, { status: res.status, headers });
}
