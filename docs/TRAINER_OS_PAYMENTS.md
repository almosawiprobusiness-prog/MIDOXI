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
advertise a rate the charge ignores.

**Margin correction (30 Aug, from the Stripe plugin's connect-recommend
fee-economics check):** on destination charges Stripe's processing fee
is debited from the PLATFORM, so an application fee of 1–2% alone
would have MIDO XI paying ~1–2% to be paid. Per Stripe's own guidance,
`application_fee_amount` = platform tier fee + estimated processing
(2.9% + 30¢), passed through at cost and never kept. The trainer nets
what a direct merchant would; the platform nets its tier; non-standard
cards can exceed the estimate — that delta is the platform's, accepted
at beta scale and watched via the Dashboard margin report. Fulfillment
is gated on `payment_status` and also handles
`checkout.session.async_payment_succeeded`, per the same source. The first slice below is BUILT;
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
2. ~~Enable Connect~~ — **done 30 Aug in the claimed test sandbox**
   ("New business" under MIDO CO, acct_1UA1ZAIH2zlK5bOt): marketplace
   model chosen, Express accounts creatable. For LIVE mode, Connect
   still needs enabling on the production account the same way.
3. ~~Test-mode end-to-end~~ — **RUN AND PASSED 30 Aug 2026**, every
   layer verified:
   - Express onboarding completed through the app's own Set up
     payments → account link flow (test phone/SMS, test identity,
     STRIPE TEST BANK ••••6789); `charges_enabled` /
     `payouts_enabled` true, requirements empty; the Lab's mirror
     flipped to the product form on reload.
   - Product created in the Lab ($300 block); payment link generated
     with the frozen fee stated: $6 (2%, 4 active athletes) + ~$9
     processing; ledger row landed `pending`.
   - Paid with 4242…: Checkout succeeded → /pay/done rendered →
     `checkout.session.completed` forwarded by `stripe listen` →
     row flipped `paid` with timestamp. Stripe's PI confirms
     `application_fee_amount: 1500` and `transfer_data.destination`
     = the trainer's account.
   - Declined with 4000…0002: inline decline on Checkout, no event,
     row stayed `pending` — nothing lies about money.
   - Probe trainer torn down (auth delete, cascade, re-listed gone).
   ~~The remaining live-mode steps~~ — **live-mode pass, 30 Aug:**
   - **Production webhook DONE.** The live "MIDO XI" endpoint
     (`we_1U7KBERca6fER0GRf28F4qw6` →
     https://mido-xi.vercel.app/api/stripe/webhook, Active, 0% error
     rate) now listens to all six events — the original four plus
     `account.updated` and `checkout.session.async_payment_succeeded`.
     Verified on the endpoint page after saving.
   - **Production code DONE.** `/pay/done` serves 200 on
     mido-xi.vercel.app; migration 0037 is applied to the production
     database; live Stripe keys are in Vercel.
   - ~~ONE gate remains~~ — **CLEARED, 30 Aug 2026. LIVE.** The owner
     uploaded the identity document ("Thanks for providing a valid
     identity document"), and the integration-choices confirmation was
     completed: marketplace model, buyers purchase from the platform /
     sellers paid out individually, Stripe-hosted onboarding, Express
     dashboard for sellers, and the liability acknowledgment —
     **the platform (MIDO CO) is responsible for refunds, chargebacks,
     loss liability and Radar fees on connected-account payments**,
     exactly the destination-charge responsibility this doc's risk
     notes already recorded. Dashboard now reads "Connect setup
     complete". Go-live checklist: Verify your identity ✅, Confirm
     your integration choices ✅.

## LIVE as of 30 August 2026

Trainer payments are enabled end to end in production: a trainer opens
/app/payments → Express onboarding → products → payment links, with
the tiered fee (2%/1.5%/1%) plus processing pass-through frozen into
each link. First-real-payment advice stands: make the first live
transaction a small one of your own before any trainer sends a link
to a client, and watch the Dashboard margin report as volume arrives.
