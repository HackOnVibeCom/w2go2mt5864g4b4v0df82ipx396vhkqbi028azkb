// Server-side touches to the single HTML shell: rich link previews for split pages,
// so a link dropped in WhatsApp/Telegram reads "Asha paid ₹2,585 at The Copper Kettle".
import { formatMoney } from '../public/lib/money.js';

const OG_BLOCK = /<!--OG-->[\s\S]*?<!--\/OG-->/;

export async function renderSplitShell(html, db, id, origin) {
  let row = null;
  try {
    row = await db
      .prepare('SELECT id, title, payer_name, currency, items, extras FROM splits WHERE id = ?')
      .bind(id)
      .first();
  } catch {
    row = null;
  }
  if (!row) return html;
  const items = JSON.parse(row.items);
  const extras = JSON.parse(row.extras);
  const total =
    items.reduce((a, it) => a + it.price, 0) + extras.reduce((a, e) => a + e.amount, 0);
  const title = `${row.payer_name} paid ${formatMoney(total, row.currency, 'en')} at ${row.title}`;
  const description = 'Tap what you had. Tapsplit works out your exact share, tax and tip included. No app, no sign-up.';
  const url = `${origin}/s/${row.id}`;
  const tags = [
    `<title>${esc(title)} · Tapsplit</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Tapsplit">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(origin)}/og.png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n    ');
  return html.replace(OG_BLOCK, `<!--OG-->\n    ${tags}\n    <!--/OG-->`);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
