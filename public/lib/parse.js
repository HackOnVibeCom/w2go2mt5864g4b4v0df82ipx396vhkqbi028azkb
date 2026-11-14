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
  let sawGrand = false;

  lines.forEach((line, index) => {
    const parsed = splitLine(line, digits);
    if (!parsed) {
      if (!title && index < 4 && /[a-z]{3,}/i.test(line) && !SKIP_RE.test(line) && !TOTAL_RE.test(line)) {
        title = cleanName(line).slice(0, 60);
      }
      return;
    }
    const { name, amount, qty } = parsed;
    if (/\bsub\s*-?\s*total\b/i.test(name)) return;
    if (TOTAL_RE.test(name) && !EXTRA_RE.test(name)) {
      if (GRAND_RE.test(name) || !sawGrand) total = Math.abs(amount);
      if (GRAND_RE.test(name)) sawGrand = true;
      return;
    }
    if (EXTRA_RE.test(name) || DISCOUNT_RE.test(name)) {
      let value = amount;
      if (DISCOUNT_RE.test(name) && value > 0) value = -value;
      if (value === 0) return;
      extras.push({ label: cleanName(name) || 'Extra', amount: value });
      return;
    }
    if (SKIP_RE.test(name)) return;
    if (!/\p{L}/u.test(name) || amount <= 0) return;
    items.push({ name: cleanName(name), qty, amount });
  });

  return { title, items, extras, total };
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
  const amount = parseAmount(last, digits);
  if (!Number.isFinite(amount)) return null;
  toks.pop();

  // Numbers sitting between the name and the price: qty and/or unit price.
  const middle = [];
  while (toks.length > 1 && (NUM_TOKEN.test(toks[toks.length - 1]) || toks[toks.length - 1] === '@')) {
    const t = toks.pop();
    if (t !== '@') middle.unshift(t);
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
    .replace(/[:\-–]+$/g, '')
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
