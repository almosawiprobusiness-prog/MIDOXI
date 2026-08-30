# Trainer OS — Payments Decision Brief

**Status: DECIDED — Option B, volume-tiered downward (30 Aug 2026).**
The owner chose a small application fee that SHRINKS as the trainer
onboards more players. Implemented as (basis points, from the live
active-athlete count, frozen into each payment link at creation):

| Active athletes | Fee |
|---|---|
| up to 5 | **2%** |
| 6–15 | **1.5%** |
| 16+ | **1%** |

Schedule lives in `lib/billing/connect-fee.ts` (pure, tested) and is
rendered by the same module the charge reads, so the Lab can never
advertise a rate the charge ignores. The first slice below is BUILT;
what remains awaiting a user run is the Stripe-side setup and the
test-mode end-to-end.

---

The original brief follows, kept for the reasoning.

## Why payments at all

CoachIQ's entire wedge is that CoachNow does not handle money: private
trainers switch platforms for integrated payments alone. MIDO XI can
offer what neither can — payments attached to the player-owned record.
The trainer bills through the Lab; the athlete's development history
stays theirs.

## The design (what would be built)

**Stripe Connect, Express accounts.** The existing Stripe integration
(subscriptions, webhooks, `STRIPE_GO_LIVE.md`) already carries keys,
webhook plumbing and metering discipline; Connect adds:

1. `trainer_accounts` table: `user_id`, `stripe_account_id`,
   `charges_enabled`, `payouts_enabled` — mirrored from account
   webhooks, never assumed.
2. Onboarding: "Set up payments" in the Lab → Stripe-hosted Express
   onboarding (identity, bank). MIDO never sees or stores bank data —
   the same rule as card data today.
3. Products: the trainer defines what they sell (block of 6 sessions,
   monthly coaching) with their own prices. Checkout via Stripe
   Checkout in the trainer's name (`on_behalf_of` + destination
   charge), athlete pays with any card.
4. The athlete link: a paid session/block attaches to the athlete row,
   and — when the athlete is a MIDO XI player — to their own account's
   record. The receipt trail lives on both sides.
5. Refunds: trainer-initiated from the Lab, full or per-session,
   through the API — never a manual promise.

## The decision: fee structure

| Option | Mechanics | Signal it sends |
|---|---|---|
| **A. No platform fee** | Trainer pays Stripe's rate only (~2.9% + 30¢). MIDO XI monetizes via the Touchline subscription. | "Your business is yours" — strongest trainer acquisition; simplest legally |
| **B. Small application fee (1–2%)** | `application_fee_amount` per charge, on top of the subscription. | Revenue scales with trainer success; standard marketplace practice; adds tax/reporting surface |
| **C. Fee on free tier, none on paid** | Free trainers pay 3% platform fee; Touchline subscribers pay none. | Makes the subscription self-justifying at ~$1.3k/mo of billing |

**Recommendation: A** for the beta cohort. The number of Founding-era
trainers is small; goodwill and the case study are worth more than
1% of their revenue. Revisit at 25 active trainers. C is the natural
follow-on shape if a fee is ever added.

## Also decided-by-default unless you object

- Currency: trainer's local (Stripe handles), USD default.
- No money movement inside MIDO XI itself — every charge, refund and
  payout is a Stripe object with a Stripe receipt.
- Demo mode never touches Stripe: the Lab shows the flow with a
  clearly-labelled simulated state.

## What was built now (no money involved)

- The practice mark: programs carry "Prepared by {practice}"
  (`getTrainerPractice()` in lib/data/roles.ts) — the brand the
  athlete would be paying, on the artifact they'd be paying for.

## Built (30 Aug 2026, after the decision)

- Migration `0037_trainer_connect.sql`: `trainer_accounts` (Connect
  mirror, read-only to clients), `trainer_products` (owner-editable),
  `trainer_purchases` (fee frozen in; service-role writes only). The
  grant trap revoked both ways, as always. **Awaiting user run.**
- `lib/billing/connect.ts`: Express account + Stripe-hosted onboarding
  link, product payment links as destination charges with
  `application_fee_amount` from the tier schedule, webhook handlers for
  `checkout.session.completed` (kind=trainer_product) and
  `account.updated`.
- `/app/payments` in the Lab (trainer nav): fee card with the live
  tier and the "N more athletes drops your fee" line, product CRUD,
  payment-link generation showing the frozen fee, purchases list.
  Demo mode is clearly simulated; missing keys degrade honestly.
- `/pay/done`: the public landing after Checkout — outcome only, no
  data, receipt comes from Stripe.

## Awaiting user run

1. ~~Apply migration 0037~~ — **applied and verified 30 Aug 2026**
   (`npm run verify:0037`, 10/10: tables exist, price/fee constraints
   reject out-of-bounds writes, anon gets 401 on all three).
2. In the Stripe dashboard: enable Connect (Express) on the account,
   and add `account.updated` to the webhook endpoint's events.
3. Test-mode end-to-end with a test bank account and card 4242…:
   onboard → create product → pay the link → purchase row flips to
   paid → Stripe dashboard shows the application fee.
