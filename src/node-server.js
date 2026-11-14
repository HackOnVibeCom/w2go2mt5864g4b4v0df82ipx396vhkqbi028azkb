// Node entry: local dev, tests and self-hosting (any box with Node >= 22.13).
// Same API code as the Cloudflare Worker, backed by Node's built-in SQLite.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { openSqliteD1 } from './d1-sqlite.js';
import { renderSplitShell } from './shell.js';

const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};
const SPLIT_PATH = /^\/s\/([A-Za-z0-9]{6,32})\/?$/;

export function createNodeHandler({ dbPath = ':memory:', env = {} } = {}) {
  const db = openSqliteD1(dbPath);
  const fullEnv = { ...env, DB: db };

  async function handler(req, res) {
    try {
      const origin = `http://${req.headers.host || 'localhost'}`;
      const url = new URL(req.url, origin);

      if (url.pathname.startsWith('/api/')) {
        const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await readBody(req);
        const request = new Request(url, { method: req.method, headers: toHeaders(req.headers), body });
        const ip = req.socket.remoteAddress || '';
        const response = await handleApi(request, fullEnv, { ip });
        return send(res, response.status, Object.fromEntries(response.headers), Buffer.from(await response.arrayBuffer()));
      }

      const split = url.pathname.match(SPLIT_PATH);
      if (split || url.pathname === '/growth' || url.pathname === '/new') {
        let html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
        if (split) html = await renderSplitShell(html, db, split[1], origin);
        return send(res, 200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }, html);
      }

      return serveStatic(url.pathname, res);
    } catch (err) {
      console.error(err);
      return send(res, 500, { 'content-type': 'text/plain' }, 'Server error');
    }
  }

  return { handler, db, close: () => db.close() };
}

async function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) return send(res, 403, {}, 'Forbidden');
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, { 'content-type': type, 'cache-control': 'no-cache' }, await readFile(file));
  } catch {
    return send(res, 404, { 'content-type': 'text/plain' }, 'Not found');
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function toHeaders(raw) {
  const h = new Headers();
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }
  return h;
}

function readBody(req, limit = 10_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  const { handler } = createNodeHandler({
    dbPath: process.env.DB_PATH || './data/tapsplit.db',
    env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
  });
  http.createServer(handler).listen(port, () => {
    console.log(`Tapsplit running on http://localhost:${port}`);
  });
}
