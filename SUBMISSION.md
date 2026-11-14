# Tapsplit: HackOnVibe submission kit

The questionnaire questions are posted in Discord, so the answers below cover the usual ones. Each answer is under 300 characters; `npm run check:answers` confirms it. Live link: https://tapsplit.tameimpala.workers.dev

## Questionnaire answers

**Project name**
Tapsplit

**One-line pitch**
Snap the bill, share one link, everyone taps what they had. Exact shares with tax and tip, one-tap pay back, no app and no sign-up.

**Live link / where to test**
Open https://tapsplit.tameimpala.workers.dev, tap "Try a sample bill", then tap "Create split & get link". Open the link in a private window as a friend, tap items, then "I've paid".

**What problem does it solve?**
After a group dinner one person pays and then chases everyone. Splitting evenly is unfair to the person who had only soup, and itemising by hand in a chat takes ages. Tapsplit makes the fair split take 30 seconds and shows who still owes.

**Who is it for?**
Anyone who eats out with friends, colleagues or family: students, office lunch groups, trips, flatmates. Every person at the table needs it, and every one of them is the next person to pay the bill.

**How does it spread with zero CAC?**
It can't be used alone: the payer must share the link to get paid, so every split reaches 2–8 new people at the moment they feel the problem. Link previews show the bill; every page offers "Split your own bill" with referral tracking.

**What already works?**
Scan, paste or type a bill; exact split engine with shared items and prorated tax/tip; live tapping for the whole table; one-tap UPI, PayPal, Venmo and Cash App links; payer confirms money received; live growth dashboard with K-factor.

**Which function should judges test?**
The split itself: create a sample bill, open the share link in a second window, join as a friend and tap items. Your share (with tax and tip) appears at once, and the payer's board updates within seconds.

**Business model**
Free for people; the loop is the acquisition. Revenue: affiliate fees from wallets and remittance apps on pay-back taps; a per-outlet SaaS where restaurants print a "Split with Tapsplit" QR from their POS; a Plus tier for trip and flat balances.

**How will you measure success?**
The /growth page shows live, unseeded numbers: splits created, people reached per split, the share who create their own split, the viral coefficient K, referral-chain depth and money settled. K above 1 means each split brings more than one new split.

**Tech stack / architecture**
Vanilla JS front end with no build step; a platform-neutral JSON API on Cloudflare Workers with D1 (SQLite), plus a Node + SQLite build for self-hosting. On-device OCR (Tesseract.js), optional Claude vision. 16 automated tests.

**What is AI-assisted about it?**
Built end to end with Claude Code. In the product, receipts are read by Claude vision into structured line items when an API key is set, and by on-device OCR plus our receipt parser otherwise, so scanning works with no key and no cost.

**Why will people keep using it?**
Every group meal ends with a bill. Tapsplit removes the awkward chasing, keeps a record of who paid, and needs nothing installed, so it is the easiest thing to reach for next time. Each friend who used it once can start the next split.

**Can anyone in the world use it?**
Yes. It runs in any phone browser, needs no account, handles 48 currencies with correct decimals, reads receipts in any layout and links to local payment apps (UPI in India, Venmo and Cash App in the US, Revolut and Wise in Europe).

**What's next?**
Restaurant QR pilots, WhatsApp-first sharing tweaks, running balances for trips and flatmates, and more pay-back rails (Pix, M-Pesa, GCash).

## 5-minute video script: the successful client path

Record on a phone-sized browser window (or a real phone) so the taps are visible. No market overview, only the path.

| Time | Screen | What you do and say |
| --- | --- | --- |
| 0:00–0:20 | Home page | "This is Tapsplit. One person paid for dinner; we'll split it fairly in under a minute, with no app and no sign-up." |
| 0:20–0:50 | Home, Scan tab | Tap **Scan photo** and photograph a real bill (or skip to the sample). Show items appearing. "The receipt becomes line items, and the total is checked against the printed one." |
| 0:50–1:20 | Home | Tap **Try a sample bill**. Point at the 7 items, service charge and taxes, and the green "Matches the receipt total of ₹2,585" check. |
| 1:20–1:50 | Who paid? | Type "Asha", pick **UPI**, enter a handle such as `asha@okbank`. Tap **Create split & get link**. |
| 1:50–2:20 | Split page (payer) | "This is the link I drop in the group chat." Show WhatsApp / Telegram / Copy. Tap Dal and one Beer: "My share, tax and tip included: ₹649." |
| 2:20–3:10 | Second window (friend) | Paste the link in a private window. Type "Ravi", tap **Start tapping**. Tap Paneer, one Butter Naan, one Beer. "Ravi owes ₹770: ₹700 of food plus his fair share of service and tax." |
| 3:10–3:40 | Friend: pay bar | Show the **Pay Asha** button: it opens UPI with ₹770 already filled in. Tap **I've paid**. |
| 3:40–4:10 | Payer window | Board shows Ravi as "says paid" within seconds. Tap **Got it**. Point at the progress meter and the unclaimed row. |
| 4:10–4:40 | Friend window | Scroll to **Paying next time? Split your own bill**, tap it. "Every friend who joins is one tap from starting their own split." |
| 4:40–5:00 | Live stats | Open **Live stats**: splits, people reached, K-factor, referral chain. "Every number here is real usage." End. |

Before recording: open https://tapsplit.tameimpala.workers.dev once to warm it up. Use a normal window for the payer and a private window (or a phone) for the friend, so they are two different people. Live stats count everyone's real usage, so the numbers you show will include earlier splits.
