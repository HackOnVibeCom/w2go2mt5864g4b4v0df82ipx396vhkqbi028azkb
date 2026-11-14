# Tapsplit: HackOnVibe submission kit

Everything the Submission tab asks for. Each answer is between 1 and 300 characters; `npm run check:answers` confirms it.

**Project link:** https://tapsplit.tameimpala.workers.dev

## Questionnaire answers

**What does your application/service do?**
Tapsplit splits a group bill by what each person actually had. The payer scans or pastes the receipt and shares one link; friends open it in the browser, tap their items and see their exact share with tax and tip. The payer locks the shares, friends pay back, the payer confirms. No app, no sign-up.

**Who is the target audience?**
People who eat out, travel or live together: students, colleagues at team lunches, friends on trips, flatmates, mostly 18–35 and phone-first. The payer starts a bill; everyone else at the table joins through the link, and each of them can start the next one.

**Which countries are the expected buyers of this service?**
India first: UPI makes paying back a single tap and group meals are frequent. Then the US, UK, EU, UAE and Singapore, where it links to PayPal, Venmo, Cash App, Revolut and Wise. People use it free; paying buyers are restaurants (a QR on the bill) and payment-app partners.

**Who are your competitors?**
Splitwise, Tricount and Settle Up track shared expenses, but itemising a receipt is manual or a paid extra and the group lives in their app. Google Pay, PhonePe and Venmo splits are mostly even or typed amounts. Pay-at-table tools such as Sunday need each restaurant to sign up.

**What is your advantage?**
Nothing to install and no account: one link, a name, a few taps. Exact per-item shares with tax and tip prorated, and the payer locks the amounts before anyone pays. Every bill shows Tapsplit to the whole table and each guest can start their own, so it grows with zero ad spend.

## Customer-journey video (4:49)

The video shows two windows side by side: the payer (Asha, normal window) on the left and a friend (Ravi, private window) on the right, with a calm voice-over. A judge can repeat these steps exactly.

| Time | Window | What to click |
| --- | --- | --- |
| 0:00 | — | What Tapsplit is and why it exists. |
| 0:22 | Payer | Open https://tapsplit.tameimpala.workers.dev. The home page has two ways in: **Split a bill** and **Try the interactive demo**. |
| 0:34 | Payer | Click **Try the interactive demo**. Tap **Margherita pizza**, then **Switch to Asha to finalize**, **Finalize shares**, **Mark sample payment sent**, **Confirm sample payment received**. Close it with **×**. |
| 0:56 | Payer | Click **Split a bill**. The bill can come from **Scan photo**, **Paste text** or **Type items**. |
| 1:07 | Payer | **Scan photo** reads a real receipt on the phone: here a Thai and English bill from Bangkok comes out as 5 items, VAT 7% and THB 1,198.40, matching the printed total. To follow along without a photo, click **Try a sample bill**. |
| 1:32 | Payer | Check the items: 7 lines plus service and taxes, matching the printed ₹2,585. |
| 1:46 | Payer | Under **Who paid?** type **Asha**. **Friends pay you with** offers UPI, PayPal, Venmo, Cash App, Revolut, Wise or a link; keep **Just track it**. Click **Create split & get link**. |
| 2:06 | Payer | Click **Copy link**. |
| 2:16 | Payer | Asha taps **Dal Makhani** and one **Beer**. |
| 2:28 | Friend | Open the link in a private window. Type **Ravi**, click **Start tapping**. Tap **Paneer Tikka**, one **Butter Naan**, one **Beer**. |
| 2:46 | Friend | Ravi's estimated share: ₹770, including his part of the service charge and taxes. |
| 2:59 | Payer | Ravi's taps appear live. **Finalize shares** stays off until everything is claimed. Asha taps **Chicken 65**, the other **Butter Naan**, **Garlic Bread**, the second **Beer** (+) and **Fresh Lime Soda**. |
| 3:19 | Payer | Click **Finalize shares**. |
| 3:33 | Friend | Ravi's share is final and the items are locked. Click **I've paid**. |
| 3:46 | Payer | Click **Got it** next to Ravi. |
| 3:57 | Friend | Click **Split your own bill**, then **Split a bill**, **Try a sample bill** and **Create split & get link**: Ravi's own split. |
| 4:12 | Payer | Click **Live stats**: bills, guests reached, referred splits, referral chain and the viral coefficient. |
| 4:32 | — | Recap and the link. |

Live stats count everyone's real usage, so a judge will see different numbers from the video.

### YouTube upload

- **Title:** Tapsplit: customer journey (HackOnVibe 2026)
- **Visibility:** Unlisted or Public, not Private (judges must be able to open it).
- **Description** (paste as is; one timestamp per line lets YouTube make chapters):

```
Tapsplit splits a group bill by what each person had. One link, no app, no sign-up.
Try it: https://tapsplit.tameimpala.workers.dev

0:00 Intro
0:22 Home page
0:34 Interactive demo
0:56 Add a bill
1:07 Scan a receipt
1:46 Who paid
2:06 Share the link
2:28 A friend joins
2:59 Claim the rest
3:19 Finalize shares
3:33 Friend pays
3:46 Payer confirms
3:57 The growth loop
4:12 Live stats
```

