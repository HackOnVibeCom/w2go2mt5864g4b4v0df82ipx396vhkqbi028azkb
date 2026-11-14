// The split engine: who owes what, exactly, down to the last paisa/cent.
// Shared by the browser (instant feedback while tapping) and the server (source of truth).

// Split an integer `amount` across `weights` so the parts are proportional
// and always sum to exactly `amount` (largest-remainder method).
export function allocate(amount, weights) {
  const n = weights.length;
  const out = new Array(n).fill(0);
  if (n === 0 || amount === 0) return out;
  if (amount < 0) return allocate(-amount, weights).map((v) => (v === 0 ? 0 : -v));

  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = clean.reduce((a, w) => a + w, 0);
  if (total <= 0) {
    out[n - 1] = amount;
    return out;
  }

  let assigned = 0;
  const remainders = [];
  for (let i = 0; i < n; i++) {
    if (clean[i] === 0) continue;
    const exact = (amount * clean[i]) / total;
    const floor = Math.floor(exact);
    out[i] = floor;
    assigned += floor;
    remainders.push([exact - floor, i]);
  }
  remainders.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; assigned < amount; k++) {
    out[remainders[k % remainders.length][1]] += 1;
    assigned += 1;
  }
  return out;
}

// split: { items: [{ id, name, price, qty }], extras: [{ label, amount }] }
// participants: [{ id, claims: { [itemId]: shares } }]
//
// Item rule: an item with quantity q and S claimed shares is divided into
// max(q, S) equal parts. So a single pizza tapped by 3 people is split 3 ways,
// while "Beer x3" tapped once leaves 2 beers unclaimed instead of billing
// one person for all three.
//
// Extras (tax, service, tip, discounts) are divided in proportion to what each
// person had, with the unclaimed remainder carrying its own share.
export function computeSplit(split, participants) {
  const per = {};
  for (const p of participants) per[p.id] = { subtotal: 0, extras: 0, total: 0 };

  let unclaimedSubtotal = 0;
  const items = split.items.map((item) => {
    const claimers = participants
      .map((p) => ({ id: p.id, shares: sharesOf(p, item.id) }))
      .filter((c) => c.shares > 0);
    const claimed = claimers.reduce((a, c) => a + c.shares, 0);
    const qty = Math.max(1, item.qty | 0);
    const parts = Math.max(qty, claimed);
    const amounts = allocate(item.price, [...claimers.map((c) => c.shares), parts - claimed]);
    claimers.forEach((c, i) => {
      c.amount = amounts[i];
      per[c.id].subtotal += amounts[i];
    });
    const unclaimed = amounts[amounts.length - 1];
    unclaimedSubtotal += unclaimed;
    return { id: item.id, qty, claimedShares: claimed, unclaimed, claimers };
  });

  const ids = participants.map((p) => p.id);
  const extrasTotal = split.extras.reduce((a, e) => a + e.amount, 0);
  const extraParts = allocate(extrasTotal, [
    ...ids.map((id) => per[id].subtotal),
    unclaimedSubtotal,
  ]);
  ids.forEach((id, i) => {
    per[id].extras = extraParts[i];
    per[id].total = per[id].subtotal + extraParts[i];
  });
  const unclaimedExtras = extraParts[extraParts.length - 1];
  const subtotal = split.items.reduce((a, it) => a + it.price, 0);

  return {
    items,
    participants: per,
    unclaimed: {
      subtotal: unclaimedSubtotal,
      extras: unclaimedExtras,
      total: unclaimedSubtotal + unclaimedExtras,
    },
    subtotal,
    extrasTotal,
    grandTotal: subtotal + extrasTotal,
  };
}

function sharesOf(participant, itemId) {
  const v = participant.claims ? participant.claims[itemId] : 0;
  return Number.isInteger(v) && v > 0 ? v : 0;
}
