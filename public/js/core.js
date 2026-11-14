// Shared client plumbing: config, API calls, local session storage, small UI helpers.
import { formatMoney } from '../lib/money.js';

const CFG = window.TAPSPLIT_CONFIG || {};
const API_BASE = String(CFG.api || '').replace(/\/+$/, '');
// When the API lives on another origin (static host), share links point at the API
// origin, which serves pretty /s/:id pages with link previews.
const SHARE_BASE = String(CFG.shareBase || CFG.api || location.origin).replace(/\/+$/, '');
const STATIC_HOST = Boolean(API_BASE);

export const paths = {
  home: (ref) => (ref ? `/?ref=${encodeURIComponent(ref)}` : '/'),
  split: (id, isNew) => (STATIC_HOST ? `/?s=${id}${isNew ? '&new=1' : ''}` : `/s/${id}${isNew ? '?new=1' : ''}`),
  growth: () => (STATIC_HOST ? '/?view=growth' : '/growth'),
};
export const shareUrl = (id) => `${SHARE_BASE}/s/${id}`;

// ---------- storage (survives private mode / blocked storage) ----------
const memory = new Map();
export const store = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? (memory.get(key) ?? null) : JSON.parse(v);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* memory only */
    }
  },
};

export function randomToken(n = 16) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export function visitorId() {
  let v = store.get('tapsplit:vid');
  if (!v) {
    v = randomToken(20);
    store.set('tapsplit:vid', v);
  }
  return v;
}

export const session = {
  get: (id) => store.get(`tapsplit:s:${id}`) || {},
  set: (id, patch) => store.set(`tapsplit:s:${id}`, { ...session.get(id), ...patch }),
  clear: (id) => store.set(`tapsplit:s:${id}`, {}),
};

export const me = {
  get: () => store.get('tapsplit:me') || {},
  set: (patch) => store.set('tapsplit:me', { ...me.get(), ...patch }),
};

// ---------- API ----------
export async function api(method, path, body, token) {
  const headers = { 'x-visitor': visitorId() };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Can't reach Tapsplit. Check your connection and try again."), { status: 0 });
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || (data === null
      ? "Tapsplit's server isn't reachable from this address. Try again in a minute."
      : `Something went wrong (${res.status}).`);
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}

export function track(type, splitId, detail) {
  try {
    fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json', 'x-visitor': visitorId() },
      body: JSON.stringify({ type, splitId, detail }),
    }).catch(() => {});
  } catch {
    /* analytics must never break the app */
  }
}

// ---------- UI helpers ----------
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (minor, currency) => formatMoney(minor, currency);

let toastTimer;
export function toast(message, ms = 2400) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

export function personColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 80% 74%)`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function shareTargets(url, text) {
  const enc = encodeURIComponent;
  return {
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
  };
}

export const canNativeShare = () => typeof navigator.share === 'function';

export function navigate(href) {
  history.pushState({}, '', href);
  window.dispatchEvent(new Event('tapsplit:navigate'));
  window.scrollTo(0, 0);
}
