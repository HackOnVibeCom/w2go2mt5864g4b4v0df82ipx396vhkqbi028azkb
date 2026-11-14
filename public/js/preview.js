import { money } from './core.js';
import { computeSplit } from '../lib/split.js';

const currency = 'INR';
const bill = {
  items: [
    { id: 'pizza', name: 'Margherita pizza', price: 64000, qty: 1 },
    { id: 'fries', name: 'Masala fries', price: 24000, qty: 1 },
    { id: 'soda', name: 'Lime soda', price: 12000, qty: 1 },
  ],
  extras: [{ label: 'Tax and service', amount: 10000 }],
};

const format = (amount) => money(amount, currency);
const samplePayer = { id: 'asha', claims: { pizza: 1, fries: 1, soda: 1 } };
const sample = computeSplit(bill, [samplePayer, { id: 'ravi', claims: { pizza: 1 } }]);

export function landingPreview() {
  return `
    <div class="landing-visual">
      <div class="visual-receipt">
        <header class="visual-top">
          <div><p>Friday dinner</p><span>Paid by Asha</span></div>
          <strong>${format(sample.grandTotal)}</strong>
        </header>
        <div class="visual-rows">
          ${bill.items.map((item, index) => `
            <div class="visual-line">
              <span class="demo-tick ${index === 0 ? 'selected' : ''}" aria-hidden="true">${index === 0 ? '✓' : ''}</span>
              <span>${item.name}${index === 0 ? '<small>Shared by Asha and Ravi</small>' : ''}</span>
              <span class="mono">${format(item.price)}</span>
            </div>`).join('')}
        </div>
        <div class="visual-total"><span>Ravi’s share <small>Includes tax and service</small></span><strong class="mono">${format(sample.participants.ravi.total)}</strong></div>
      </div>
    </div>
    <dialog class="preview-dialog" id="preview-dialog" aria-labelledby="preview-title">
      <header class="preview-top">
        <div><h2 id="preview-title">Friday dinner</h2><p class="small muted">Practice bill · No money moves</p></div>
        <form method="dialog"><button class="icon-btn" aria-label="Close demo">×</button></form>
      </header>
      <div id="preview-stage"></div>
    </dialog>`;
}

export function mountPreview(root, options) {
  const stage = root.querySelector('#preview-stage');
  const guest = { id: 'ravi', claims: {} };
  let phase = 'claim';

  function render(focus) {
    const split = computeSplit(bill, [samplePayer, guest]);
    const guestTotal = split.participants.ravi.total;
    const next = {
      claim: { text: 'Switch to Asha to finalize', hint: 'You’re Ravi. Tap at least one item you shared with Asha.', disabled: guestTotal === 0 },
      finalize: { text: 'Finalize shares', hint: 'You’re Asha. Lock everyone’s share so Ravi can pay.' },
      pay: { text: 'Mark sample payment sent', hint: 'You’re Ravi again. Your share is fixed.' },
      confirm: { text: 'Confirm sample payment received', hint: 'You’re Asha. Ravi marked his share as paid.' },
    }[phase];
    stage.innerHTML = `
      <div class="preview-role" ${next ? '' : 'tabindex="-1"'}>${next?.hint ?? `Asha confirmed receiving ${format(guestTotal)} from Ravi.`}</div>
      ${phase === 'claim' ? `<div class="visual-rows">${bill.items.map((item) => `
        <button type="button" class="visual-line preview-line" data-preview-item="${item.id}" aria-pressed="${Boolean(guest.claims[item.id])}">
          <span class="demo-tick ${guest.claims[item.id] ? 'selected' : ''}" aria-hidden="true">${guest.claims[item.id] ? '✓' : ''}</span>
          <span>${item.name}</span><span class="mono">${format(item.price)}</span>
        </button>`).join('')}</div>` : ''}
      <div class="visual-total" role="status"><span>${phase === 'claim' ? 'Ravi’s estimated share' : 'Ravi’s final share'} <small>Includes tax and service</small></span><strong class="mono">${format(guestTotal)}</strong></div>
      <div class="preview-actions">
        ${next
          ? `<button class="btn primary" type="button" data-preview-next ${next.disabled ? 'disabled' : ''}>${next.text}</button>`
          : '<button class="btn primary" type="button" data-act="start" data-preview-create>Split my own bill</button>'}
        ${phase === 'claim' ? '' : '<button class="btn" type="button" data-preview-reset>Restart demo</button>'}
      </div>`;
    if (focus) stage.querySelector(focus)?.focus();
  }

  stage.addEventListener('click', (event) => {
    const item = event.target.closest('[data-preview-item]');
    if (item) {
      const id = item.dataset.previewItem;
      if (guest.claims[id]) delete guest.claims[id];
      else guest.claims[id] = 1;
      render(`[data-preview-item="${id}"]`);
    } else if (event.target.closest('[data-preview-next]')) {
      phase = { claim: 'finalize', finalize: 'pay', pay: 'confirm', confirm: 'done' }[phase];
      render(phase === 'done' ? '.preview-role' : '[data-preview-next]');
    } else if (event.target.closest('[data-preview-reset]')) {
      phase = 'claim';
      guest.claims = {};
      render('[data-preview-item]');
    } else if (event.target.closest('[data-preview-create]')) {
      root.querySelector('#preview-dialog').close();
    }
  }, options);

  render();
}
