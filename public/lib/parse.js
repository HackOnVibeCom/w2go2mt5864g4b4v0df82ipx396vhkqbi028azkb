// Turn receipt text (OCR output, a pasted bill, or quick typing like "Pizza 450")
// into items and extras. Amounts are returned in major units (e.g. 12.5).
import { parseAmount } from './money.js';

const SKIP_RE =
  /\b(sub\s*-?\s*total|subtotal|net\s*amount|item\s*total|items?\s*count|total\s*(qty|items?)|qty|quantity|cash|change|card|visa|mastercard|master|amex|upi|paid|tender(ed)?|balance|payment|bill\s*no|invoice|inv\s*no|table|cover|covers|guest|server|steward|cashier|date|time|thank|gstin|fssai|phone|tel|order\s*no|receipt\s*no|token|kot|pax|hsn)\b/i;
const TOTAL_RE = /\b(grand\s*total|total\s*due|amount\s*due|net\s*payable|to\s*pay|bill\s*amount|payable|total)\b/i;
const GRAND_RE = /\b(grand\s*total|total\s*due|amount\s*due|net\s*payable|to\s*pay|payable)\b/i;
const EXTRA_RE =
  /\b(c\s*gst|s\s*gst|i\s*gst|gst|vat|tax(es)?|service|svc|tip|gratuity|discount|disc|surcharge|cess|delivery|packing|packaging|round(ing)?\s*off|round(ing)?|charges?|fee)\b/i;
const DISCOUNT_RE = /\b(discount|disc|off|promo|coupon|voucher)\b/i;

const NUM_TOKEN = /^[(\-−]?(?:rs\.?|inr|usd|eur|gbp|aed|sgd|[₹$€£¥₩₦₱₺₫฿])?[(\-−]?\d[\d.,]*\)?[-−]?$/i;
const PRICE_TOKEN = /^[(\-−]?(?:rs\.?|inr|usd|eur|gbp|aed|sgd|[₹$€£¥₩₦₱₺₫฿])?[(\-−]?\d[\d,]*(?:[.,]\d{1,3})?\)?[-−]?$/i;

export function parseReceipt(text, { digits = 2 } = {}) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_]{2,}/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items = [];
  const extras = [];
  let title = '';
  let total = 0;
  let subtotal = 0;
  let sawGrand = false;
  let totalAt = -1;
  let lastExtraAt = -1;
  let unread = 0; // total/tax lines whose amount OCR lost; a sign another reading may do better
  const paid = []; // amounts on payment lines ("Cash 1,198.40"), a fallback for an unreadable total

  lines.forEach((line, index) => {
    if (PAID_RE.test(line)) {
      for (const t of line.split(' ')) if (PRICE_TOKEN.test(t)) paid.push(Math.abs(parseAmount(t, digits)));
    }
    const parsed = splitLine(line, digits);
    if (!parsed) {
      const fixed = repairPercentLine(line, [subtotal, sum(items), total, subtotal + sum(extras)]);
      if (fixed) {
        extras.push(fixed);
        lastExtraAt = index;
        return;
      }
      // A total or tax line with no readable amount, or any line with a percentage (tax and
      // service lines carry one), means OCR probably mangled part of the bill.
      if (!SKIP_RE.test(line) && ((/\p{L}{2,}/u.test(line) && (TOTAL_RE.test(line) || EXTRA_RE.test(line))) || /\d\s?%/.test(line))) unread++;
      if (!title && index < 4 && /[a-z]{3,}/i.test(line) && !SKIP_RE.test(line) && !TOTAL_RE.test(line)) {
        title = cleanName(line).slice(0, 60);
        if (title === title.toUpperCase()) {
          title = title.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
        }
      }
      return;
    }
    const { name, amount, qty } = parsed;
    if (/\bsub\s*-?\s*total\b/i.test(name)) {
      if (!subtotal) subtotal = Math.abs(amount);
      return;
    }
    if (TOTAL_RE.test(name) && !EXTRA_RE.test(name)) {
      if (GRAND_RE.test(name) || !sawGrand) {
        total = Math.abs(amount);
        totalAt = index;
      }
      if (GRAND_RE.test(name)) sawGrand = true;
      return;
    }
    if (EXTRA_RE.test(name) || DISCOUNT_RE.test(name)) {
      let value = amount;
      if (DISCOUNT_RE.test(name) && value > 0) value = -value;
      if (value === 0) return;
      extras.push({ label: extraLabel(name), amount: value });
      lastExtraAt = index;
      return;
    }
    if (SKIP_RE.test(name)) return;
    if (!/\p{L}/u.test(name) || amount <= 0) return;
    // Below the totals only footer and payment lines remain; OCR noise there ("FI 0700")
    // shouldn't become an item unless it at least has a real word in it.
    if ((subtotal || totalAt >= 0) && !/\p{L}{3}/u.test(name)) return;
    items.push({ name: cleanName(name), qty, amount });
  });

  // A plain "Total" printed above the tax lines is the pre-tax amount, not what was paid.
  // Without a grand total we'd rather show no total than compare against the wrong one.
  if (!sawGrand && total && lastExtraAt > totalAt) {
    if (!subtotal) subtotal = total;
    total = 0;
  }
  // No readable total, but the customer paid exactly what the lines add up to: that's the total.
  if (!total && items.length) {
    const lineSum = Math.round((sum(items) + sum(extras)) * 100) / 100;
    if (paid.some((p) => Math.abs(p - lineSum) < 0.005)) total = lineSum;
  }

  return { title, items, extras, total, subtotal, grand: sawGrand, unread, currency: guessCurrency(lines) };
}

