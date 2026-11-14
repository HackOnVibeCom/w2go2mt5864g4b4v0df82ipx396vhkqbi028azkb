# Tapsplit: HackOnVibe submission kit

The questionnaire questions are posted in Discord, so the answers below cover the usual ones. Each answer is under 300 characters; `npm run check:answers` confirms it. Live link: https://tapsplit.tameimpala.workers.dev

## Questionnaire answers

**Project name**
Tapsplit

**One-line pitch**
Snap the bill, share one link, everyone taps what they had. Exact shares with tax and tip, one-tap pay back, no app and no sign-up.

**Live link / where to test**
Open https://tapsplit.tameimpala.workers.dev and tap "Try the interactive demo" to try both roles in one browser. To test the live flow, create a sample bill and open its shared link in a private window.

**What problem does it solve?**
After a group dinner one person pays and then chases everyone. Splitting evenly is unfair to the person who had only soup, and itemising by hand in a chat takes ages. Tapsplit makes the fair split take 30 seconds and shows who still owes.

**Who is it for?**
Anyone who eats out with friends, colleagues or family: students, office lunch groups, trips, flatmates. Every person at the table needs it, and every one of them is the next person to pay the bill.

**How does it spread with zero CAC?**
The payer shares one link so friends can claim their items and pay. Each guest sees the product while using it and can start a bill of their own from that page. Tapsplit measures how often invitees become creators.

**What already works?**
Scan, paste or type a bill. Friends share items and see live estimates with tax and tip. The payer locks the amounts, friends pay externally and the payer confirms receipt. Live stats track referrals and confirmations.

**Which function should judges test?**
Tap an item in the interactive demo and watch the price change. Switch to the payer to lock shares, then mark the practice payment and confirm it. The live app uses the same split engine.

**Business model**
Free for people; the loop is the acquisition. Revenue: affiliate fees from wallets and remittance apps on pay-back taps; a per-outlet SaaS where restaurants print a "Split with Tapsplit" QR from their POS; a Plus tier for trip and flat balances.

**How will you measure success?**
Live stats shows bills created, guest browsers reached, creators who followed a referral link, an estimated viral coefficient, and payment amounts confirmed by the payer. Practice activity stays out of those numbers.

**Tech stack / architecture**
Vanilla JavaScript, Cloudflare Workers and D1, with Node and SQLite for self-hosting. The browser and API share one split engine. Tesseract.js provides on-device OCR, with optional Claude vision.

**What is AI-assisted about it?**
Built end to end with Claude Code. In the product, receipts are read by Claude vision into structured line items when an API key is set, and by on-device OCR plus our receipt parser otherwise, so scanning works with no key and no cost.

**Why will people keep using it?**
Every group meal ends with a bill. Tapsplit removes the awkward chasing, keeps a record of who paid, and needs nothing installed, so it is the easiest thing to reach for next time. Each friend who used it once can start the next split.

**Can anyone in the world use it?**
It runs in modern phone browsers, needs no account and supports 48 currencies. Check scanned items before sharing, or type them in. Use a supported local payment app or track payments made separately.

**What's next?**
Restaurant QR pilots, WhatsApp-first sharing tweaks, running balances for trips and flatmates, and more pay-back rails (Pix, M-Pesa, GCash).

## 5-minute video script: the successful client path

Record on a phone-sized browser window (or a real phone) so the taps are visible. No market overview, only the path.

| Time | Screen | What you do and say |
| --- | --- | --- |
| 0:00–0:40 | Home | Open **Try the interactive demo**. Tap pizza as Ravi and show his ₹352 share, then switch to Asha and finalize. Mark and confirm the practice payment. |
| 0:40–1:15 | Bill editor | Close the demo, tap **Try a sample bill** and point out the ₹2,585 receipt check. Enter Asha's name, choose **Just track it**, and create the bill. |
| 1:15–1:45 | Payer window | Show **Copy link** and WhatsApp. Open the link in a private window as Ravi. |
| 1:45–2:40 | Guest and payer windows | As Ravi, tap Paneer, one naan and one beer. As Asha, claim the remaining items, including one naan and two beers. Check that the ₹2,585 is fully claimed. |
| 2:40–3:15 | Payer window | Tap **Finalize shares** and show the option to send the same link back to the group. |
| 3:15–4:00 | Guest and payer windows | Show Ravi's ₹770 final share. In this test bill, demonstrate the **I've paid** and **Got it** controls. |
| 4:00–5:00 | Guest and Live stats | As Ravi, tap **Split your own bill** and create a bill. Open **Live stats** and point out the referrals and payer-confirmed payments. |

Before recording: open https://tapsplit.tameimpala.workers.dev once to warm it up. Use a normal window for the payer and a private window (or a phone) for the friend, so they are two different people. Live stats count everyone's real usage, so the numbers you show will include earlier splits.
