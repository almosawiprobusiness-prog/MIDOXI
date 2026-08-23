# Stripe setup — MIDO XI

Do the whole thing in **Test mode** first. Every step below is identical in live
mode; you repeat it once at the end with the live-mode toggle on, and get a
second set of keys.

The Stripe dashboard has a **Test mode** switch in the top right. Turn it on
before you start, and check it stays on — Stripe silently gives you live keys if
it is off, and live keys in a half-tested setup is how people take a real
payment they cannot fulfil.

---

## 1 · Create the two products

Stripe dashboard → **Product catalogue** → **Add product**.

**Product 1**
- Name: `MIDO XI Pro`
- Then add two prices to it:

| price | amount | billing period |
|---|---|---|
| monthly | `11.99` USD | Recurring · Monthly |
| annual | `119.00` USD | Recurring · Yearly |

**Product 2**
- Name: `MIDO XI Elite`

| price | amount | billing period |
|---|---|---|
| monthly | `24.99` USD | Recurring · Monthly |
| annual | `249.00` USD | Recurring · Yearly |

Two products, four prices total. The amounts must match — the app displays these
from `lib/billing/plans.ts` and Stripe charges what its own price says, so a
mismatch means the page advertises one number and the card is charged another.

---

## 2 · Copy the four price IDs

On each price, click the **⋯** menu → **Copy price ID**. They look like
`price_1Qxxxxxxxxxxxxxx`.

Keep them straight — this is the easiest thing to get wrong, and swapping
monthly for annual means someone pays $11.99 for a year:

| price you created | env var |
|---|---|
| Pro · monthly | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro · annual | `STRIPE_PRICE_PRO_ANNUAL` |
| Elite · monthly | `STRIPE_PRICE_ELITE_MONTHLY` |
| Elite · annual | `STRIPE_PRICE_ELITE_ANNUAL` |

---

## 3 · Get the API keys

**Developers** → **API keys**.

| Stripe calls it | env var |
|---|---|
| Secret key (`sk_test_…`) | `STRIPE_SECRET_KEY` |
| Publishable key (`pk_test_…`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

The secret key is revealed once — copy it when it is shown.

---

## 4 · Create the webhook endpoint

This is the step that matters most. Without it Stripe takes payments and the app
never finds out: no subscription is recorded, and **no referral ever converts**,
because the webhook is the only thing allowed to say someone paid.

**Developers** → **Webhooks** → **Add endpoint**.

- Endpoint URL: `https://mido-xi.vercel.app/api/stripe/webhook`
- Select exactly these four events — the app ignores everything else:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Then click **Reveal** on the endpoint's **Signing secret** (`whsec_…`) →
`STRIPE_WEBHOOK_SECRET`.

> This secret is **per endpoint**. The one from `stripe listen` during local
> development is a different secret and will not work here — every event would
> be rejected as an invalid signature.

---

## 5 · Put the seven values into Vercel

```
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_PRICE_PRO_MONTHLY production
vercel env add STRIPE_PRICE_PRO_ANNUAL production
vercel env add STRIPE_PRICE_ELITE_MONTHLY production
vercel env add STRIPE_PRICE_ELITE_ANNUAL production
```

Each prompts for the value and hides it. Or paste them in the Vercel dashboard
under Settings → Environment Variables, scoped to Production.

Put the same seven into `.env.local` if you want billing working locally too.

**Then redeploy** — env changes do not reach a running deployment.

---

## 6 · Test the whole loop

Card `4242 4242 4242 4242`, any future expiry, any CVC.

1. Sign in → **Membership** → subscribe to Pro monthly
2. You should return to `/app/membership?checkout=success`
3. The page should show **Pro · Monthly** and a renewal date
4. Stripe → Webhooks → your endpoint → the four events should show **200**

If the page still says Free, the webhook is the thing to look at — the payment
succeeded, the app just never heard. Stripe shows the response body for each
attempt, and there is a **Resend** button to retry after fixing.

---

## 7 · Then the referral conversion

Once billing works, the referral loop closes by itself:

1. Person signs up through `https://mido-xi.vercel.app/join/CODE`
2. They subscribe
3. `checkout.session.completed` → the webhook calls `convert_referral`
4. The conversion is **held 14 days** — this is deliberate, so a refund reverses
   it rather than paying out
5. After the hold, `ripen_referral_rewards` turns it into a free month, which
   the referrer can spend from the Refer page

To test without waiting two weeks, the hold is `REWARD.holdDays` in
`lib/data/referral-types.ts` — drop it to `0` temporarily, test, put it back.

---

## 8 · Going live

Repeat steps 1–5 with **Test mode off**. Everything is separate in live mode:
new products, new prices, new keys, **and a new webhook endpoint with its own
signing secret**. Swap all seven values in Vercel and redeploy.

Before you flip: run a real card through test mode end to end at least once,
including the webhook showing 200. A subscription Stripe accepts but the app
never records is worse than no billing at all — the customer is charged and gets
nothing.
