// Optional: read a receipt photo with Claude. Enabled when ANTHROPIC_API_KEY is set.
// Without a key the browser falls back to on-device OCR (Tesseract) + our text parser.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { isSupportedCurrency } from '../public/lib/money.js';

const MODEL = 'claude-opus-5-5';
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64 = 7_000_000;

const Receipt = z.object({
  merchant: z.string().describe('Restaurant or shop name as printed, or "" if not visible'),
  currency: z
    .string()
    .describe('ISO 4217 code inferred from symbols, tax names or address (e.g. INR, USD, EUR), or "" if unsure'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Item name, cleaned up and readable'),
        quantity: z.number().int().describe('Units of this line, 1 if not printed'),
        line_total: z.number().describe('Total price of the whole line (not the unit price), in major units'),
      }),
    )
    .describe('Every food/drink/product line, in printed order'),
  extras: z
    .array(
      z.object({
        label: z.string().describe('As printed, e.g. "CGST 2.5%", "Service charge", "Tip", "Discount"'),
        amount: z.number().describe('Major units. Negative for discounts and round-off reductions'),
      }),
    )
    .describe('Taxes, service charges, tips, delivery fees, discounts and round-off lines'),
  total: z.number().describe('Grand total printed on the receipt in major units, or 0 if not visible'),
});

const SYSTEM = `You read photos of restaurant and shop receipts for a bill-splitting app.
Extract each purchased line exactly once with its line total. Put taxes, service charges, tips,
fees, discounts and round-off in "extras", never in "items". Skip subtotals, totals, payment
lines (cash, card, change), table numbers and addresses. If a line is unreadable, leave it out
rather than guessing.`;

export async function parseReceiptImage(body, env) {
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(501, 'AI receipt reading is not enabled on this server.');
  const mediaType = String(body?.mediaType || '');
  const data = String(body?.data || '');
  if (!MEDIA_TYPES.has(mediaType)) throw new HttpError(400, 'Upload a JPEG, PNG, WebP or GIF photo.');
  if (!data || data.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    throw new HttpError(400, 'That photo is empty or too large.');
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  let message;
  try {
    message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Receipt) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: 'Extract this receipt.' },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The receipt reader is busy. Try again in a moment.');
    if (err instanceof Anthropic.APIError) {
      console.error('anthropic error', err.status, err.message);
      throw new HttpError(502, 'The receipt reader is unavailable right now.');
    }
    throw err;
  }

  const out = message.stop_reason === 'refusal' ? null : message.parsed_output;
  if (!out) throw new HttpError(422, "Couldn't read that receipt. Try a sharper photo, or paste the text.");

  const code = String(out.currency).toUpperCase();
  const finite = (n) => (Number.isFinite(n) ? n : NaN);
  // Amounts stay in major units; the browser converts with the currency the payer picks.
  const items = out.items
    .map((it) => ({
      name: String(it.name).trim().slice(0, 80),
      qty: Math.min(99, Math.max(1, Math.round(it.quantity) || 1)),
      amount: finite(it.line_total),
    }))
    .filter((it) => it.name && it.amount >= 0);
  const extras = out.extras
    .map((e) => ({ label: String(e.label).trim().slice(0, 40), amount: finite(e.amount) }))
    .filter((e) => e.label && Number.isFinite(e.amount) && e.amount !== 0);

  return {
    source: 'claude',
    title: String(out.merchant).trim().slice(0, 80),
    currency: isSupportedCurrency(code) ? code : '',
    items,
    extras,
    total: Number.isFinite(out.total) ? out.total : 0,
  };
}
