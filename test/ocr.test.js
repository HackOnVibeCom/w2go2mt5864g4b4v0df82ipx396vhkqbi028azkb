// Real OCR output is messy: these tests pin down how the parser copes with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReceipt, mergeReadings, addsUp, SAMPLE_RECEIPT } from '../public/lib/parse.js';

const { passes } = JSON.parse(readFileSync(new URL('./fixtures/bangkok-receipt-ocr.json', import.meta.url), 'utf8'));
const ITEMS = [
  ['CHICKEN MALAI TIKKA', 1, 240],
  ['STUFFED PARATHA (ON', 1, 80],
  ['GULAB JAMUN WITH ICE', 1, 160],
  ['GREY GOOSE', 1, 190],
  ['GLASS WINE', 3, 450],
];
const rows = (r) => r.items.map((i) => [i.name, i.qty, i.amount]);

test('bilingual receipt: item names lose OCR junk and a quantity read as "i" or "|" counts as 1', () => {
  for (const text of passes) assert.deepEqual(rows(parseReceipt(text)), ITEMS);
});

test('a reading that lost the tax line is flagged, not trusted', () => {
  const r = parseReceipt(passes[0]); // "dot py   7%   8." is all that is left of VAT 7% 78.40
  assert.deepEqual(r.extras, []);
  assert.ok(r.unread > 0);
});

test('a garbled tax amount is rebuilt from its percentage when the readable digits fit', () => {
  for (const text of [passes[1], passes[2]]) {
    // "NE YRANUNY  VAT 7%  [8.40" and "ME yaa RY  VAT 7%  J8.4(": 7% of 1,120.00 is 78.40
    assert.deepEqual(parseReceipt(text).extras, [{ label: 'VAT 7%', amount: 78.4 }]);
  }
});

test('an unreadable grand total is taken from the payment line when the bill adds up to it', () => {
  const r = parseReceipt(passes[1]); // "Grand Total" lost its amount; "Cash 1,198.40" survived
  assert.equal(r.total, 1198.4);
  assert.ok(addsUp(r));
  assert.equal(r.title, 'Champagne');
  assert.equal(r.currency, 'THB');
});

test('a plain Total printed above the tax lines is treated as the subtotal', () => {
  const r = parseReceipt(passes[2]);
  assert.equal(r.total, 0);
  assert.equal(r.subtotal, 1120);
});

test('merging the scanner passes keeps the reading that adds up', () => {
  const r = mergeReadings(passes.map((t) => parseReceipt(t)));
  assert.deepEqual(rows(r), ITEMS);
  assert.deepEqual(r.extras, [{ label: 'VAT 7%', amount: 78.4 }]);
  assert.equal(r.total, 1198.4);
});

test('merging borrows a grand total another pass read, only if the bill then adds up', () => {
  const a = parseReceipt('Pizza 450\nCoke 120\nSub Total 570\nGST 5% 28.50\nGrand Total');
  const b = parseReceipt('Pizza 450\nCoke 120\nSub Total 570\nGrand Total 598.50');
  assert.equal(mergeReadings([a, b]).total, 598.5);
  const wrong = parseReceipt('Pizza 450\nCoke 120\nGrand Total 999.00');
  assert.equal(mergeReadings([a, wrong]).total, a.total);
});

test('tax labels keep real qualifiers and drop noise from another script', () => {
  const r = parseReceipt('Thali 300\nMIyaaAN VAT 7% 21.00\nSales Tax 8.875% 2.11\nLate night surcharge 50\nHappy hour discount 30');
  assert.deepEqual(
    r.extras.map((e) => e.label),
    ['VAT 7%', 'Sales Tax 8.875%', 'Late night surcharge', 'Discount'],
  );
});

test('currency is guessed from the receipt when it says so', () => {
  assert.equal(parseReceipt(SAMPLE_RECEIPT).currency, 'INR');
  assert.equal(parseReceipt('Cafe Lumiere\nCroissant €2,80').currency, 'EUR');
  assert.equal(parseReceipt('Diner\nBurger $12.99').currency, '');
});
