// Cloudflare Workers entry: static files from /public, JSON API on /api/*, D1 for storage.
import { handleApi } from './api.js';
import { renderSplitShell } from './shell.js';

const SPLIT_PATH = /^\/s\/([A-Za-z0-9]{6,32})\/?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, { ip: request.headers.get('cf-connecting-ip') || '' });
    }

    const split = url.pathname.match(SPLIT_PATH);
    if (split || url.pathname === '/growth' || url.pathname === '/new') {
      const shell = await env.ASSETS.fetch(new Request(new URL('/', url)));
      let html = await shell.text();
      if (split) html = await renderSplitShell(html, env.DB, split[1], url.origin);
      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