const PAID_RE = /\b(cash|card|visa|master\s?card|amex|upi|paid|tender(ed)?|payment|amount\s*received)\b/i;

// "VAT 7% [8.40": OCR garbled the amount of a percentage line. Tax and service are worked out
// from the subtotal, so if the digits we can still read fit that calculation, use it.
function repairPercentLine(line, bases) {
  if (!EXTRA_RE.test(line) || DISCOUNT_RE.test(line)) return null;
  const pm = line.match(/(\d{1,2}(?:[.,]\d{1,3})?)\s?%/);
  if (!pm) return null;
  const seen = line.slice(pm.index + pm[0].length).replace(/\D/g, '');
  if (seen.length < 2) return null;
  const pct = Number(pm[1].replace(',', '.'));
  for (const base of bases) {
    if (!(base > 0)) continue;
    const amount = Math.round(base * pct) / 100;
    if (amount > 0 && amount.toFixed(2).replace('.', '').includes(seen)) {
      return { label: extraLabel(line.slice(0, pm.index + pm[0].length)), amount };
    }
  }
  return null;
}

const sum = (list) => list.reduce((s, x) => s + x.amount, 0);

// Do the lines add up to the printed total (within one unit of round-off, like the editor's check)?
export function addsUp(r) {
  return Boolean(r && r.items.length && r.total > 0 && Math.abs(sum(r.items) + sum(r.extras) - r.total) <= 1);
}

// How much to trust one OCR reading of a receipt.
export function readingScore(r) {
  let s = r.items.length * 10 + r.extras.length * 5;
  if (addsUp(r)) s += 1000;
  if (r.subtotal && Math.abs(sum(r.items) - r.subtotal) <= 0.05) s += 300; // items match the printed subtotal
  if (r.grand) s += 50;
  return s - (r.unread || 0) * 20;
}

// Combine several OCR readings of the same photo: keep the most trustworthy one, and borrow a
// grand total or tax lines another reading caught, but only if that makes the bill add up.
export function mergeReadings(readings) {
  const ranked = readings.map((r, i) => ({ r, i })).sort((a, b) => readingScore(b.r) - readingScore(a.r) || a.i - b.i);
  const best = ranked[0].r;
  if (addsUp(best)) return best;
  const key = (e) => e.label.toLowerCase().replace(/[^a-z0-9%]/g, '');
  const merged = { ...best, extras: best.extras.slice() };
  const seen = new Set(merged.extras.map(key));
  for (const { r } of ranked.slice(1)) {
    for (const e of r.extras) {
      if (!seen.has(key(e))) {
        seen.add(key(e));
        merged.extras.push(e);
      }
    }
    if (!merged.grand && r.grand) {
      merged.total = r.total;
      merged.grand = true;
    }
  }
  return addsUp(merged) ? merged : best;
}

// Currency from symbols, codes, tax names or a well-known city on the receipt. '' when unsure;
// a bare "$" is left alone because too many countries use it.
const CURRENCY_HINTS = [
  ['INR', /₹|\brs\.?\s?\d|\binr\b|\bgstin\b|\b[cs]\s?gst\b/i],
  ['THB', /฿|\bthb\b|\bbaht\b|\bbangkok\b|\bthailand\b|\bphuket\b|\bpattaya\b|\bsukhumvit\b|\bchiang\s?mai\b/i],
  ['AED', /\baed\b|\bdirhams?\b|\bdubai\b|\babu\s?dhabi\b|\bsharjah\b/i],
  ['SGD', /\bs\$|\bsgd\b|\bsingapore\b/i],
  ['MYR', /\bmyr\b|\bkuala\s?lumpur\b|\brm\s?\d/i],
  ['IDR', /\bidr\b|\brp\.?\s?\d|\bjakarta\b/i],
  ['PHP', /₱|\bphp\s?\d|\bmanila\b/i],
  ['GBP', /£|\bgbp\b/i],
  ['EUR', /€|\beur\b/i],
  ['KRW', /₩|\bkrw\b|\bseoul\b/i],
  ['VND', /₫|\bvnd\b|\bhanoi\b|\bho\s?chi\s?minh\b/i],
  ['NGN', /₦|\bngn\b|\blagos\b/i],
  ['TRY', /₺|\bistanbul\b/i],
];

function guessCurrency(lines) {
  const text = lines.join('\n');
  for (const [code, re] of CURRENCY_HINTS) if (re.test(text)) return code;
  return '';
}

