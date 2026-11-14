// Home: add the bill (scan / paste / type) → check the lines → who paid → get the link.
import { api, esc, me, money, navigate, paths, session, toast } from './core.js';
import { readReceiptImage } from './scan.js';
import { parseReceipt, SAMPLE_RECEIPT } from '../lib/parse.js';
import { currencyDigits, toMinor } from '../lib/money.js';
import { PAY_METHODS } from '../lib/pay.js';
import { landingPreview, mountPreview } from './preview.js';

const TZ_CURRENCY = {
  'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Europe/London': 'GBP', 'Asia/Dubai': 'AED',
  'Asia/Singapore': 'SGD', 'Asia/Tokyo': 'JPY', 'Asia/Jakarta': 'IDR', 'Africa/Lagos': 'NGN',
  'Africa/Nairobi': 'KES', 'Asia/Karachi': 'PKR', 'Asia/Dhaka': 'BDT', 'Asia/Manila': 'PHP',
  'Asia/Kathmandu': 'NPR', 'Asia/Colombo': 'LKR', 'America/Sao_Paulo': 'BRL', 'America/Mexico_City': 'MXN',
  'Europe/Belgrade': 'RSD', 'Europe/Kyiv': 'UAH', 'Europe/Kiev': 'UAH', 'Europe/Moscow': 'RUB',
  'Asia/Tashkent': 'UZS', 'Asia/Almaty': 'KZT', 'Asia/Tbilisi': 'GEL', 'Africa/Johannesburg': 'ZAR',
  'Africa/Cairo': 'EGP', 'Asia/Riyadh': 'SAR', 'Asia/Qatar': 'QAR', 'Asia/Seoul': 'KRW',
  'Asia/Shanghai': 'CNY', 'Asia/Hong_Kong': 'HKD', 'Asia/Bangkok': 'THB', 'Asia/Ho_Chi_Minh': 'VND',
  'Asia/Kuala_Lumpur': 'MYR', 'Pacific/Auckland': 'NZD', 'America/Toronto': 'CAD', 'America/Vancouver': 'CAD',
  'Europe/Zurich': 'CHF', 'Europe/Warsaw': 'PLN', 'Europe/Istanbul': 'TRY', 'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK', 'Europe/Copenhagen': 'DKK', 'Europe/Prague': 'CZK', 'Europe/Budapest': 'HUF',
  'America/Argentina/Buenos_Aires': 'ARS', 'America/Bogota': 'COP', 'America/Santiago': 'CLP', 'America/Lima': 'PEN',
};
const EURO_ZONES = /^Europe\/(Berlin|Paris|Madrid|Rome|Amsterdam|Brussels|Vienna|Lisbon|Dublin|Helsinki|Athens|Bratislava|Ljubljana|Tallinn|Riga|Vilnius|Luxembourg|Malta|Zagreb)$/;
const REGION_CURRENCY = {
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SG: 'SGD', AU: 'AUD', CA: 'CAD', JP: 'JPY', ID: 'IDR', NG: 'NGN',
  KE: 'KES', BR: 'BRL', MX: 'MXN', PH: 'PHP', PK: 'PKR', BD: 'BDT', NP: 'NPR', LK: 'LKR', ZA: 'ZAR', CH: 'CHF',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
  GR: 'EUR', RS: 'RSD', UA: 'UAH', RU: 'RUB', TR: 'TRY', PL: 'PLN', SE: 'SEK', NO: 'NOK', DK: 'DKK', NZ: 'NZD',
};
const COMMON = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'IDR', 'NGN', 'KES', 'BRL', 'MXN',
  'PHP', 'PKR', 'BDT', 'NPR', 'LKR', 'ZAR', 'CHF', 'RSD', 'UAH', 'TRY', 'PLN', 'SEK', 'NOK', 'DKK', 'NZD', 'SAR',
  'QAR', 'EGP', 'KRW', 'CNY', 'HKD', 'THB', 'VND', 'MYR', 'UZS', 'KZT', 'GEL', 'RUB', 'CZK', 'HUF', 'ARS', 'COP',
  'CLP', 'PEN'];

