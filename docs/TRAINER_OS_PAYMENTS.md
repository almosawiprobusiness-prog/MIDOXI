# Trainer OS — Payments Decision Brief

**Status: DECISION REQUIRED before any code touches live money.**
Per `FEATURE_DECISIONS.md`, the Connect fee structure is a
decide-with-user stop point. This brief exists so the decision is made
over a concrete design rather than an idea. Nothing here is wired.

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

## What is NOT built until you decide

Everything in "The design". First implementation slice after the
decision: `trainer_accounts` + Express onboarding + one product +
Checkout, test mode end-to-end, using the `REAL_ACCOUNT_TEST.md`
script pattern.