// Words that belong in front of a tax or fee keyword ("Sales Tax", "Late night surcharge").
// Anything else there is dropped: on bilingual receipts it is OCR noise from the other script,
// e.g. Thai "ภาษีมูลค่าเพิ่ม VAT 7%" reads as "MIyaaAN VAT 7%".
const QUALIFIERS = new Set(
  ('sales service services goods and value added state city county local govt government central federal ' +
    'municipal tourism tourist hotel room luxury entertainment liquor alcohol food beverage bar late night ' +
    'weekend holiday delivery packing packaging container bag credit debit card convenience platform small ' +
    'order cover auto suggested optional staff kitchen swachh bharat krishi kalyan')
    .split(' '),
);
const keepInLabel = (t) => QUALIFIERS.has(t.toLowerCase()) || /\d/.test(t) || /^[&+/-]$/.test(t);

function extraLabel(name) {
  const clean = cleanName(name) || 'Extra';
  const hits = [EXTRA_RE.exec(clean), DISCOUNT_RE.exec(clean)].filter(Boolean).map((m) => m.index);
  if (!hits.length) return clean;
  const at = Math.min(...hits);
  if (at === 0 || clean.slice(0, at).trim().split(' ').every(keepInLabel)) return clean;
  const rest = clean.slice(at);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

// "2 x Butter Naan 240.00" → { name: "Butter Naan", qty: 2, amount: 240 }
function splitLine(line, digits) {
  const toks = line.split(' ');
  // Drop trailing tax-code letters printed after prices ("12.99 A", "4.50 *").
  while (toks.length > 2 && /^[A-Z*#]$/i.test(toks[toks.length - 1]) && NUM_TOKEN.test(toks[toks.length - 2])) {
    toks.pop();
  }
  const last = toks[toks.length - 1];
  if (toks.length < 2 || !PRICE_TOKEN.test(last)) return null;
  if (/^\D*0\d/.test(last)) return null; // prices don't start "07…": a misread, a code or a date
  const amount = parseAmount(last, digits);
  if (!Number.isFinite(amount)) return null;
  toks.pop();

  // Numbers sitting between the name and the price: qty and/or unit price.
  const middle = [];
  while (toks.length > 1 && (NUM_TOKEN.test(toks[toks.length - 1]) || /^[@il|!]$/.test(toks[toks.length - 1]))) {
    const t = toks.pop();
    if (t !== '@') middle.unshift(/^[il|!]$/.test(t) ? '1' : t); // OCR reads a quantity of 1 as "i", "l" or "|"
  }

  let qty = 1;
  const nums = middle.map((t) => ({ raw: t, n: parseAmount(t, digits) }));
  const qtyCandidate = nums.find((x) => /^\d{1,2}$/.test(x.raw) && x.n >= 1 && x.n <= 99);
  if (qtyCandidate) {
    const other = nums.find((x) => x !== qtyCandidate);
    const productMatches = other && Math.abs(other.n * qtyCandidate.n - amount) <= 0.011 * Math.max(1, amount);
    // A lone small number is a quantity ("Naan 2 240"); "Chicken 65 380" is a dish name.
    if (productMatches || (!other && qtyCandidate.n <= 20)) {
      qty = qtyCandidate.n;
    } else {
      toks.push(...middle); // give the numbers back to the name
    }
  } else if (middle.length) {
    toks.push(...middle.filter((t) => !/[.,]\d{1,3}$/.test(t)));
  }

  // Leading quantity: "2 x Naan", "2x Naan", "2 Naan".
  const lead = toks[0] && toks[0].match(/^(\d{1,2})\s*[xX×*]?$/);
  if (lead && toks.length > 1) {
    qty = Number(lead[1]) || 1;
    toks.shift();
    if (/^[xX×*]$/.test(toks[0] || '')) toks.shift();
  }
  // Trailing "x2" / "×2" inside the name.
  const tail = toks[toks.length - 1] && toks[toks.length - 1].match(/^[xX×*](\d{1,2})$/);
  if (tail && toks.length > 1) {
    qty = Number(tail[1]) || qty;
    toks.pop();
  }

  const name = toks.join(' ');
  if (!name) return null;
  return { name, amount, qty: Math.max(1, Math.min(99, qty)) };
}

function cleanName(s) {
  return String(s)
    .replace(/^[\d]{1,3}[.)]\s+/, '') // "1. Pizza" / "01) Pizza"
    .replace(/[.·•:]{2,}/g, ' ')
    .replace(/(^|\s)[|¦!]+(?=\s|$)/g, ' ') // stray bars: a column rule or a misread "1"
    .replace(/[\s:;!|¦,\-–]+$/g, '') // OCR often hangs ":" "!" ";" off a cut-off name
    .replace(/^[\s:;!|¦,.\-–]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export const SAMPLE_RECEIPT = `THE COPPER KETTLE
Indiranagar, Bengaluru
Table 7   Covers 4
Paneer Tikka            340.00
Chicken 65              380.00
2 x Butter Naan         120.00
Dal Makhani             290.00
Garlic Bread            180.00
Beer 3 @ 300.00         900.00
Fresh Lime Soda         140.00
Sub Total              2350.00
Service Charge 5%       117.50
CGST 2.5%                58.75
SGST 2.5%                58.75
Round Off                 -0.00
Grand Total            2585.00
Thank you! Visit again`;
