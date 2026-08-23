# The six prices to create — MIDO XI

Create these **inside your sandbox** (the environment switcher, top-left, next
to "MIDO CO"). Sandboxes are fully separate from live: separate products,
prices, customers and webhooks.

Stripe → **Product catalog** → **Add product**.

## Product 1 — MIDO XI Player

| price | amount | billing period | goes into |
|---|---|---|---|
| monthly | `9.99` USD | Recurring · Monthly | `STRIPE_PRICE_PLAYER_MONTHLY` |
| annual | `89.00` USD | Recurring · Yearly | `STRIPE_PRICE_PLAYER_ANNUAL` |

## Product 2 — MIDO XI Touchline

| price | amount | billing period | goes into |
|---|---|---|---|
| monthly | `29.00` USD | Recurring · Monthly | `STRIPE_PRICE_TOUCHLINE_MONTHLY` |
| annual | `279.00` USD | Recurring · Yearly | `STRIPE_PRICE_TOUCHLINE_ANNUAL` |

## Product 3 — MIDO XI Club

| price | amount | billing period | goes into |
|---|---|---|---|
| monthly | `149.00` USD | Recurring · Monthly | `STRIPE_PRICE_CLUB_MONTHLY` |
| annual | `1490.00` USD | Recurring · Yearly | `STRIPE_PRICE_CLUB_ANNUAL` |

---

## Copying the IDs

On each price row: **⋯** → **Copy price ID**. They start `price_`.

Not `prod_` — that is the *product*, and checkout will reject it. If what you
copied starts `prod_`, you took the wrong ID.

## Into Vercel

```
vercel env add STRIPE_PRICE_PLAYER_MONTHLY production
vercel env add STRIPE_PRICE_PLAYER_ANNUAL production
vercel env add STRIPE_PRICE_TOUCHLINE_MONTHLY production
vercel env add STRIPE_PRICE_TOUCHLINE_ANNUAL production
vercel env add STRIPE_PRICE_CLUB_MONTHLY production
vercel env add STRIPE_PRICE_CLUB_ANNUAL production
```

## And remove the four old ones

They are from the previous pricing structure and nothing reads them now:

```
vercel env rm STRIPE_PRICE_PRO_MONTHLY production
vercel env rm STRIPE_PRICE_PRO_ANNUAL production
vercel env rm STRIPE_PRICE_ELITE_MONTHLY production
vercel env rm STRIPE_PRICE_ELITE_ANNUAL production
```

Leaving them is not dangerous, just misleading — the next person to read the
list would reasonably assume "Pro" and "Elite" are real plans.

## Then

Redeploy. `/app/admin` will list anything still missing, and checkout will work.