## DoraHacks BUIDL: "Describe your Build"

Paste everything inside the block. Replace PASTE_YOUTUBE_LINK with the video URL first.

````markdown
# Tapsplit

**Snap the bill. Share one link. Everyone taps what they had.**

**Live app:** https://tapsplit.tameimpala.workers.dev (no account, no install)
**Customer journey video (4:49):** PASTE_YOUTUBE_LINK

## The problem

At the end of a group dinner, one person pays the whole bill. Then they have to work out who had what, add everyone's part of the tax and service charge, and chase each friend to pay back. Splitting evenly is unfair to whoever only had a soda. Expense apps make you type every line by hand and get the whole group to install the same app first. So most groups do rough maths in the chat, and the payer usually ends up out of pocket.

## How it works

1. **Add the bill.** Scan a photo of the receipt, paste its text, or type the items. Tapsplit checks that the lines add up to the total printed on the receipt.
2. **Share one link.** The payer drops it in WhatsApp or any group chat.
3. **Friends tap what they had.** They open the link in the browser, type a name and tap their items. Shared dishes split between everyone who tapped them, and "Beer ×3" splits per bottle. Each person sees their exact share, with tax, service and tip shared in proportion to what they had.
4. **Lock the shares.** When every item is claimed, the payer taps **Finalize shares**, so nobody pays an estimate that later changes.
5. **Settle up.** Friends pay with one tap and mark **I've paid**. The payer confirms with **Got it**.
6. **Start the next one.** After paying, each friend sees "Paying next time? Split your own bill", and their new split is linked to this one.

## Key features

- **Receipt scanning on the phone.** On-device OCR enlarges small photos, reads the photo again with different settings if the lines don't add up to the printed total, rebuilds a garbled tax amount from its percentage, ignores the garbled lines OCR makes of non-Latin text, and picks the currency from the receipt. A small 330 px-wide photo of a Thai and English bill from Bangkok comes out as 5 items, VAT 7% and THB 1,198.40, matching the printed total.
- **Exact split engine.** Amounts are kept in integer minor units with largest-remainder rounding, so the shares always add up to the bill to the last paisa or cent.
- **Live tapping.** Instant updates with auto-save and a 4-second sync. Every item shows who had it.
- **Pay back in one tap.** UPI, PayPal, Venmo and Cash App links open with the amount filled in. Revolut, Wise or any payment link opens the payer's page.
- **Payer board.** Who owes what, who says they've paid, confirmed payments, unclaimed items, and a summary to copy into the chat.
- **48 currencies**, each with its correct decimals.
- **Interactive demo** that plays both roles in one browser, for a safe first try.
- **Live stats** at `/growth`: bills split, guests reached, referred splits, referral-chain depth and the viral coefficient, from real usage only.

## Tech stack

- **Frontend:** vanilla JavaScript ES modules with no framework and no build step. Mobile-first CSS with light and dark mode.
- **Backend:** Cloudflare Workers with D1 (SQLite). The JSON API is written against the standard Web Request/Response, so the same code also runs on Node's built-in SQLite for development, tests and self-hosting.
- **Receipt reading:** Tesseract.js on the device plus our own receipt parser. Claude vision (Anthropic API) can read photos on the server when an API key is configured; the live site uses the on-device scanner.
- **Accounts without accounts:** the payer gets a private admin token and each friend a personal token stored in their browser. A split can only be found through its random link.
- **Tests:** 27 `node:test` tests covering the split maths, receipt parsing (including real OCR output) and the full API flow.
- **Deploy:** Wrangler for the Worker and the D1 migrations.

## Hackathon theme: a Zero-CAC product

Tapsplit can't be used alone, so it acquires users while it is being used:

- **Sharing is the core action.** The payer has to send the link to get paid back, so every bill reaches 2–8 people at the moment they feel the problem.
- **Nothing stops a guest.** A link, a name, a few taps. No install, no sign-up, no password.
- **The link sells itself.** In the group chat it previews as "Asha paid ₹2,585 at The Copper Kettle".
- **Every guest is a future payer.** "Split your own bill" starts their next bill, tagged with the split that brought them.
- **It measures itself.** Live stats compute the viral coefficient (guests reached per bill × the share of them who later start a bill of their own) and the referral chains from real usage, with no seeded numbers.

**Business model:** free for people, always; the free loop is the acquisition engine. Revenue comes from payment partners (referral fees for high-intent pay-back taps), restaurants (a "Split with Tapsplit" QR on the printed bill, priced per outlet per month), and Tapsplit Plus for frequent organisers (running balances, reminders, exports).

## Try it in 2 minutes

1. Open the live app and click **Split a bill**, then **Try a sample bill**.
2. Type a name under **Who paid?** and click **Create split & get link**. Copy the link.
3. Open the link in a private window, join as a friend and tap a few items.
4. Back in the first window, claim the rest and click **Finalize shares**. Then **I've paid** as the friend and **Got it** as the payer.
5. Open **Live stats** to see the referral loop.
````
