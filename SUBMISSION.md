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

## Customer-journey video (4:40)

The video shows two windows side by side: the payer (Asha, normal window) on the left and a friend (Ravi, private window) on the right, with a calm voice-over. A judge can repeat these steps exactly.

| Time | Window | What to click |
| --- | --- | --- |
| 0:00 | — | What Tapsplit is and why it exists. |
| 0:24 | Payer | Open https://tapsplit.tameimpala.workers.dev. The home page has two ways in: **Split a bill** and **Try the interactive demo**. |
| 0:38 | Payer | Click **Try the interactive demo**. Tap **Margherita pizza**, then **Switch to Asha to finalize**, **Finalize shares**, **Mark sample payment sent**, **Confirm sample payment received**. Close it with **×**. |
| 1:01 | Payer | Click **Split a bill**. The bill can come from **Scan photo**, **Paste text** or **Type items**. Click **Try a sample bill**. |
| 1:17 | Payer | Check the items: 7 lines plus service and taxes, matching the printed ₹2,585. |
| 1:36 | Payer | Under **Who paid?** type **Asha**. **Friends pay you with** offers UPI, PayPal, Venmo, Cash App, Revolut, Wise or a link; keep **Just track it**. Click **Create split & get link**. |
| 1:57 | Payer | Click **Copy link**. |
| 2:06 | Payer | Asha taps **Dal Makhani** and one **Beer**. |
| 2:18 | Friend | Open the link in a private window. Type **Ravi**, click **Start tapping**. Tap **Paneer Tikka**, one **Butter Naan**, one **Beer**. |
| 2:37 | Friend | Ravi's estimated share: ₹770, including his part of the service charge and taxes. |
| 2:50 | Payer | Ravi's taps appear live. **Finalize shares** stays off until everything is claimed. Asha taps **Chicken 65**, the other **Butter Naan**, **Garlic Bread**, the second **Beer** (+) and **Fresh Lime Soda**. |
| 3:10 | Payer | Click **Finalize shares**. |
| 3:23 | Friend | Ravi's share is final and the items are locked. Click **I've paid**. |
| 3:37 | Payer | Click **Got it** next to Ravi. |
| 3:48 | Friend | Click **Split your own bill**, then **Split a bill**, **Try a sample bill** and **Create split & get link**: Ravi's own split. |
| 4:03 | Payer | Click **Live stats**: bills, guests reached, referred splits, referral chain and the viral coefficient. |
| 4:22 | — | Recap and the link. |

Live stats count everyone's real usage, so a judge will see different numbers from the video.

### YouTube upload

- **Title:** Tapsplit: customer journey (HackOnVibe 2026)
- **Visibility:** Unlisted or Public, not Private (judges must be able to open it).
- **Description** (paste as is; one timestamp per line lets YouTube make chapters):

```
Tapsplit splits a group bill by what each person had. One link, no app, no sign-up.
Try it: https://tapsplit.tameimpala.workers.dev

0:00 Intro
0:24 Home page
0:38 Interactive demo
1:01 Add a bill
1:36 Who paid
1:57 Share the link
2:18 A friend joins
2:50 Claim the rest
3:10 Finalize shares
3:23 Friend pays
3:37 Payer confirms
3:48 The growth loop
4:03 Live stats
```
