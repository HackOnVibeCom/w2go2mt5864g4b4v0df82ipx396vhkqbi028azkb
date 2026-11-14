// Money helpers shared by the browser and the server.
// All amounts are stored as integers in the currency's minor unit (paise, cents, yen...).

const digitsCache = new Map();

export function currencyDigits(currency) {
  if (digitsCache.has(currency)) return digitsCache.get(currency);
  let digits = 2;
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits;
  } catch {
    digits = 2;
  }
  digitsCache.set(currency, digits);
  return digits;
}

export function isSupportedCurrency(currency) {
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency });
    return true;
  } catch {
    return false;
  }
}

// Parse a typed or OCR'd amount into a Number in major units.
// Handles "1,234.50", "1.234,50", "2,40,000", "₹ 450", "(100)", "100-", "-12".
export function parseAmount(input, digits = 2) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  let s = String(input ?? '').trim();
  if (!s) return NaN;
  const negative = /^[-−–]/.test(s) || /[-−–]$/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return NaN;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intPart = s;
  let frac = '';
  if (lastSep !== -1) {
    const after = s.slice(lastSep + 1);
    const sepCount = (s.match(/[.,]/g) || []).length;
    const looksDecimal =
      after.length >= 1 &&
      (after.length <= 2 || (digits === 3 && after.length === 3 && sepCount === 1));
    if (looksDecimal) {
      intPart = s.slice(0, lastSep);
      frac = after;
    }
  }
  intPart = intPart.replace(/[.,]/g, '') || '0';
  const n = Number(frac ? `${intPart}.${frac}` : intPart);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

export function toMinor(input, currency) {
  const digits = currencyDigits(currency);
  const n = parseAmount(input, digits);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10 ** digits);
}

export function minorToInput(minor, currency) {
  const digits = currencyDigits(currency);
  const v = minor / 10 ** digits;
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

export function minorToMajor(minor, currency) {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor, currency, locale) {
  const digits = currencyDigits(currency);
  const v = minor / 10 ** digits;
  const whole = Number.isInteger(v);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(v);
  } catch {
    return `${currency} ${whole ? v : v.toFixed(digits)}`;
  }
}
