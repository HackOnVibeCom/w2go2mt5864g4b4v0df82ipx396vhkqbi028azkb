// "Pay me back" links. The payer picks how friends should pay; each friend gets
// a button with their exact amount pre-filled where the provider supports it.
import { minorToMajor, currencyDigits } from './money.js';

export const PAY_METHODS = {
  none: { label: 'Just track it', placeholder: '' },
  upi: { label: 'UPI', placeholder: 'yourname@okbank' },
  paypal: { label: 'PayPal.me', placeholder: 'paypal.me username' },
  venmo: { label: 'Venmo', placeholder: '@username' },
  cashapp: { label: 'Cash App', placeholder: '$cashtag' },
  revolut: { label: 'Revolut', placeholder: 'revtag' },
  wise: { label: 'Wise', placeholder: 'wisetag' },
  link: { label: 'Other link', placeholder: 'https://…' },
};

const HANDLE_RULES = {
  upi: /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,32}$/,
  paypal: /^[a-zA-Z0-9]{1,40}$/,
  venmo: /^@?[a-zA-Z0-9_-]{1,40}$/,
  cashapp: /^\$?[a-zA-Z][a-zA-Z0-9_]{0,30}$/,
  revolut: /^@?[a-zA-Z0-9._-]{1,40}$/,
  wise: /^@?[a-zA-Z0-9._-]{1,40}$/,
};

// Returns the cleaned handle, or null when it is not valid for the method.
export function cleanPayHandle(method, handle) {
  const h = String(handle ?? '').trim();
  if (method === 'none') return '';
  if (!(method in PAY_METHODS) || !h) return null;
  if (method === 'link') {
    try {
      const u = new URL(h);
      return u.protocol === 'https:' && h.length <= 200 ? u.toString() : null;
    } catch {
      return null;
    }
  }
  if (method === 'paypal') {
    const m = h.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '').replace(/\/.*$/, '');
    return HANDLE_RULES.paypal.test(m) ? m : null;
  }
  return HANDLE_RULES[method].test(h) ? h : null;
}

function plainAmount(minor, currency) {
  return minorToMajor(minor, currency).toFixed(currencyDigits(currency));
}

// Build the link a friend taps to pay. Returns { href, prefilled } or null.
export function payLink({ method, handle, payeeName, amountMinor, currency, note }) {
  if (!handle || method === 'none') return null;
  const amount = plainAmount(amountMinor, currency);
  const enc = encodeURIComponent;
  switch (method) {
    case 'upi':
      if (currency !== 'INR') return null;
      return {
        href: `upi://pay?pa=${enc(handle)}&pn=${enc(payeeName)}&am=${amount}&cu=INR&tn=${enc(note.slice(0, 50))}`,
        prefilled: true,
      };
    case 'paypal':
      return { href: `https://www.paypal.me/${enc(handle)}/${amount}${currency}`, prefilled: true };
    case 'venmo':
      return {
        href: `https://venmo.com/${enc(handle.replace(/^@/, ''))}?txn=pay&amount=${amount}&note=${enc(note)}`,
        prefilled: true,
      };
    case 'cashapp':
      return { href: `https://cash.app/$${enc(handle.replace(/^\$/, ''))}/${amount}`, prefilled: true };
    case 'revolut':
      return { href: `https://revolut.me/${enc(handle.replace(/^@/, ''))}`, prefilled: false };
    case 'wise':
      return { href: `https://wise.com/pay/me/${enc(handle.replace(/^@/, ''))}`, prefilled: false };
    case 'link':
      return { href: handle, prefilled: false };
    default:
      return null;
  }
}
