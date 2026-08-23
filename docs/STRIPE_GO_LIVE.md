# Going live — MIDO XI

Live mode is a **separate world**. Nothing carries over from the sandbox: not
products, not prices, not customers, not the webhook, not its signing secret.
Everything below has to be done again in live mode, and the moment it is, real
cards are charged.

Work through it in order. The verification at the end is not optional — the one
failure that has already bitten this project (a payment Stripe accepted that the
app never recorded) is silent by nature.

---

## 1 · Turn off test mode

Switch out of the sandbox using the environment picker at the top left. The
amber sandbox border disappears.

## 2 · Create the three products again

Same as `docs/STRIPE_PRICES.md`, in live mode:

| product | monthly | annual |
|---|---|---|
| MIDO XI Player | $9.99 | $89.00 |
| MIDO XI Touchline | $29.00 | $279.00 |
| MIDO XI Club | $149.00 | $1,490.00 |

**Name them exactly that.** The coupon script finds products by name, so a
"MIDO XI player" or "Player" will not be matched.

## 3 · A new webhook endpoint

Developers → Webhooks → Add endpoint, **in live mode**:

- URL: `https://mido-xi.vercel.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`

Its signing secret is **different** from the sandbox one. The sandbox secret
will reject every live event as an invalid signature.

## 4 · Replace all nine variables in Vercel

Every one of these changes. A live secret key with sandbox price IDs fails at
checkout with a confusing "no such price".

```
STRIPE_SECRET_KEY                     sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY    pk_live_…
STRIPE_WEBHOOK_SECRET                 whsec_…   (from the LIVE endpoint)
STRIPE_PRICE_PLAYER_MONTHLY           price_…
STRIPE_PRICE_PLAYER_ANNUAL            price_…
STRIPE_PRICE_TOUCHLINE_MONTHLY        price_…
STRIPE_PRICE_TOUCHLINE_ANNUAL         price_…
STRIPE_PRICE_CLUB_MONTHLY             price_…
STRIPE_PRICE_CLUB_ANNUAL              price_…
```

Then **redeploy** — env changes do not reach a running deployment.

## 5 · The coupon

```
STRIPE_SECRET_KEY=sk_live_... npm run founding50 -- --live
```

The `--live` flag is required and deliberate: 50% off forever cannot be taken
back from anyone who has already redeemed it.

It applies to **Player and Touchline only**. Club is excluded.

---

## 6 · Verify — with real money

There is no test card in live mode. Use your own card and refund it.

1. **Check `/app/admin` first.** It lists configuration problems — a wrong key
   prefix, a live/test mismatch, missing price IDs. Fix anything it names before
   going further.
2. Subscribe to **Player monthly** with a real card.
3. You should land on `/app/membership` showing **Player · Monthly**.
4. Stripe → Webhooks → your live endpoint: the events should read **200**.
5. Ask me to check the database. The subscription must exist with
   `plan_id = player_monthly`. **Stripe succeeding is not the same as the app
   knowing** — that gap is exactly what went wrong in the sandbox, and it looked
   like success from the Stripe side.
6. Refund yourself: Payments → the payment → Refund. Then confirm the
   subscription flips to `canceled` in the app.

## 7 · Then, and only then

Announce it. A customer charged for a plan the app never granted is worse than
no billing at all — they have paid and received nothing, and nothing anywhere
raises a hand.

---

## If something looks wrong

```
npm run verify:db          tables, adapter columns, function grants
npm run verify:redirect    auth links resolve to the production domain
npm run founding50         re-run any time to see redemptions left
```

Runtime errors: `npx vercel logs mido-xi.vercel.app`. The webhook now logs
`stripe.webhook.subscription_recorded` on success and throws on a write failure
so Stripe retries — a silent 200 on a failed write is the one outcome that
loses a payment permanently.
