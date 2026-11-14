// The split page: friends tap what they had, see their exact share and pay;
// the payer shares the link, watches the board fill up and confirms money in.
import {
  api, canNativeShare, copyText, esc, initials, me, money, paths, personColor,
  session, shareTargets, shareUrl, toast, track,
} from './core.js';
import { computeSplit } from '../lib/split.js';
import { minorToInput } from '../lib/money.js';
import { payLink } from '../lib/pay.js';

const POLL_MS = 4000;

export function mountSplit(root, id, { isNew = false } = {}) {
  takeManageLinkFromHash(id);
  const S = {
    data: null,
    sess: session.get(id),
    localClaims: null,
    version: 0,
    saveTimer: null,
    pollTimer: null,
    joining: false,
    dead: false,
  };

  root.innerHTML = `<div class="skeleton" aria-label="Loading"></div>`;

  // ---------- data ----------
  async function load(initial = false) {
    try {
      const fresh = await api('GET', `/splits/${id}${S.data && !initial ? `?rev=${S.data.rev}` : ''}`);
      if (S.dead || !fresh) return;
      S.data = fresh;
      if (S.sess.pid && !fresh.participants.some((p) => p.id === S.sess.pid)) {
        session.clear(id);
        S.sess = {};
      }
      if (initial) mountShell();
      renderAll();
    } catch (err) {
      if (initial) {
        root.innerHTML = `<div class="card"><h2>We couldn't open this split</h2><p class="muted">${esc(err.message)}</p><a class="btn primary" href="${paths.home()}" data-link>Split a new bill</a></div>`;
      }
    }
  }

  // Merge the server state with my unsaved taps, then run the same split engine the server uses.
  function derived() {
    const d = S.data;
    const participants = d.participants.map((p) =>
      p.id === S.sess.pid && S.localClaims ? { ...p, claims: S.localClaims } : p,
    );
    const c = computeSplit({ items: d.items, extras: d.extras }, participants);
    return {
      participants: participants.map((p) => ({ ...p, ...c.participants[p.id] })),
      lines: Object.fromEntries(c.items.map((l) => [l.id, l])),
      unclaimed: c.unclaimed,
      grandTotal: c.grandTotal,
    };
  }

  const isAdmin = () => Boolean(S.sess.admin);
  const myId = () => S.sess.pid;
  const myClaims = () => S.localClaims || S.data.participants.find((p) => p.id === myId())?.claims || {};

  // ---------- layout ----------
  function mountShell() {
    root.innerHTML = `
      <section class="card bill-head" id="head"></section>
      <section id="sharebox"></section>
      <section class="card ${myId() ? 'hidden' : ''}" id="joinbox">
        <p class="join-title">Who are you?</p>
        <form class="join" id="join-form">
          <label class="sr-only" for="join-name">Your name</label>
          <input class="input" id="join-name" maxlength="40" autocomplete="given-name" placeholder="Your name" value="${esc(me.get().name || '')}">
          <button class="btn primary" type="submit">Start tapping</button>
        </form>
        <p class="error" id="join-error" role="alert"></p>
        <p class="small muted" id="joined-list" style="margin:6px 0 0"></p>
      </section>
      <section class="card">
        <h2>What did you have?</h2>
        <p class="small muted" style="margin:-4px 0 6px">Tap your items. Shared something? Everyone who had it taps it and it splits evenly.</p>
        <ul class="lines" id="lines"></ul>
        <div id="extras"></div>
      </section>
      <section class="card board" id="board"></section>
      <section class="cta" id="cta"></section>
      <div class="bar hidden" id="bar"></div>`;
    track('view', id);
  }

  function renderAll() {
    if (!S.data) return;
    const v = derived();
    renderHead(v);
    renderShare(v);
    renderJoin();
    renderLines(v);
    renderBoard(v);
    renderCta();
    renderBar(v);
  }

  function renderHead(v) {
    const d = S.data;
    const claimed = v.grandTotal - v.unclaimed.total;
    const pct = v.grandTotal > 0 ? Math.round((claimed / v.grandTotal) * 100) : 0;
    const friends = d.participants.filter((p) => !p.isPayer).length;
    root.querySelector('#head').innerHTML = `
      <h1>${esc(d.title)}</h1>
      <p class="bill-meta"><b>${esc(d.payerName)}</b> paid <b class="mono">${money(v.grandTotal, d.currency)}</b></p>
      <div class="meter" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Share of the bill claimed"><span style="width:${pct}%"></span></div>
      <div class="meter-label"><span>${money(claimed, d.currency)} claimed</span><span>${friends} ${friends === 1 ? 'friend' : 'friends'} joined</span></div>`;
  }

  function renderShare(v) {
    const box = root.querySelector('#sharebox');
    if (!isAdmin()) {
      box.innerHTML = '';
      return;
    }
    const d = S.data;
    const friends = d.participants.filter((p) => !p.isPayer).length;
    const url = shareUrl(id);
    const prominent = isNew || friends === 0;
    const text = `${d.payerName} paid ${money(v.grandTotal, d.currency)} at ${d.title}. Tap what you had and Tapsplit works out your share:`;
    const t = shareTargets(url, text);
    box.innerHTML = `
      <div class="share-box">
        <h2>${prominent ? 'Now send this link to the group' : 'Share the link again'}</h2>
        <p>${prominent ? 'Everyone opens it in their browser, taps what they had and pays you back. You can tap your own items below too.' : 'Anyone with the link can tap their items.'}</p>
        <div class="share-grid">
          <a class="btn" href="${esc(t.whatsapp)}" target="_blank" rel="noopener" data-share="whatsapp">WhatsApp</a>
          <a class="btn" href="${esc(t.telegram)}" target="_blank" rel="noopener" data-share="telegram">Telegram</a>
          <button class="btn" type="button" data-act="copy-link">Copy link</button>
          ${canNativeShare() ? '<button class="btn" type="button" data-act="native-share">More…</button>' : `<button class="btn" type="button" data-act="copy-summary">Copy summary</button>`}
        </div>
        <div class="share-url"><input class="input" readonly value="${esc(url)}" aria-label="Split link" onclick="this.select()"></div>
        <p class="small" style="margin:10px 0 0"><button type="button" class="linkish" data-act="manage-link">Copy your private manage link</button> <span class="muted">to manage this split on another device.</span></p>
      </div>`;
  }

  function renderJoin() {
    const box = root.querySelector('#joinbox');
    box.classList.toggle('hidden', Boolean(myId()));
    const names = S.data.participants.map((p) => p.name);
    root.querySelector('#joined-list').textContent = names.length ? `Already here: ${names.join(', ')}` : '';
  }

  function renderLines(v) {
    const d = S.data;
    const mine = myClaims();
    const byId = Object.fromEntries(v.participants.map((p) => [p.id, p]));
    root.querySelector('#lines').innerHTML = d.items
      .map((item) => {
        const line = v.lines[item.id];
        const myShares = mine[item.id] || 0;
        const claimers = line.claimers.map((c) => byId[c.id]).filter(Boolean);
        const myPart = line.claimers.find((c) => c.id === myId())?.amount || 0;
        const others = claimers.filter((p) => p.id !== myId());
        let meta = '';
        if (myShares && claimers.length > 1) meta = `You + ${others.map((p) => esc(p.name)).join(', ')} · your part ${money(myPart, d.currency)}`;
        else if (myShares && item.qty > 1) meta = `Your part ${money(myPart, d.currency)}`;
        else if (myShares) meta = 'Yours';
        else if (claimers.length) meta = others.map((p) => esc(p.name)).join(', ');
        else meta = '<span class="unclaimed-tag">Nobody yet</span>';
        if (item.qty > 1) meta += ` · ${Math.min(line.claimedShares, item.qty)} of ${item.qty} claimed`;
        const chips = claimers
          .map((p) => `<span class="chip" style="background:${personColor(p.id)}" title="${esc(p.name)}">${esc(initials(p.name))}</span>`)
          .join('');
        const stepper =
          item.qty > 1 && myShares
            ? `<div class="stepper" role="group" aria-label="How many ${esc(item.name)} you had">
                 <button type="button" data-act="minus" data-item="${item.id}" aria-label="One less">−</button>
                 <span>${myShares} of ${item.qty}</span>
                 <button type="button" data-act="plus" data-item="${item.id}" aria-label="One more" ${myShares >= item.qty ? 'disabled' : ''}>+</button>
               </div>`
            : '';
        return `
          <li class="line ${myShares ? 'mine' : ''}">
            <button type="button" class="line-main" data-act="toggle" data-item="${item.id}" aria-pressed="${myShares > 0}">
              <span class="line-top"><span class="tick" aria-hidden="true">${myShares ? '✓' : ''}</span><span class="line-name">${esc(item.name)}${item.qty > 1 ? `<span class="qty">×${item.qty}</span>` : ''}</span></span>
              <span class="line-price">${money(item.price, d.currency)}</span>
              <span class="line-meta" style="padding-left:30px"><span class="chips">${chips}</span>${meta}</span>
            </button>
            ${stepper}
          </li>`;
      })
      .join('');
    const extrasTotal = d.extras.reduce((a, e) => a + e.amount, 0);
    root.querySelector('#extras').innerHTML = d.extras.length
      ? `<div class="extras-note"><span>${d.extras.map((e) => esc(e.label)).join(' · ')}<br><span class="small">Shared in proportion to what each person had</span></span><span class="mono">${money(extrasTotal, d.currency)}</span></div>`
      : '';
  }

  function statusPill(p) {
    if (p.isPayer) return '<span class="pill">paid the bill</span>';
    if (p.confirmedAt) return '<span class="pill ok">received ✓</span>';
    if (p.paidAt) return '<span class="pill wait">says paid</span>';
    if (p.total > 0) return '<span class="pill">owes</span>';
    return '<span class="pill">tapping…</span>';
  }

  function renderBoard(v) {
    const d = S.data;
    const people = v.participants;
    const owed = people.filter((p) => !p.isPayer).reduce((a, p) => a + p.total, 0);
    const back = people.filter((p) => !p.isPayer && (p.paidAt || p.confirmedAt)).reduce((a, p) => a + p.total, 0);
    const unclaimedNames = d.items
      .filter((it) => v.lines[it.id].unclaimed > 0)
      .map((it) => {
        const l = v.lines[it.id];
        const left = it.qty - Math.min(l.claimedShares, it.qty);
        return it.qty > 1 ? `${it.name} ×${left}` : it.name;
      });
    root.querySelector('#board').innerHTML = `
      <h2>Who owes ${esc(d.payerName)}</h2>
      ${people
        .map((p) => {
          const count = Object.values(p.claims || {}).reduce((a, n) => a + n, 0);
          const you = p.id === myId() ? ' (you)' : '';
          const confirm =
            isAdmin() && !p.isPayer && p.total > 0
              ? p.confirmedAt
                ? `<button type="button" class="btn ghost small" data-act="unconfirm" data-p="${p.id}">Undo</button>`
                : `<button type="button" class="btn small" data-act="confirm" data-p="${p.id}">Got it</button>`
              : '';
          return `
            <div class="person">
              <span class="chip" style="background:${personColor(p.id)}">${esc(initials(p.name))}</span>
              <div><div class="person-name">${esc(p.name)}${you}</div><div class="person-sub">${count ? `${count} item${count > 1 ? 's' : ''}` : 'nothing tapped yet'}</div></div>
              <div class="person-right"><span class="mono">${money(p.total, d.currency)}</span>${statusPill(p)}${confirm}</div>
            </div>`;
        })
        .join('')}
      ${
        v.unclaimed.total > 0
          ? `<div class="person"><span class="chip" style="background:var(--warn-soft);color:var(--warn)">?</span><div><div class="person-name">Unclaimed</div><div class="person-sub">${esc(unclaimedNames.join(', '))}</div></div><div class="person-right"><span class="mono">${money(v.unclaimed.total, d.currency)}</span></div></div>`
          : ''
      }
      <p class="small muted" style="margin:10px 0 0">${money(back, d.currency)} of ${money(owed, d.currency)} paid back so far.</p>
      ${
        isAdmin()
          ? `<div class="board-tools">
               <button type="button" class="btn small" data-act="copy-summary">Copy summary for the group</button>
               ${v.unclaimed.total > 0 ? '<button type="button" class="btn small" data-act="nudge">Ask who had the unclaimed items</button>' : ''}
             </div>`
          : ''
      }`;
  }

  function renderCta() {
    const meP = S.data.participants.find((p) => p.id === myId());
    const done = meP && (meP.paidAt || meP.confirmedAt);
    root.querySelector('#cta').innerHTML = isAdmin()
      ? `<h2>Splitting with another group?</h2><p>Every split gets its own link. Nobody needs an account.</p><a class="btn" href="${paths.home(id)}" data-link data-cta="1">Split another bill</a>`
      : `<h2>${done ? 'Done! ' : ''}Paying next time?</h2><p>Snap the receipt and send one link. Everyone taps what they had, so nobody has to do the maths. No app, no sign-up.</p><a class="btn" href="${paths.home(id)}" data-link data-cta="1">Split your own bill</a>`;
  }

  function renderBar(v) {
    const bar = root.querySelector('#bar');
    const d = S.data;
    const meP = v.participants.find((p) => p.id === myId());
    if (!meP) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    const cur = d.currency;
    let left;
    let actions = '';
    let note = '';
    if (meP.isPayer) {
      const owed = v.participants.filter((p) => !p.isPayer).reduce((a, p) => a + p.total, 0);
      left = `<div class="bar-label">Friends owe you</div><div class="bar-amount">${money(owed, cur)}</div>`;
      actions = `<button type="button" class="btn primary" data-act="${canNativeShare() ? 'native-share' : 'copy-link'}">Share link</button>`;
      note = `Your own share: ${money(meP.total, cur)}${v.unclaimed.total > 0 ? ` · ${money(v.unclaimed.total, cur)} still unclaimed` : ''}`;
    } else if (meP.total <= 0) {
      left = `<div class="bar-label">Your share</div><div class="bar-amount">${money(0, cur)}</div>`;
      note = 'Tap the items you had.';
    } else {
      left = `<div class="bar-label">Your share${meP.extras ? `, incl. ${money(meP.extras, cur)} tax/tip` : ''}</div><div class="bar-amount">${money(meP.total, cur)}</div>`;
      if (meP.confirmedAt) {
        note = `${esc(d.payerName)} confirmed your payment. All settled ✓`;
      } else if (meP.paidAt) {
        actions = `<button type="button" class="btn ghost small" data-act="unpay">Undo</button>`;
        note = `Marked as paid. Waiting for ${esc(d.payerName)} to confirm.`;
      } else {
        const link = payLink({
          method: d.pay.method,
          handle: d.pay.handle,
          payeeName: d.payerName,
          amountMinor: meP.total,
          currency: cur,
          note: `Tapsplit: ${d.title}`,
        });
        actions = link
          ? `<a class="btn pay" href="${esc(link.href)}" ${link.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} data-pay="${link.prefilled ? '1' : '0'}">Pay ${esc(d.payerName)}</a><button type="button" class="btn" data-act="pay">I've paid</button>`
          : `<button type="button" class="btn pay" data-act="pay">I've paid</button>`;
        if (!link) note = `Pay ${esc(d.payerName)} ${money(meP.total, cur)} your usual way, then tap “I've paid”.`;
        else if (!link.prefilled) note = `Enter ${money(meP.total, cur)} when the payment page opens.`;
      }
    }
    bar.innerHTML = `<div class="bar-inner"><div>${left}</div><div class="bar-actions">${actions}</div>${note ? `<p class="bar-note">${note}</p>` : ''}</div>`;
  }

  // ---------- actions ----------
  function setShares(itemId, shares) {
    if (!myId()) {
      const input = root.querySelector('#join-name');
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Add your name first, then tap your items.');
      return;
    }
    const item = S.data.items.find((i) => i.id === itemId);
    const next = { ...myClaims() };
    const n = Math.max(0, Math.min(item.qty, shares));
    if (n > 0) next[itemId] = n;
    else delete next[itemId];
    S.localClaims = next;
    S.version += 1;
    renderAll();
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(saveClaims, 350);
  }

  async function saveClaims() {
    const version = S.version;
    const claims = S.localClaims;
    if (!claims) return;
    try {
      const fresh = await api('PUT', `/splits/${id}/participants/${myId()}/claims`, { claims }, S.sess.token || S.sess.admin);
      if (S.dead) return;
      S.data = fresh;
      if (version === S.version) S.localClaims = null;
      renderAll();
    } catch (err) {
      toast(err.message);
      S.localClaims = null;
      load(true);
    }
  }

  async function join(name) {
    if (S.joining) return;
    const err = root.querySelector('#join-error');
    err.textContent = '';
    if (!name.trim()) {
      err.textContent = 'Type your name so the payer knows who tapped what.';
      return;
    }
    S.joining = true;
    try {
      const res = await api('POST', `/splits/${id}/participants`, { name: name.trim() });
      session.set(id, { pid: res.participantId, token: res.participantToken });
      S.sess = session.get(id);
      me.set({ name: name.trim() });
      const fresh = await api('GET', `/splits/${id}`);
      S.data = fresh;
      renderAll();
      toast('Now tap everything you had.');
    } catch (e) {
      err.textContent = e.message;
    } finally {
      S.joining = false;
    }
  }

  async function personAction(path, body, pid = myId()) {
    try {
      const token = path === 'confirm' ? S.sess.admin : S.sess.token || S.sess.admin;
      S.data = await api('POST', `/splits/${id}/participants/${pid}/${path}`, body, token);
      renderAll();
    } catch (err) {
      toast(err.message);
    }
  }

  function summaryText() {
    const v = derived();
    const d = S.data;
    const lines = [`${d.title}: ${money(v.grandTotal, d.currency)}, paid by ${d.payerName}`];
    for (const p of v.participants) {
      if (p.isPayer) continue;
      lines.push(`${p.name}: ${money(p.total, d.currency)}${p.confirmedAt ? ' ✓ received' : p.paidAt ? ' (paid)' : ''}`);
    }
    if (v.unclaimed.total > 0) lines.push(`Still unclaimed: ${money(v.unclaimed.total, d.currency)}`);
    lines.push(`Tap yours: ${shareUrl(id)}`);
    return lines.join('\n');
  }

  async function nativeShare() {
    const d = S.data;
    track('share', id, 'native');
    try {
      await navigator.share({ title: d.title, text: `${d.payerName} paid at ${d.title}. Tap what you had:`, url: shareUrl(id) });
    } catch {
      /* user closed the sheet */
    }
  }

  const onClick = async (e) => {
    const shareLink = e.target.closest('[data-share]');
    if (shareLink) return track('share', id, shareLink.dataset.share);
    const ctaLink = e.target.closest('[data-cta]');
    if (ctaLink) track('cta', id);
    const payA = e.target.closest('[data-pay]');
    if (payA) {
      const meP = derived().participants.find((p) => p.id === myId());
      if (payA.dataset.pay === '0' && meP) copyText(minorToInput(meP.total, S.data.currency));
      setTimeout(() => toast('Back here? Tap “I\'ve paid” once it goes through.', 3500), 800);
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const itemId = el.dataset.item;
    const current = itemId ? myClaims()[itemId] || 0 : 0;
    switch (el.dataset.act) {
      case 'toggle':
        setShares(itemId, current ? 0 : 1);
        break;
      case 'plus':
        setShares(itemId, current + 1);
        break;
      case 'minus':
        setShares(itemId, current - 1);
        break;
      case 'pay':
        personAction('paid', { paid: true });
        break;
      case 'unpay':
        personAction('paid', { paid: false });
        break;
      case 'confirm':
        personAction('confirm', { confirmed: true }, el.dataset.p);
        break;
      case 'unconfirm':
        personAction('confirm', { confirmed: false }, el.dataset.p);
        break;
      case 'copy-link':
        track('share', id, 'copy');
        toast((await copyText(shareUrl(id))) ? 'Link copied. Paste it in the group chat.' : shareUrl(id));
        break;
      case 'native-share':
        nativeShare();
        break;
      case 'copy-summary':
        track('share', id, 'summary');
        toast((await copyText(summaryText())) ? 'Summary copied.' : 'Could not copy.');
        break;
      case 'nudge': {
        const v = derived();
        const left = S.data.items.filter((it) => v.lines[it.id].unclaimed > 0).map((it) => it.name);
        const text = `Who had: ${left.join(', ')}? Tap it here: ${shareUrl(id)}`;
        track('share', id, 'nudge');
        if (canNativeShare()) {
          try {
            await navigator.share({ text });
          } catch {
            /* closed */
          }
        } else toast((await copyText(text)) ? 'Message copied. Paste it in the group.' : text, 3500);
        break;
      }
      case 'manage-link': {
        const s = session.get(id);
        const url = `${shareUrl(id)}#k=${s.admin}.${s.pid}.${s.token}`;
        toast((await copyText(url)) ? 'Private link copied. Keep it to yourself.' : 'Could not copy.', 3000);
        break;
      }
      default:
    }
  };

  const onSubmit = (e) => {
    if (e.target.id !== 'join-form') return;
    e.preventDefault();
    join(root.querySelector('#join-name').value);
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') load();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  document.addEventListener('visibilitychange', onVisible);
  S.pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !S.localClaims) load();
  }, POLL_MS);
  load(true);

  return () => {
    S.dead = true;
    clearInterval(S.pollTimer);
    clearTimeout(S.saveTimer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// "/s/abc#k=admin.pid.token" hands the payer's controls to another device.
function takeManageLinkFromHash(id) {
  const m = location.hash.match(/^#k=([A-Za-z0-9]+)\.([A-Za-z0-9]+)\.([A-Za-z0-9]+)$/);
  if (!m) return;
  session.set(id, { admin: m[1], pid: m[2], token: m[3] });
  history.replaceState({}, '', location.pathname + location.search);
}
