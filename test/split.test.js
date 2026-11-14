import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, computeSplit } from '../public/lib/split.js';
import { parseAmount, toMinor, formatMoney, currencyDigits } from '../public/lib/money.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test('allocate always sums to the amount exactly', () => {
  for (let trial = 0; trial < 500; trial++) {
    const amount = Math.floor(Math.random() * 1_000_000) - 200_000;
    const weights = Array.from({ length: 1 + (trial % 7) }, () => Math.floor(Math.random() * 1000));
    const parts = allocate(amount, weights);
    if (weights.some((w) => w > 0)) assert.equal(sum(parts), amount);
  }
});

test('allocate splits 100 three ways as 34/33/33', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(allocate(50, [0, 0]), [0, 50]); // no weight: last bucket takes it
});

const bill = {
  items: [
    { id: 'i1', name: 'Pizza', price: 60000, qty: 1 },
    { id: 'i2', name: 'Beer', price: 90000, qty: 3 },
    { id: 'i3', name: 'Salad', price: 30000, qty: 1 },
  ],
  extras: [
    { label: 'GST', amount: 9000 },
    { label: 'Service', amount: 18000 },
  ],
};

test('shared item is split between everyone who tapped it', () => {
  const people = [
    { id: 'a', claims: { i1: 1 } },
    { id: 'b', claims: { i1: 1 } },
    { id: 'c', claims: { i1: 1 } },
  ];
  const r = computeSplit(bill, people);
  assert.deepEqual(
    ['a', 'b', 'c'].map((id) => r.participants[id].subtotal),
    [20000, 20000, 20000],
  );
});

test('multi-quantity items bill per unit and leave the rest unclaimed', () => {
  const r = computeSplit(bill, [{ id: 'a', claims: { i2: 1 } }]);
  assert.equal(r.participants.a.subtotal, 30000);
  assert.equal(r.unclaimed.subtotal, 60000 + 60000 + 30000);
});

test('tax and service follow what you had, and the whole bill is accounted for', () => {
  const people = [
    { id: 'a', claims: { i1: 1, i2: 2 } },
    { id: 'b', claims: { i2: 1, i3: 1 } },
  ];
  const r = computeSplit(bill, people);
  assert.equal(r.participants.a.subtotal, 60000 + 60000);
  assert.equal(r.participants.b.subtotal, 30000 + 30000);
  assert.equal(r.unclaimed.total, 0);
  // a had 2/3 of the food, so pays 2/3 of the extras
  assert.equal(r.participants.a.extras, 18000);
  assert.equal(r.participants.b.extras, 9000);
  assert.equal(r.participants.a.total + r.participants.b.total, r.grandTotal);
  assert.equal(r.grandTotal, 180000 + 27000);
});

test('over-claimed items are divided by the number of shares', () => {
  const r = computeSplit(bill, [
    { id: 'a', claims: { i2: 2 } },
    { id: 'b', claims: { i2: 2 } },
  ]);
  assert.equal(r.participants.a.subtotal, 45000);
  assert.equal(r.participants.b.subtotal, 45000);
});

test('totals always reconcile with the bill (randomised)', () => {
  for (let trial = 0; trial < 300; trial++) {
    const items = Array.from({ length: 1 + (trial % 9) }, (_, i) => ({
      id: `i${i}`,
      price: Math.floor(Math.random() * 50000),
      qty: 1 + Math.floor(Math.random() * 4),
    }));
    const extras = [{ label: 'x', amount: Math.floor(Math.random() * 9000) - 3000 }];
    const people = Array.from({ length: 1 + (trial % 6) }, (_, p) => ({
      id: `p${p}`,
      claims: Object.fromEntries(
        items.filter(() => Math.random() < 0.5).map((it) => [it.id, 1 + Math.floor(Math.random() * it.qty)]),
      ),
    }));
    const r = computeSplit({ items, extras }, people);
    const paid = sum(people.map((p) => r.participants[p.id].total));
    assert.equal(paid + r.unclaimed.total, r.grandTotal);
  }
});

test('money parsing handles common formats', () => {
  assert.equal(parseAmount('1,234.50'), 1234.5);
  assert.equal(parseAmount('1.234,50'), 1234.5);
  assert.equal(parseAmount('2,40,000'), 240000);
  assert.equal(parseAmount('₹ 450'), 450);
  assert.equal(parseAmount('(100.00)'), -100);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.equal(toMinor('12.34', 'USD'), 1234);
  assert.equal(parseAmount('1.234'), 1234); // 3 digits after a lone separator = thousands
  assert.equal(toMinor('1.250', 'KWD'), 1250);
  assert.equal(currencyDigits('JPY'), 0);
  assert.equal(toMinor('1200', 'JPY'), 1200);
  assert.equal(formatMoney(258500, 'INR', 'en-IN'), '₹2,585');
  assert.equal(formatMoney(1250, 'USD', 'en-US'), '$12.50');
});
