# MIDO XI — Deploy & Operations

Desktop-first football performance OS. Next.js 16 (App Router, Turbopack) on Vercel.

## Environments & feature flags

The app **degrades gracefully**: with no keys it runs in demo mode (seed data), and
each subsystem lights up the moment its keys are present. `lib/env.ts` derives the
flags; `GET /api/health` reports them.

| Feature | Flag is on when… | Env vars |
|---|---|---|
| Auth + Database | Supabase public vars set | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server writes (webhooks, metering) | service key set | `SUPABASE_SERVICE_ROLE_KEY` |
| AI Study Engine | Supabase + Anthropic key set **and** account has credits | `ANTHROPIC_API_KEY` |
| AI monthly budget cap (optional) | value > 0 | `AI_MONTHLY_BUDGET_USD` — global $ ceiling; AI pauses for the month once crossed. Blank/0 = no cap |
| Study film discovery | YouTube key set | `YOUTUBE_API_KEY` |
| Pro/Elite membership / billing | Stripe secret + publishable set | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_ELITE_MONTHLY`, `STRIPE_PRICE_ELITE_ANNUAL`, `STRIPE_WEBHOOK_SECRET` |
| Email | Resend key set | `RESEND_API_KEY` |
| Admin dashboard (`/app/admin`) | your email listed | `MIDO_ADMIN_EMAILS` (comma-separated) |
| App URL (redirects, checkout) | — | `NEXT_PUBLIC_APP_URL` (e.g. `https://mido-xi.vercel.app`) |

## First-time / re-deploy to Vercel

```bash
vercel --prod
```

1. Set every env var above in **Vercel → Project → Settings → Environment Variables**
   (Production). `NEXT_PUBLIC_*` must be set for the Production environment before build.
2. Point `NEXT_PUBLIC_APP_URL` at the production domain (used for Stripe success/cancel
   URLs and auth redirects).
3. In **Supabase → Auth → URL configuration**, add the production domain to the allowed
   redirect URLs (`/auth/callback`).

## Database migrations (Supabase SQL editor, in order)

1. `supabase/migrations/0001_init.sql` — schema, RLS, plans seed. *(already run)*
2. `supabase/RUN_NEXT_storage_and_community.sql` — storage bucket RLS (uploads) +
   community tables/profile expansion. **Run this to activate uploads + community.**

## Stripe setup (to turn Pro/Elite on)

Three-tier model (Free + Pro + Elite). Create **two Products**, each with a monthly + annual price:
1. **MIDO XI Pro** — $11.99/mo, $119/yr → `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_ANNUAL`.
2. **MIDO XI Elite** — $24.99/mo, $249/yr → `STRIPE_PRICE_ELITE_MONTHLY` / `STRIPE_PRICE_ELITE_ANNUAL`.
3. Add a webhook endpoint → `https://<domain>/api/stripe/webhook`, events:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Run migration `supabase/migrations/0004_plans_elite.sql` (keeps the DB catalogue in sync).
5. Billing buttons enable automatically once secret + publishable keys are present.

## Anthropic (to turn the live AI on)

Add credits at **console.anthropic.com → Plans & Billing**. Until then the Study Engine
runs its heuristic path (no crash); the circuit breaker retries after a short cooldown.

## Pre-deploy checks

```bash
npm run test     # unit tests (pure logic)
npm run build    # production build + typecheck
npm run smoke    # integration smoke vs a running server (dev or prod)
#   BASE_URL=https://<domain> npm run smoke   # against production
```

## Observability

- **Health:** `GET /api/health` → subsystem flags + DB reachability (`ok`/`degraded`).
- **Admin ops:** `/app/admin` (admin emails only) — members, MRR, AI calls/cost by
  feature, cache rate, errors, system health.
- **Logs:** structured one-line JSON via `lib/observability/log.ts` (Stripe webhook,
  metering) — parseable by Vercel log drains. Secrets are redacted.

## Security

Rotate any key that was ever pasted into chat/logs: the Supabase **service role** key,
`ANTHROPIC_API_KEY`, and `YOUTUBE_API_KEY`. Never commit `.env.local`.
