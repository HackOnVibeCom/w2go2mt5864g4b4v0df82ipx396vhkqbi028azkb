# Tapsplit

**Snap the bill. Share one link. Everyone taps what they had.**

Tapsplit splits a restaurant bill by what each person actually ate, tax and tip included, down to the last paisa or cent. The person who paid snaps the receipt and drops one link in the group chat. Friends open it in their browser (no app, no sign-up), tap their items, see their exact share and pay back in one tap. The payer watches the board fill up and ticks off who has paid.

Built for HackOnVibe November 2026, theme **Zero-CAC IT product**.

## Try it (2 minutes, no account)

1. Open the app and tap **Try a sample bill** (or scan a real receipt).
2. Check the items, type your name, pick how friends pay you (UPI, PayPal, Venmo, Cash App, Revolut, Wise, any link, or just track it). Tap **Create split & get link**.
3. Copy the link and open it in a private window or on your phone. You are now a friend: type a name and tap a few items. Your share updates instantly. Shared dishes split between everyone who tapped them, and "Beer ×3" bills per glass.
4. Tap **I've paid**. Back in the first window, the payer's board updates within seconds; tap **Got it** to confirm.
5. As the friend, tap **Split your own bill**, then open **Live stats** to watch that referral show up in the growth loop.

## Why it spreads on its own (zero CAC)

Tapsplit can't be used alone. Every split needs everyone at the table to open the link, so **each use puts the product in front of 2–8 new people** at the moment they feel the problem. And every one of them is the next person to pay for dinner.

- **Built-in invite:** the payer *has* to share the link to get paid back. Sharing is the core action, not a growth hack.
- **No friction for the invitee:** a link, a name, a few taps. No install, no account, no password.
- **Link previews sell it:** a link in WhatsApp or Telegram reads *"Asha paid ₹2,585 at The Copper Kettle"*, with a preview card.
- **Every page carries the next loop:** after paying, friends see *"Paying next time? Split your own bill"*, which tags the new split with its parent.
- **It measures itself:** `/growth` shows the live viral coefficient (K = people reached per split × share of them who create their own split), the referral-chain depth and the funnel, computed from real usage only. No seeded numbers.

## What works today

| Feature | Notes |
| --- | --- |
| Add a bill 3 ways | Photo scan, paste receipt text, or type items |
| Receipt reading | On-device OCR (Tesseract.js) plus our parser by default; Claude vision when `ANTHROPIC_API_KEY` is set, falling back to on-device OCR if it is unavailable |
| Check against the printed total | Warns when the lines don't add up to the receipt's grand total |
| Exact split engine | Shared items, per-unit quantities, tax/service/tip/discount prorated by what you had, largest-remainder rounding, so shares always add up to the bill exactly |
| Live tapping | Optimistic updates, auto-save, 4-second sync, initials on each item so nobody double-claims |
| Pay back in one tap | UPI, PayPal.me, Venmo and Cash App links open with the amount filled in. Revolut, Wise or any custom link open the payer's page |
| Payer board | Who owes what, who says they paid, confirm received, unclaimed items, "who had this?" nudge, copyable summary |
| Any currency | 48 currencies in the picker, each with its correct decimals (no paise-style decimals for JPY or KRW), auto-detected from your time zone |
| Growth dashboard | K-factor, funnel, referral chains, share channels, money settled, 14-day activity |
| Works everywhere | Mobile-first, light and dark mode, any modern browser |

## Business model

Free for people, always: the free loop is the acquisition engine.

1. **Payment routing fees.** "Pay back" taps are high-intent payment moments. Partner wallets and remittance apps pay per activated payer or transaction (affiliate and referral programmes already exist at PayPal, Wise, Revolut and others).
2. **Restaurants (B2B SaaS).** A "Split with Tapsplit" QR printed on the bill: the restaurant's POS pushes the itemised bill, so nobody types anything, and tables settle faster. Priced per outlet per month.
3. **Tapsplit Plus** for frequent organisers (trips, flatmates, office lunches): running balances across bills, reminders, exports.

## Architecture

```
public/            Static frontend: vanilla JS modules, no build step
  lib/split.js     Split engine (shared by browser and server)
  lib/parse.js     Receipt text parser
  lib/money.js     Currency-aware amounts in integer minor units
  lib/pay.js       Pay-back deep links
  js/              Views: create, split, growth; OCR scanner
src/
  api.js           JSON API (Web Request → Response), platform neutral
  worker.js        Cloudflare Workers entry (D1 + static assets)
  node-server.js   Node entry (built-in SQLite) for dev, tests, self-hosting
  d1-sqlite.js     D1-compatible wrapper over node:sqlite
  ai.js            Optional Claude receipt reading
  shell.js         Link-preview meta tags for /s/:id
migrations/        SQL schema (D1 and SQLite)
test/              node:test suites: split math, parser, API end to end
```

- **Storage:** SQLite (Cloudflare D1 in production). Splits, participants with their claims, and anonymous events for the growth loop.
- **No accounts:** the creator gets an admin token and each participant a personal token, kept in their browser. A private "manage link" moves the payer's controls to another device.
- **Privacy:** only a random visitor ID is stored for analytics. A split is visible only to people with its unguessable link.

## Run locally

Requires Node 22.13 or newer.

```bash
npm install
npm run dev     # http://localhost:8787
npm test        # 16 tests: split math, receipt parsing, full API flow
```

Optional AI receipt reading: `ANTHROPIC_API_KEY=... npm run dev`.

## Deploy (Cloudflare Workers, free plan)

```bash
npx wrangler login
npm run cf:setup     # creates the D1 database and applies the schema
npm run cf:deploy    # deploys and saves the URL to deploy.config.json
```

Optional: `npx wrangler secret put ANTHROPIC_API_KEY`.

The HackOnVibe team subdomain hosts static files only. Pushing to `main` runs `npm run build`, which copies `public/` to `dist/` and points it at the Worker URL saved in `deploy.config.json`.