function guessCurrency() {
  const remembered = me.get().currency;
  if (remembered) return remembered;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
    if (EURO_ZONES.test(tz)) return 'EUR';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$/.test(tz)) return 'USD';
    if (tz.startsWith('Australia/')) return 'AUD';
  } catch {
    /* fall through */
  }
  for (const lang of navigator.languages || [navigator.language]) {
    try {
      const region = new Intl.Locale(lang).maximize().region;
      if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    } catch {
      /* ignore */
    }
  }
  return 'USD';
}

export function mountCreate(root, { ref } = {}) {
  const saved = me.get();
  const state = {
    tab: 'scan',
    items: [],
    extras: [],
    receiptTotal: 0,
    title: '',
    payerName: saved.name || '',
    currency: guessCurrency(),
    payMethod: saved.payMethod || 'none',
    payHandle: saved.payHandle || '',
    busy: false,
    showEditor: false,
    note: '',
  };
  if (state.payMethod === 'upi' && state.currency !== 'INR') state.payMethod = 'none';

  root.innerHTML = `
    <section class="landing">
      <div class="landing-intro">
        <h1>Split the bill<br> <mark>by the bite.</mark></h1>
        <p>Scan the receipt and share one link. Friends tap what they had, and Tapsplit works out what each person owes, tax and tip included.</p>
        <div class="landing-actions">
          <button type="button" class="btn primary" data-act="start">Split a bill <span aria-hidden="true">↘</span></button>
          <button type="button" class="btn" data-act="preview">Try the interactive demo</button>
        </div>
        <p class="landing-note">Free · No app or account required</p>
      </div>
      ${landingPreview()}
    </section>
    <form class="receipt create-flow" id="create" novalidate>
      <div class="step">
        <h2 class="step-title" id="create-title" tabindex="-1">Add the bill</h2>
        <div class="tabs" role="tablist" aria-label="How to add the bill">
          <button type="button" class="tab" role="tab" data-tab="scan">Scan photo</button>
          <button type="button" class="tab" role="tab" data-tab="paste">Paste text</button>
          <button type="button" class="tab" role="tab" data-tab="type">Type items</button>
        </div>
        <div class="tabpanel" id="panel"></div>
        <p class="small muted" style="margin:10px 0 0">No receipt handy? <button type="button" class="linkish" data-act="sample">Try a sample bill</button></p>
      </div>
      <div id="editor-step"></div>
      <div id="you-step"></div>
    </form>`;

  const form = root.querySelector('#create');
  const panel = root.querySelector('#panel');
  const editorStep = root.querySelector('#editor-step');
  const youStep = root.querySelector('#you-step');

  // ---------- step 1 ----------
  function renderTabs() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    if (state.tab === 'scan') {
      panel.innerHTML = `
        <label class="drop" for="photo">
          <strong>Take or choose a photo of the receipt</strong>
          <span class="small muted">Flat, well lit, the whole bill in frame</span>
        </label>
        <input id="photo" type="file" accept="image/*" capture="environment" class="sr-only">
        <div id="scan-status" class="hidden">
          <div class="progress"><span id="scan-bar"></span></div>
          <p class="small muted" id="scan-msg" style="margin:6px 0 0"></p>
        </div>`;
    } else if (state.tab === 'paste') {
      panel.innerHTML = `
        <label class="field"><span>Paste the bill, or type one item per line like <span class="mono">Paneer Tikka 340</span></span>
        <textarea class="input" id="paste" placeholder="Margherita Pizza 450&#10;2 x Coke 120&#10;GST 5% 28.50"></textarea></label>
        <button type="button" class="btn primary" data-act="read-paste">Read items</button>`;
    } else {
      panel.innerHTML = `<p class="small muted" style="margin:0">Add each item and its price below. Use the quantity for things like 3 beers on one line.</p>`;
      if (!state.items.length) state.items = [{ name: '', qty: 1, amount: '' }, { name: '', qty: 1, amount: '' }];
      state.showEditor = true;
      renderEditor();
      renderYou();
    }
  }

  function applyParsed(parsed, source) {
    if (parsed.currency && COMMON.includes(parsed.currency)) state.currency = parsed.currency;
    if (state.payMethod === 'upi' && state.currency !== 'INR') state.payMethod = 'none';
    state.items = parsed.items.map((it) => ({ name: it.name, qty: it.qty || 1, amount: fmtInput(it.amount) }));
    state.extras = parsed.extras.map((e) => ({ label: e.label, amount: fmtInput(e.amount) }));
    state.receiptTotal = parsed.total || 0;
    if (parsed.title && (!state.title || !state.titleTyped)) state.title = parsed.title; // a new receipt replaces the last one's name, not yours
    state.showEditor = true;
    state.note = source;
    if (!state.items.length) {
      state.items = [{ name: '', qty: 1, amount: '' }];
      toast("Couldn't find items in that. Add them below.");
    }
    renderEditor();
    renderYou();
    editorStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fmtInput(n) {
    if (!Number.isFinite(n)) return '';
    const d = currencyDigits(state.currency);
    return Number.isInteger(n) ? String(n) : n.toFixed(d);
  }

  async function onPhoto(file) {
    if (!file || state.busy) return;
    state.busy = true;
    const status = root.querySelector('#scan-status');
    const bar = root.querySelector('#scan-bar');
    const msg = root.querySelector('#scan-msg');
    status.classList.remove('hidden');
    try {
      const result = await readReceiptImage(file, (p, text) => {
        bar.style.width = `${Math.round(p * 100)}%`;
        if (text) msg.textContent = text;
      });
      applyParsed(
        result,
        result.via === 'ai'
          ? 'Read by AI. Check the lines below before sharing.'
          : 'Scanned on your phone. OCR makes mistakes, so check the lines below.',
      );
      status.classList.add('hidden');
    } catch (err) {
      msg.textContent = err.message || 'Could not read that photo.';
    } finally {
      state.busy = false;
    }
  }

  // ---------- step 2: editor ----------
  function renderEditor() {
    if (!state.showEditor) {
      editorStep.innerHTML = '';
      return;
    }
    editorStep.innerHTML = `
      <div class="step">
        <h2 class="step-title">Check the items</h2>
        ${state.note ? `<p class="small muted" style="margin:-6px 0 10px">${esc(state.note)}</p>` : ''}
        <div class="editor" id="items">
          <div class="ed-head"><span>Item</span><span>Qty</span><span style="text-align:right">Price</span><span></span></div>
          ${state.items.map((it, i) => `
            <div class="ed-row">
              <input class="input" aria-label="Item name" data-list="items" data-i="${i}" data-k="name" value="${esc(it.name)}" placeholder="Item" maxlength="80">
              <input class="input num" aria-label="Quantity" data-list="items" data-i="${i}" data-k="qty" value="${esc(it.qty)}" inputmode="numeric" maxlength="2">
              <input class="input num" aria-label="Line price" data-list="items" data-i="${i}" data-k="amount" value="${esc(it.amount)}" inputmode="decimal" placeholder="0">
              <button type="button" class="icon-btn" data-act="del-item" data-i="${i}" aria-label="Remove ${esc(it.name || 'item')}">×</button>
            </div>`).join('')}
        </div>
        <div class="ed-actions"><button type="button" class="btn small" data-act="add-item">+ Add item</button></div>
        <h3 class="sub-title">Tax, service, tip, discount</h3>
        <div class="editor">
          ${state.extras.map((e, i) => `
            <div class="ed-row extra">
              <input class="input" aria-label="Charge name" data-list="extras" data-i="${i}" data-k="label" value="${esc(e.label)}" placeholder="e.g. GST 5%" maxlength="40">
              <input class="input num" aria-label="Charge amount" data-list="extras" data-i="${i}" data-k="amount" value="${esc(e.amount)}" inputmode="decimal" placeholder="0">
              <button type="button" class="icon-btn" data-act="del-extra" data-i="${i}" aria-label="Remove ${esc(e.label || 'charge')}">×</button>
            </div>`).join('')}
        </div>
        <div class="ed-actions">
          <button type="button" class="btn small" data-act="add-extra" data-label="Tax">+ Tax</button>
          <button type="button" class="btn small" data-act="add-extra" data-label="Service charge">+ Service</button>
          <button type="button" class="btn small" data-act="add-extra" data-label="Tip">+ Tip</button>
          <button type="button" class="btn small" data-act="add-extra" data-label="Discount" data-neg="1">+ Discount</button>
        </div>
        <p class="small muted" style="margin:8px 0 0">Extras are shared in proportion to what each person had. Enter discounts as negative numbers.</p>
        <div class="totals" id="totals"></div>
      </div>`;
    renderTotals();
  }

  function sums() {
    const cur = state.currency;
    const itemsMinor = state.items.reduce((a, it) => a + (toMinor(it.amount, cur) || 0), 0);
    const extrasMinor = state.extras.reduce((a, e) => a + (toMinor(e.amount, cur) || 0), 0);
    return { itemsMinor, extrasMinor, total: itemsMinor + extrasMinor };
  }

  function renderTotals() {
    const el = root.querySelector('#totals');
    if (!el) return;
    const cur = state.currency;
    const { itemsMinor, extrasMinor, total } = sums();
    let check = '';
    if (state.receiptTotal) {
      const printed = toMinor(state.receiptTotal, cur);
      const diff = total - printed;
      const tolerance = 10 ** currencyDigits(cur); // allow for round-off of one unit
      check = Math.abs(diff) <= tolerance
        ? `<div class="check ok">Matches the receipt total of ${money(printed, cur)}.</div>`
        : `<div class="check warn">The receipt says ${money(printed, cur)}. These lines add up to ${money(total, cur)} (${diff > 0 ? '+' : '−'}${money(Math.abs(diff), cur)}). Check for a missed or misread line.</div>`;
    }
    el.innerHTML = `
      <div class="trow"><span>Items</span><span>${money(itemsMinor, cur)}</span></div>
      <div class="trow"><span>Tax, service, tip</span><span>${money(extrasMinor, cur)}</span></div>
      <div class="trow grand"><span>Total</span><span>${money(total, cur)}</span></div>
      ${check}`;
  }

  // ---------- step 3: you ----------
  function renderYou() {
    if (!state.showEditor) {
      youStep.innerHTML = '';
      return;
    }
    const methods = Object.entries(PAY_METHODS).filter(([k]) => k !== 'upi' || state.currency === 'INR');
    const currencies = [state.currency, ...COMMON.filter((c) => c !== state.currency)];
    const method = PAY_METHODS[state.payMethod] || PAY_METHODS.none;
    youStep.innerHTML = `
      <div class="step">
        <h2 class="step-title">Who paid?</h2>
        <div class="row2">
          <label class="field"><span>Your name</span><input class="input" id="payer" autocomplete="given-name" maxlength="40" value="${esc(state.payerName)}" placeholder="e.g. Asha"></label>
          <label class="field"><span>Where</span><input class="input" id="title" maxlength="80" value="${esc(state.title)}" placeholder="e.g. Friday dinner"></label>
        </div>
        <div class="row-pay">
          <label class="field"><span>Currency</span>
            <select class="input" id="currency">${currencies.map((c) => `<option ${c === state.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Friends pay you with</span>
            <select class="input" id="paymethod">${methods.map(([k, m]) => `<option value="${k}" ${k === state.payMethod ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field ${state.payMethod === 'none' ? 'hidden' : ''}" id="handle-field"><span>Your ${esc(method.label)} ${state.payMethod === 'link' ? 'payment link' : 'ID'} (friends see this)</span>
          <input class="input" id="handle" maxlength="200" value="${esc(state.payHandle)}" placeholder="${esc(method.placeholder)}" autocapitalize="off" autocorrect="off" spellcheck="false">
        </label>
        <button type="submit" class="btn primary big" id="create-btn">Create split & get link</button>
        <p class="error" id="create-error" role="alert"></p>
      </div>`;
  }

  // ---------- events ----------
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  mountPreview(root, opts);
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      state.tab = tab.dataset.tab;
      renderTabs();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const i = Number(act.dataset.i);
    switch (act.dataset.act) {
      case 'start':
        root.querySelector('#create-title').focus({ preventScroll: true });
        form.scrollIntoView({ block: 'start' });
        break;
      case 'preview':
        root.querySelector('#preview-dialog').showModal();
        break;
      case 'sample':
        state.tab = 'paste';
        state.currency = 'INR'; // the sample is an Indian restaurant bill
        state.title = '';
        renderTabs();
        root.querySelector('#paste').value = SAMPLE_RECEIPT;
        applyParsed(parseReceipt(SAMPLE_RECEIPT), 'Sample bill loaded. Edit anything, then create the split.');
        break;
      case 'read-paste': {
        const text = root.querySelector('#paste').value;
        if (!text.trim()) return toast('Paste the bill text first.');
        applyParsed(parseReceipt(text, { digits: currencyDigits(state.currency) }), 'Check the lines below before sharing.');
        break;
      }
      case 'add-item':
        state.items.push({ name: '', qty: 1, amount: '' });
        renderEditor();
        root.querySelectorAll('[data-list="items"][data-k="name"]')[state.items.length - 1]?.focus();
        break;
      case 'del-item':
        state.items.splice(i, 1);
        renderEditor();
        break;
      case 'add-extra':
        state.extras.push({ label: act.dataset.label, amount: act.dataset.neg ? '-' : '' });
        renderEditor();
        root.querySelectorAll('[data-list="extras"][data-k="amount"]')[state.extras.length - 1]?.focus();
        break;
      case 'del-extra':
        state.extras.splice(i, 1);
        renderEditor();
        break;
      default:
    }
  }, opts);

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.list) {
      const row = state[t.dataset.list][Number(t.dataset.i)];
      if (row) row[t.dataset.k] = t.value;
      renderTotals();
    } else if (t.id === 'payer') state.payerName = t.value;
    else if (t.id === 'title') {
      state.title = t.value;
      state.titleTyped = Boolean(t.value.trim());
    } else if (t.id === 'handle') state.payHandle = t.value;
  }, opts);

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'photo') onPhoto(t.files?.[0]);
    else if (t.id === 'currency') {
      state.currency = t.value;
      if (state.payMethod === 'upi' && state.currency !== 'INR') state.payMethod = 'none';
      renderYou();
      renderTotals();
    } else if (t.id === 'paymethod') {
      state.payMethod = t.value;
      renderYou();
      if (state.payMethod !== 'none') root.querySelector('#handle')?.focus();
    }
  }, opts);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector('#create-error');
    const btn = root.querySelector('#create-btn');
    errorEl.textContent = '';
    const cur = state.currency;
    const items = [];
    for (const it of state.items) {
      if (!it.name.trim() && !String(it.amount).trim()) continue;
      const price = toMinor(it.amount, cur);
      const qty = Number(it.qty) || 1;
      if (!it.name.trim()) return (errorEl.textContent = 'Every item needs a name.');
      if (!Number.isFinite(price) || price < 0) return (errorEl.textContent = `"${it.name}" needs a price.`);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) return (errorEl.textContent = `"${it.name}" needs a quantity from 1 to 99.`);
      items.push({ name: it.name.trim(), qty, price });
    }
    if (!items.length) return (errorEl.textContent = 'Add at least one item from the bill.');
    const extras = [];
    for (const x of state.extras) {
      if (!String(x.amount).replace('-', '').trim()) continue;
      const amount = toMinor(x.amount, cur);
      if (!Number.isFinite(amount)) return (errorEl.textContent = `"${x.label}" needs an amount.`);
      if (amount !== 0) extras.push({ label: x.label.trim() || 'Extra', amount });
    }
    const payerName = state.payerName.trim();
    if (!payerName) {
      root.querySelector('#payer').focus();
      return (errorEl.textContent = 'Add your name so friends know who to pay.');
    }
    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const res = await api('POST', '/splits', {
        title: state.title.trim() || 'Shared bill',
        payerName,
        currency: cur,
        items,
        extras,
        pay: { method: state.payMethod, handle: state.payHandle.trim() },
        ref: ref || undefined,
      });
      session.set(res.id, { admin: res.adminToken, pid: res.participantId, token: res.participantToken });
      me.set({ name: payerName, currency: cur, payMethod: state.payMethod, payHandle: state.payHandle.trim() });
      navigate(paths.split(res.id, true));
    } catch (err) {
      errorEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Create split & get link';
    }
  }, opts);

  renderTabs();
  return () => {
    ac.abort();
    root.querySelector('#preview-dialog')?.close();
  };
}
