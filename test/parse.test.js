import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, SAMPLE_RECEIPT } from '../public/lib/parse.js';

test('sample restaurant receipt parses into items, extras and total', () => {
  const r = parseReceipt(SAMPLE_RECEIPT);
  assert.equal(r.title, 'The Copper Kettle'); // ALL-CAPS receipt headers are title-cased
  assert.deepEqual(
    r.items.map((i) => [i.name, i.qty, i.amount]),
    [
      ['Paneer Tikka', 1, 340],
      ['Chicken 65', 1, 380],
      ['Butter Naan', 2, 120],
      ['Dal Makhani', 1, 290],
      ['Garlic Bread', 1, 180],
      ['Beer', 3, 900],
      ['Fresh Lime Soda', 1, 140],
    ],
  );
  assert.deepEqual(
    r.extras.map((e) => [e.label, e.amount]),
    [
      ['Service Charge 5%', 117.5],
      ['CGST 2.5%', 58.75],
      ['SGST 2.5%', 58.75],
    ],
  );
  assert.equal(r.total, 2585);
  const sum = r.items.reduce((a, i) => a + i.amount, 0) + r.extras.reduce((a, e) => a + e.amount, 0);
  assert.equal(sum, r.total);
});

test('quick typing works', () => {
  const r = parseReceipt('Pizza 450\nCoke x2 120\n3 Tacos 9.75\nTip 50\nDiscount 40');
  assert.deepEqual(
    r.items.map((i) => [i.name, i.qty, i.amount]),
    [
      ['Pizza', 1, 450],
      ['Coke', 2, 120],
      ['Tacos', 3, 9.75],
    ],
  );
  assert.deepEqual(r.extras, [
    { label: 'Tip', amount: 50 },
    { label: 'Discount', amount: -40 },
  ]);
});

test('US style receipt with tax codes and payment lines', () => {
  const r = parseReceipt(`Joe's Diner
Burger            12.99 A
Fries              4.50 A
Milkshake          6.25
SUBTOTAL          23.74
Sales Tax 8.875%   2.11
TOTAL             25.85
VISA ****1234     25.85
CHANGE             0.00`);
  assert.deepEqual(r.items.map((i) => i.name), ['Burger', 'Fries', 'Milkshake']);
  assert.deepEqual(r.extras, [{ label: 'Sales Tax 8.875%', amount: 2.11 }]);
  assert.equal(r.total, 25.85);
});

test('european decimal commas', () => {
  const r = parseReceipt('Café Lumière\nCroissant 2,80\nCafé crème 3,50\nTotal 6,30');
  assert.deepEqual(r.items.map((i) => i.amount), [2.8, 3.5]);
  assert.equal(r.total, 6.3);
});
