# MIDO XI — Progress

## 2026-08-22 — Live. Billing works end to end.

**https://mido-xi.vercel.app** — live Stripe, real cards.

### Proven in live mode, from the database rather than the UI

```
plan_id      player_monthly
status       trialing
stripe sub   sub_1U7L2ERca6fER0GR…      ← live account
account      MIDO
```

```
stripe.webhook.received              customer.subscription.created
stripe.webhook.received              checkout.session.completed
stripe.webhook.subscription_recorded planId=player_monthly status=trialing
```

Real card → Stripe → signed webhook → database → entitlement. That chain failed
silently twice today, so it was checked against the tables rather than the
screen.

`FOUNDING50` created and working.

### Where it stands

| | |
|---|---|
| signup + email confirmation | ✅ live |
| four role-based tiers, entitlement enforced server-side | ✅ |
| checkout, 7-day trial, promo codes | ✅ live |
| webhook → subscription mirror | ✅ live |
| referral ledger (attribution → hold → reward → redemption) | ✅ tested against live data |
| referral conversion driven by a real card | not yet — needs a referred account to subscribe |
| AI paths | live key deployed, reachable now that a paid tier exists |

### A cleanup failure of mine, found and fixed
Listing accounts turned up **17 test accounts still in the production auth
table** — after I had reported them removed. `generate_link` does not always
return a user object, and the cleanup trusted that it did, so the delete
silently no-opped.

All 17 removed (scoped strictly to `@example.invalid`, a reserved TLD that
cannot be a real person). `verify-redirect.mjs` now looks the account up by
address instead of trusting the response, and prints a warning when it cannot
remove one — the same failure made loud.

**The lesson is the same one as the webhook:** an operation that reports success
without checking the result is not a success, it is an assumption. Both bugs
today were that shape.

### Tooling left behind
```
npm run verify:db          tables · adapter columns · function grants
npm run verify:redirect    auth links resolve to the production domain
npm run coupons            every coupon's scope, cap and codes (read-only)
npm run founding50         create/inspect the founding offer
```

### Open
- The referral→payment hop, with a real card on a referred account.
- `key-qa-1787426648276@example.invalid` is an empty customer record in live
  Stripe from a checkout test. No charge; delete if you want the list tidy.

---

## 2026-08-22 — Referral conversion tested against live data

Two real accounts through the whole loop, against the hosted database, using the
actual security-definer functions and real RLS. Everything below is measured,
not asserted.

### The happy path ✅

| step | result |
|---|---|
| referrer gets a code | `DUR3FX` — minted by `my_referral_code()` |
| anonymous visit counted | `hits: 1`, no identity recorded |
| joiner attributes the code | `{ok: true}` → referral `pending` |
| they pay (`convert_referral`) | `updated: 1` → `converted`, tier `player` |
| hold expires, ripens | 1 reward, `earned`, 1 month |
| referrer spends it | `comped_access` · tier `player` · ends in one month |
| reward marked | `applied` |

### Every guard held ✅
- **Own code**: *"That is your own referral code."*
- **Second attribution**: *"This account is already credited to someone."*
- **Double spend**: *"You have no unspent months."*
- **Privacy**: `my_referrals()` returned the joiner's status and dates and
  **not their user id** — checked by searching the payload for it. The referrer
  learns that someone converted, never who.

### The two properties that protect the business ✅
These are the ones worth having tested, because they only ever matter when
something goes wrong:

- **The hold is real.** Converted with the production 14-day hold,
  `ripen_referral_rewards()` returned **0** and the rewards table stayed empty.
  A conversion does not pay out on day one.
- **A refund claws back an unspent month.** After the hold passed and the reward
  ripened, `void_referral` voided the referral and **removed the unspent
  reward** — the referrer could no longer spend it.
- **A spent month is left alone.** In the first run the month had already been
  redeemed into `comped_access`; the refund voided the referral but did not
  revoke access already in use. Clawing back something someone is using is worse
  than eating the cost.

### What was not driven through Stripe
`convert_referral` was called with the service key — which is exactly what the
webhook does. The webhook's own wiring was proven minutes earlier by the
subscription it recorded, and `settleReferral` sits in that same function with
no early return between them.

The one untested hop is a real card on a referred account. Nothing about the
ledger depends on it.

### Cleanup
Both test accounts deleted; `referrals`, `referral_rewards`, `comped_access` and
`referral_visits` all confirmed empty afterwards. The only rows left are the real
account's referral code and its live `player_monthly` subscription.

---

## 2026-08-22 — Payments work end to end (after two bugs of mine)

First real subscription recorded:

```
plan_id      player_monthly
status       trialing
period end   2026-08-29        ← exactly the 7-day trial
stripe sub   sub_1U7JkvDEXdZfF0OB
```

Webhook log: `stripe.webhook.subscription_recorded · planId=player_monthly · status=trialing`.

### The bug that mattered 🔴 → ✅
The first test payment **succeeded in Stripe and never reached the app.** Stripe
showed a clean delivery. `subscriptions` was empty.

`subscriptions.plan_id` is a foreign key:

```sql
plan_id text not null references subscription_plans(id)
```

Migration 0013 described `subscription_plans` as "presentation-only" and deleted
the pro/elite rows. It is not presentation-only — it is the referenced side of
that key. After 0013 the table held only `free`, so every paid subscription hit
a foreign-key violation.

**And it was silent**, because `upsertSubscription` never read the upsert's
error. The route returned 200, so Stripe recorded a successful delivery and
would never retry. A customer pays, the app does not know, and nothing anywhere
says so — the worst failure shape available.

Fixed in two places:

- **0014** seeds the six role-based plans, and deliberately restores the retired
  `pro_*`/`elite_*` rows. Deleting them caused this; any historical subscription
  still pointing at one needs its referenced row to exist.
- **The webhook throws now.** A write failure logs the Postgres code plus a hint
  (`23503` → "run migration 0014") and rethrows, so the route answers 500 and
  Stripe retries. Returning 200 on a failure discards the event permanently.
  Both silent `return`s before it log too.

### The lesson
A comment I wrote — *"presentation-only"* — was wrong, and I acted on it without
checking the schema. `grep "references subscription_plans"` would have taken ten
seconds. Assertions about what a table is *for* should be checked against what
it is *wired to*.

### Also fixed along the way
- `STRIPE_SECRET_KEY` had a `mk_…` value; Stripe rejected it with a 401 that
  reached the user as a dead page. `configIssues()` now validates key prefixes,
  catches a live/test mode mismatch, and flags missing or malformed `price_…`
  IDs — all surfaced on `/app/admin` before anyone clicks Subscribe.
- Stripe failures degrade to a readable message (*"Billing is misconfigured —
  the Stripe secret key was rejected. Nothing has been charged."*) rather than
  tripping the error boundary.
- Price env vars were renamed with the pricing restructure; production still had
  the old four. Documented in `docs/STRIPE_PRICES.md`.

### Verified
Checkout sessions create for all four plans, all `cs_test_` · trial attached ·
promo-code field enabled · subscription mirrored · trial recognised as active.

`npm run build` ✓ · `npm run lint` ✓ · `npm test` ✓ **268 tests, 20 files**

### Still open
- Referral conversion has never run on a real payment. `convert_referral` is
  called from `settleReferral` on `active`/`trialing`, so this subscription
  should have triggered it — but there was no referral attached to test with.
- Live mode: everything above is the sandbox. Going live means new products,
  new prices, new keys and **a new webhook endpoint with its own secret**.

---

## 2026-08-22 — Role-based pricing, and a hole I shipped and caught

Pricing moved from feature tiers to tiers shaped by **who you are**. A club
paying the same as a fifteen-year-old was wrong in both directions.

| tier | monthly | annual | opens |
|---|---|---|---|
| Free | £0 | — | one system, the user's choice, no AI |
| Player | $9.99 | $89 | Player |
| Touchline | $29 | $279 | Player + Coach + Trainer |
| Club | $149 | $1,490 | all four · 10 seats |

7-day trial on Player and Touchline, card required. Not on Club — an
organisation buying ten seats has a conversation, not a free week.

### The bug worth recording 🔴 → ✅
Role access was **not gated at all** before this: `availableRoles` came purely
from which profile rows existed, so filling in four profiles gave four systems.

My first fix had a hole of its own:

```ts
available = entitled.length > 0 ? provisioned ∩ entitled : [storedRole]
```

The free branch trusted `profiles.role`. `switchRole` writes exactly that column
**and provisions the matching profile row**, so anything that reached the column
reached the system. I forced `role = 'club'` on a free account and was served
the entire Club OS — HQ, Teams, Staff, Methodology.

Two things were wrong, and both mattered:

1. The free branch took a stored value on trust.
2. The returned `role` was never checked against `available`, so the shell would
   render a system the account could not open.

Now nothing stored is trusted: free gets one system and it must be one free is
allowed to have; a stored role that is not falls back to a provisioned one that
is; and the active role is always drawn from `available`. Re-tested with the
database still forced to `role='club'` — served Coach, and the switcher showed
Club locked at $149.

**`switchRole` is also gated server-side now.** Hiding a system in the menu is
not enforcing it, and that action is what provisions.

### Locked systems are shown, not hidden
A system the account cannot open appears in the switcher with a lock and the
cheapest price that unlocks it — *"Club · from $149"* — and routes to
Membership. Hiding it would make the product look smaller than it is and give
nobody a reason to upgrade.

### Also
- `planIdForPrice` now returns `null` for an unrecognised Stripe price and the
  webhook **refuses** rather than guessing. Guessing meant a price we could not
  identify silently becoming the cheapest tier — someone pays for Club, gets
  Player.
- Admin MRR is derived from the catalogue instead of a hand-written list, so a
  tier added and forgotten cannot vanish from revenue.
- The annual saving on each card is computed from the two real prices, so it
  cannot disagree with what the customer is charged.

### Checks
`npm run build` ✓ · `npm run lint` ✓ · `npm test` ✓ **257 tests, 19 files** —
`plans.test.ts` pins the ladder (no annual above twelve monthlies, every higher
tier a superset, Club reserved to Club), and the new `role-gate.test.ts`
restates the resolution algorithm and pins the exact bypass that shipped.

### Needs running
`supabase/RUN_NEXT_role_based_plans.sql` — migration 0013.

---

## 2026-08-22 — Signup works end to end 🎉

The redirect allow-list is set. **https://mido-xi.vercel.app** is fully functional for real users.

### Verified, by contrast rather than assertion
Two accounts through the identical flow, differing only in whether the confirmation link was
clicked:

| | outcome |
|---|---|
| **A** — created, link never clicked | sign in **refused: "Email not confirmed"** |
| **B** — created, link clicked | lands on `https://mido-xi.vercel.app/auth/callback`, session issued, **sign in works** |

`mailer_autoconfirm: false`, so confirmation is genuinely enforced — A proves that. B proves the
link both lands on the app and does the confirming. An hour ago that link resolved to
`http://localhost:3000`.

All three link types check out: signup confirmation, OAuth callback, password reset.

### A correction worth recording
My first end-to-end run printed *"chain still broken"*. It was wrong — the script read
`email_confirmed_at` from the admin get-by-id endpoint, which does not return that field, so it saw
`null` and called it a failure while the same run showed sign-in succeeding. **The two halves of my
own output contradicted each other and I should have trusted the one that exercised the real
behaviour.** The contrast test above replaced the field-read entirely: it observes what a user can
actually do rather than what a field says.

### The full picture now
Working in production: signup → email confirmation → sign in → onboarding → the whole free tier,
across all four operating systems. Referral codes mint, links point at the right host, the join loop
counts visits. Verified earlier against the live database, not the UI.

Not working, by absence of configuration rather than defect: **billing** (no Stripe keys exist
anywhere), and therefore **referral conversion** (the webhook is its only trigger) and **AI**
(gated behind Pro, which needs billing).

### Permanent checks
`npm run verify:db` — tables, adapter columns, grants
`npm run verify:redirect` — all three auth link types resolve to the app

---

## 2026-08-22 — Signup verified end to end on production, except the one hop I cannot fix

### The redirect URLs are still unset — and now measured, not assumed 🔴
`/auth/v1/admin/generate_link` returns the exact URL Supabase would email, **without sending
anything**. Run against production:

```
confirmation link : https://ckhrphzxteygblmirakf.supabase.co/auth/v1/verify
redirect_to       : http://localhost:3000        ← the project Site URL
```

When `redirect_to` is not allow-listed Supabase does not error — it silently substitutes the Site
URL. So a real signup today sends a confirmation email whose link lands the visitor on **their own
machine**. That is the whole failure, and it is one field.

Setting it needs an account-level personal access token (Management API
`PATCH /v1/projects/{ref}/config/auth`). The service-role key is project-scoped and cannot; the CLI
is not logged in; I do not handle personal access tokens. Dashboard:
`.../project/ckhrphzxteygblmirakf/auth/url-configuration` → Site URL `https://mido-xi.vercel.app`,
Redirect URLs `https://mido-xi.vercel.app/**`.

### Everything after that hop — verified on the live site ✅
A throwaway account (admin-created, deleted after) went through the deployed app:

- **Sign in** → correctly routed to `/onboarding`
- **Onboarding** all four steps → landed on `/app`
- **Writes confirmed by querying the database directly**, not by reading the UI:
  `profiles` (`PQ` / player / complete) · `player_profiles` (position, club, squad number,
  `level: null`) · `development_goals` (2, categorised `mental`)
- **Briefing on real data** — *"You have not checked in today"*, *"Still working on: Scanning"*
- **Progressive profiling** asked for `level`, the one field left blank, and nothing else
- **Referral code minted on demand in production** — `BYTPXQ`, proving the `my_referral_code()` RPC
  works against the live schema
- **The referral link points at production**: `https://mido-xi.vercel.app/join/BYTPXQ`
- **The join loop works live** — hitting it set the `mido_ref` cookie and the visit counter moved
  **0 → 1**, proving `record_referral_visit()` runs in production
- **10 authenticated routes** served without an error boundary and with **no seed data leakage**

### Two things learned about Supabase's signup validation
A fully public signup could not be driven from here: Supabase rejects `@example.invalid` **and**
`@example.com` with *"Email address … is invalid"*. Its validator refuses reserved and
non-deliverable domains, so a real signup needs a real address. Worth knowing before testing with
throwaway addresses.

The form surfaced that error clearly rather than failing silently, which is the behaviour you want.

### Cleanup ✅
Account deleted — `auth.users` 404, and `profiles`, `player_profiles`, `development_goals`,
`daily_checkins`, `referral_codes`, `referrals`, `referral_rewards` and `comped_access` each queried
directly and confirmed empty. The `referral_visits` row (keyed by code, not user, so no cascade)
removed separately.

### Where that leaves signup
Every step works except the confirmation link's destination. Fix the one field and the chain is
complete — I can re-run `generate_link` in seconds to confirm.

---

## 2026-08-22 — Supabase redirect URLs: what I could and could not do

**Live: https://mido-xi.vercel.app** · deployment `dpl_6iHSC6fCPGSyUtqT7zgH7qNBP2Lh`

### The redirect URLs still need a hand 🔴
Setting them needs the **Management API**, which takes an account-level personal access token — not
the service-role key, which is project-scoped. The Supabase CLI is not logged in and there is no
`SUPABASE_ACCESS_TOKEN` anywhere, and I do not handle personal access tokens. So this one is a
dashboard action.

`supabase config push` would technically do it, but it is the wrong tool here: it syncs the *entire*
`[auth]` block from a `config.toml` that does not exist in this repo, so it would push CLI defaults
over whatever else is configured. The Management API `PATCH .../config/auth` is surgical; the CLI
push is not.

**Project ref: `ckhrphzxteygblmirakf`.** Dashboard → Authentication → URL Configuration:
- Site URL: `https://mido-xi.vercel.app`
- Redirect URLs: `https://mido-xi.vercel.app/**`

### What probing for it turned up instead ✅
Trying to *test* the allow-list rather than assume it was broken led somewhere more useful.
`/auth/v1/settings` is public, and it reports what the project actually has enabled:

```
enabled:  email
disabled: google, apple, github, … (every other provider)
```

**Google is disabled — and both `/login` and `/signup` were rendering "Continue with Google".** In
production that button called `signInWithOAuth`, which answers
`"Unsupported provider: provider is not enabled"`. A dead control on the first screen a new user
sees, live on the public site.

`lib/auth/providers.ts` now reads `/auth/v1/settings` (cached an hour) and the form renders a
provider button only when the project genuinely has it enabled — along with the "or" divider, which
would otherwise have been left stranded above nothing. **It self-corrects:** enable Google in the
dashboard and the button appears without a redeploy; there is no flag to set and none to forget.
A failed settings call degrades to email-only, because showing one fewer way in beats showing one
that errors.

Verified on production: Google button gone from both pages, email and password fields intact, no
orphaned divider.

### The signup blocker is narrower than I said
Email signup is enabled (`disable_signup: false`), so the only thing standing between a visitor and
an account is the redirect allow-list above. Worth stating precisely: it is not that auth is
misconfigured — it is one field.

### Checks
`npm run build` ✓ · `npm run lint` ✓ · `npm test` ✓ **219 tests, 18 files** · live routes 200 ·
`/join/ABCDEF` → `https://mido-xi.vercel.app/signup?ref=ABCDEF`

---

## 2026-08-22 — Production env filled in, redeployed

**Live: https://mido-xi.vercel.app** · deployment `dpl_GFxZWEuVb1fbvZEdgQtJmJzuhyAt`

### Added to Vercel production ✅
Values piped from `.env.local` straight into `vercel env add`, never printed:

| key | effect |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` works → webhook can mirror subscriptions, `convert_referral` becomes callable, `logAiUsage` records spend so the budget ceiling functions, account deletion works, `/app/admin` has metrics |
| `ANTHROPIC_API_KEY` | `features.ai` true |
| `YOUTUBE_API_KEY` | study discovery can search |

### The Stripe keys could not be added — they do not exist 🔴
`.env.local` has `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
and all four `STRIPE_PRICE_*` vars **declared but empty**. Same for `RESEND_API_KEY`. There was
nothing to copy: Stripe is not configured anywhere, local or production.

So the deployed product remains **free-tier only**, and by consequence:

- Nobody can subscribe.
- **No referral can convert** — `convert_referral` is now reachable by the webhook, but the webhook
  is disabled without a Stripe secret, and `settleReferral` is only ever called from it.
- **AI is enabled but unreachable.** Every `generateJson` caller is gated
  `checkFeature → aiAvailable → withinAiBudget → consumeFeature`, and `checkFeature` requires Pro.
  With no billing there is no route to Pro, and the only other route — comped months from
  referrals — needs a conversion, which needs Stripe. Audited all five callers before enabling the
  key: **there is no path to spending Anthropic credits on the public deployment.**

That last point is worth keeping: the key is live, but the architecture means it cannot be drained.

### Verified on the live deployment ✅
`/join/ABCDEF` → `Location: https://mido-xi.vercel.app/signup?ref=ABCDEF` (appUrl still correct
after the redeploy) · `/` `/login` `/signup` → 200 · `/app` → 307 · real mode confirmed.

### Still needs a hand
1. **Supabase → Authentication → URL Configuration** — Site URL and Redirect URLs must list
   `https://mido-xi.vercel.app`, or signup email confirmation points somewhere Supabase refuses and
   **nobody can complete signup**. Unchanged and still blocking; not settable from the CLI.
2. **`AI_MONTHLY_BUDGET_USD` is set in production but unset locally**, and Vercel masks its value.
   If it is `0` or a placeholder, `aiBudgetLimit()` returns 0 and there is no spend ceiling. It did
   not matter before; it does now that a real Anthropic key is deployed. Worth confirming.
3. **Stripe**, whenever billing is wanted. The webhook secret must come from an endpoint created in
   the Stripe dashboard pointing at `https://mido-xi.vercel.app/api/stripe/webhook` — a local
   `stripe listen` secret will not work in production.
4. The four `SUPABASE_*` vars from 12 days ago are still leftovers this app never reads.

---

## 2026-08-22 — Deployed to production

**Live: https://mido-xi.vercel.app** · deployment `dpl_8NUaPXdhJx2DuWsKajMsf3x9F21h`

### NEXT_PUBLIC_APP_URL, set and proven ✅
Set to `https://mido-xi.vercel.app` (the project has no custom domain — `ocaatm.com` and
`cambiaskin.com` belong to other projects).

Vercel masks sensitive vars on read-back, so it was verified from the outside instead. The `/join`
route redirects to `${env.appUrl}/signup`, which puts the value in a `Location` header with no auth
needed:

```
GET https://mido-xi.vercel.app/join/ABCDEF
→ 307  Location: https://mido-xi.vercel.app/signup?ref=ABCDEF
```

Not localhost. The referral chain now points at the real host, which is the whole reason the
variable was flagged.

### Verified on the live deployment ✅
- Public routes `/` `/login` `/signup` `/privacy` `/terms` → 200
- Auth guard: `/app`, `/app/referrals`, `/app/membership` → 307 to `/login?next=…`, destination preserved
- **Real mode** — the demo escape hatch is absent, so Supabase keys are reaching the build
- **Today's code shipped**, confirmed by probing for strings only written today: the four-OS section,
  each role's tagline, and *"no camera system and no data feed"*

### What production is missing, and what it switches off ⚠
`.env.local` has these; Vercel production does not. The app degrades honestly rather than breaking,
but the deployed product is currently **free-tier only**:

| missing | consequence |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` returns null → Stripe webhook cannot mirror subscriptions, **`convert_referral` never runs so no referral can ever convert**, `logAiUsage` writes nothing so the AI budget ceiling reads $0 and never caps, account deletion fails, `/app/admin` has no metrics |
| `ANTHROPIC_API_KEY` | every AI path off — gated honestly in the UI |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | nobody can subscribe |
| `STRIPE_WEBHOOK_SECRET` | webhook rejects every event |
| `YOUTUBE_API_KEY` | study discovery falls back to the curated library |
| `RESEND_API_KEY` | no transactional email |

`SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL` and `SUPABASE_JWKS_URL` are set in
production but **this app reads none of those names** — they look like leftovers from another
integration and are doing nothing.

### The step no key can fix — Supabase redirect allow-list 🔴
Supabase → Authentication → URL Configuration must list the production domain, or the confirmation
link in every signup email points somewhere Supabase refuses to redirect to, and **nobody can
complete signup**. This cannot be set from here without a management token. Needs:

- Site URL: `https://mido-xi.vercel.app`
- Redirect URLs: `https://mido-xi.vercel.app/**`

Account deletion is also currently broken in production (no service-role key) while the UI still
offers it — worth fixing before anyone real signs up.

---

## 2026-08-22 — First run against the real database

Everything until now was verified in demo mode against an in-memory store. This was the first time
the product ran against real Supabase, with a real signed-in account.

### The auth boundary ✅
Real mode confirmed by absence — the "explore the demo locker" escape hatch only renders when
`isDemoMode` is true, and it is gone. All six `/app/*` routes and `/onboarding` redirect to
`/login`; public routes stay public. The browser client reaches the real project and rejects
invented credentials with *"Invalid login credentials"*, which proves URL, anon key and auth flow
are wired end to end.

### The data path ✅
A throwaway account (created via the admin API, deleted afterwards) walked the whole first-run
journey, and every write was then read back **directly from the database**, not from the UI:

| table | written |
|---|---|
| `profiles` | `QA Tester` / `QA` / `role: player` / `onboarding_complete: true` |
| `player_profiles` | `CF`, `QA Rovers`, dob, height — and `level: null` |
| `development_goals` | 3 goals, categories correctly `technical` / `tactical` / `mental` |
| `daily_checkins` | energy 2, sleep 2, soreness 4, mental 3 |
| `referral_codes` | `LG5BQC` — minted by the Postgres function, 6 chars, no O/0/I/1 |

Then the fifteen `/app` routes, at 375px, checked for error boundaries, overflow, heading structure,
unnamed controls, `undefined`/`NaN` — and for **seed data leaking into a real account**. All clean.
No server errors.

### The three claims that mattered, proven on live data

- **Readiness derives identically in two places.** Check-in (2, 2, 4, 3) → mean 2.25 → **31/100**.
  The Recovery page shows `31 · Manage load`; the Locker briefing shows *"You reported 31/100 this
  morning"*. Same number, computed independently. That was an assertion yesterday; it is a
  measurement now.
- **Progressive profiling fires on real absence.** I skipped `level` during onboarding, and the
  Locker asked for it — *"A session for an academy U16 and a session for a Sunday league side are
  not the same session. MIDO currently guesses."* — while asking for nothing else.
- **Performance and Recovery show honest empty states.** This is the one that matters most.
  Yesterday, a brand-new real account would have been shown a fictional striker's season, per-90s
  for pressures and runs in behind, HRV and hydration readings. Today: *"there is nothing here to
  show until then, and MIDO will not invent it."*

Incidental confirmation: fetching a page mid-stream returned the new `app/app/loading.tsx` skeleton.

### A silent misconfiguration, found by reading the output ✅
The referral page rendered a working link to **`http://localhost:3100/join/LG5BQC`** — correct
behaviour, since it uses `NEXT_PUBLIC_APP_URL`, and exactly the problem.

That variable has a working default, so a wrong value errors nowhere. Five things follow it:

- every referral link a user copies and shares
- the `/join` redirect those links land on
- Stripe checkout success and cancel returns
- the Stripe billing-portal return
- signup and OAuth email confirmation

A referral programme whose links point at localhost is not degraded, it is broken, and the only
symptom is that nobody ever converts. `configIssues()` in `lib/env.ts` now names it — localhost or
plain http in a production build, and live billing with no `STRIPE_WEBHOOK_SECRET` (which would
reject every event, so no referral could ever convert). It surfaces on `/app/admin`, where ops would
look. `tests/unit/config.test.ts` pins that localhost is fine in development, never in production,
and that a host merely *containing* "localhost" is not flagged.

### Cleanup ✅
Test account deleted: `auth.users` lookup returns 404, and `profiles`, `player_profiles`,
`development_goals`, `daily_checkins`, `referral_codes`, `subscriptions` and `usage_periods` were
each queried directly and confirmed empty. The credentials file is deleted.

### Checks
`npm run build` ✓ · `npm run lint` ✓ · `npm test` ✓ **219 tests, 18 files** · `npm run verify:db` ✓
(tables, adapter columns, grants).

### Still unproven
`convert_referral` is reachable by the webhook and nobody else, and the ledger reads correctly — but
no real Stripe payment has run through it. The conversion path stays unproven until one does.

---

## 2026-08-22 — Migrations applied, and a security hole I had shipped

### 0009–0011 are live ✅
All 26 tables, the three altered `teams` columns and all nine security-definer functions verified
against the hosted database. `npm run verify:schema`.

### The hole: a revoke that did nothing 🔴 → ✅
Migration 0011 ended with what looked like the important line:

```sql
revoke execute on function public.convert_referral(...) from anon, authenticated;
```

**It does nothing.** Postgres grants `EXECUTE` on a new function to `PUBLIC` by default, and both
`anon` and `authenticated` inherit it *through* `PUBLIC` — so revoking from those two roles leaves
the `PUBLIC` grant standing.

The affiliate programme's entire integrity argument is *"only the payment processor may claim
someone paid"*. I shipped it with that boundary **not enforced**: anyone holding the anon key —
which ships in the browser on every page load — could call `convert_referral` with a user's uuid to
mint referral rewards, or `void_referral` to wipe someone's referrals.

Migration `0012_lock_referral_writes.sql` revokes from `PUBLIC` (the part that matters), grants
explicitly to `service_role` so the Stripe webhook still works, and applies the same audit to every
function in 0009 and 0011 rather than leaving any of them on an inherited default.
`record_referral_visit` and `preview_invite` stay open to `anon` deliberately — both happen before
anyone has an account.

**After 0012:** `convert_referral()` and `void_referral()` return **401** to anon and **200** to the
service role.

### Why nothing caught it
`verify-schema.mjs` proved the function *existed*. Nothing proved it was *locked*. The migration ran
without error, every table checked out, and the boundary was open the whole time.

`scripts/verify-security.mjs` is new and now part of the routine (`npm run verify:db` runs both). It
tests grants rather than existence: every function reachable by the role that should reach it, and
the two money-claim functions reachable by nobody else. Its header records this exact failure mode,
because the mistake is invisible and easy to repeat.

`supabase/CHECK_grants.sql` is a read-only catalog query that prints which roles may execute each
function — the ground truth, for the `authenticated` role that cannot be tested without a signed-in
user's token.

### Confirmed against the catalog ✅
`supabase/CHECK_grants.sql` prints which roles may execute each function — the ground truth for
`authenticated`, which cannot be reached from here without a signed-in user's JWT. It reports
`convert_referral` and `void_referral` as **`service_role` only**. All three roles now accounted
for: `anon` measured at 401, `authenticated` confirmed absent from the catalog, `service_role`
working at 200.

### And one more check, while the schema was fresh ✅
The new adapters had never run a query against the real database — only against the in-memory demo
store. `scripts/verify-columns.mjs` asks PostgREST for the exact column list each adapter selects
(`limit 0`, so nothing is read); a column that does not exist comes back 400/PGRST204.

This is the check that would have caught `match_date` vs `played_at` and `age_group` vs `level` —
two real bugs in this codebase, both of which built and linted cleanly and failed only at runtime,
in real mode, where nobody was looking. **20 queries, all clean.**

`npm run verify:db` now runs all three: tables exist → adapters ask for columns that exist → grants
are what they claim to be.

### The lesson worth keeping
I reasoned that `revoke … from anon, authenticated` would close it. That reasoning was wrong, and
reasoning is what produced the bug. The fix is not "be more careful with grants" — it is that a
security boundary has to be **measured against the live database**, from the outside, using the key
an attacker would hold. Existence checks are not security checks.

---

## 2026-08-21 — Functional QA: what the page-load sweep could not see

Page loads and accessibility were clean, so the last pass drove the actual write paths through the
UI and read what came back. Rendering a page proves it renders; it says nothing about whether the
thing it produced is any good.

### A finding that turned out to be my own bad test ✅ (and the correction)
The functional sweep reported that a coach could **create a session and never delete it**. I built a
`DeleteSessionButton`, wired it in, and verified it working.

It was wrong. Sessions already had a delete, inside the edit dialog, exactly like the other ten
entities in the product. My check had searched for controls by `innerText` — and every one of these
is an **icon-only button with an `aria-label` and no text**, so the search found nothing and I read
that as nothing being there.

The button was removed again. A second way to delete the same thing, inconsistent with every other
entity, is worse than the imagined gap it was fixing.

**The lesson is about the test, not the button:** a sweep that measures visible text is blind to
exactly the controls an accessibility pass is designed to produce. Every button-existence check in
this session now reads `aria-label` before `textContent`.

### Dead server actions ✅
Swept all **110 exported server actions** for callers. Six had none:

- `deleteGoalAndRedirect`, `deleteMatchAndRedirect`, `deletePostAndRedirect`,
  `deleteVideoAndRedirect` — thin unused wrappers around actions that *are* used, where the
  component does its own `router.push`. Two functions named `deleteGoal…` is exactly the ambiguity
  that produces a wrong call later.
- `finishOnboarding` — a bare redirect; the wizard uses `completeOnboarding`.
- `startStudy` — redundant by design, and worth checking before deleting: every study action that
  needs a record already creates one lazily (`page.record ?? await ensureStudy(...)`), so a study
  is persisted the first time the user does anything rather than on an explicit "start". Good
  design; the leftover was just a leftover.

All six removed, along with the `redirect` imports they were the only user of.

### Flows verified end to end
- **Match**: create → detail shows the **real club name** (was a seed constant this morning) →
  appears in the server-built ⌘K index on the next navigation → delete → count back to 3.
- **Session**: create → *Draft with MIDO* → 6 blocks totalling exactly the 75-minute session length,
  drawn from the coaching library and **written inside the club's 3 methodology principles**, with
  an honest gate: *"Drafting with MIDO is a Pro feature. The version below is built from the MIDO
  coaching library and is free."* → delete.
- **Programme**: create → *Build from the library* → 12 sessions across 6 weeks, qualities inferred
  from the objective, waved weeks with a deload and a closing retest — and the note still standing:
  *"MIDO never states a target time or a normative standard — those depend on the population, and
  inventing them would be fabrication."*
- **Progressive profiling**: verified by temporarily blanking a field — the card appears with its
  options, dismisses, and stays dismissed for the session.

### The club system's headline claim was weaker than it sounded ✅
The Club OS says, in the product: *"9 principles are live. When a coach in this club drafts a
session, MIDO writes it inside them."* Drafting a pressing session and reading what actually landed
showed it carrying the club's **build-up** principles.

`composeSession` was doing `methodology.slice(0, 3)` — the first three **in document order**. The
cap is right (a block carrying six coaching points is a block nobody reads); picking them by
position on a page is not.

`relevantPrinciples()` now scores each principle against the session's own language — its objective
and the concept it is built around — with document order kept as the tie-breaker, so a club that
wrote its principles in priority order still gets them in that order when nothing matches.

Getting it right took two passes, both driven by watching what a real session came back with:

1. **Fragments were beating real matches.** A build-up principle reading *"against two pressers"*
   scored the same on a pressing session as the club's actual pressing principle. Whole-word
   matches now score above substrings.
2. **A legitimate match on the wrong word still won.** *"Width — the far winger stays high and
   wide"* matches "high" from *"press to win the ball high"* fairly, and beat pressing on a
   tie-break. The fix came from how clubs actually write these: `"Pressing — press the touch, not
   the pass"`. That leading label is the club's **own** categorisation, and it is by far the
   strongest signal about what a principle is for. It now outweighs anything in the body.

Verified on a fresh session: a pressing objective now returns all three **Pressing** principles
where it previously returned Build-up.

### A match plan that read like a template ✅
Every section of a match plan keeps the coach's observations verbatim and adds **one** framing line —
except "Where to attack", which welded the same sentence onto each observation:

> Their right centre-back steps early — *rehearse a repeatable way to reach it.*
> Slow to shift when the ball is switched — *rehearse a repeatable way to reach it.*

Two items and the reader has already seen the phrase twice. Framed once now, like every other
section, which is what the file's own comment said it did: *"Observations are kept verbatim — only
the framing is added."*

### Also re-verified after the AI-client changes
- **Study Engine** (the signature feature) — the full loop renders, and the three-way separation the
  spec demands is intact: `VERIFIED` curated record, `MIDO ANALYSIS`, `YOUR OBSERVATIONS`, closing
  with *"Verified facts are curated. MIDO analysis is interpretation, not record."*
- **Frame-by-frame film reading** — the client-side capture path still works end to end against the
  demo film: three frames at 640×360, 11–54KB each, **no canvas tainting**. The honest markers are
  still in place: *"What this cannot do: measure anything."*
- **Match plan** — the grammar fix from Phase 4 holds; the coach's words come back as written.

### The landing page was still describing the product from three phases ago ✅
It made no false claims — but it never mentioned the four operating systems, which are the product's
whole thesis and the thing Phases 4–6 built. A visitor read it as a player app with a "Coach Mode"
bolt-on, and could only find out otherwise by signing up.

Replaced that section with the four systems, **read from the same `ROLES` registry the app uses** —
each role's own tagline and its own defining question — so the pitch cannot drift from what ships.
Adding a fifth role means the page grows a card by itself.

Also rewrote the privacy panel to describe the connection model that now exists (*"a coach sees only
what you accepted when you linked your account… the database enforces it, not the interface"*), and
added one saying plainly what MIDO will not do — no distances, sprint counts or expected goals,
because there is no camera system and no data feed. Stating that on the marketing page rather than
only inside the product is the harder and more useful version.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **212 tests, 17 files**. Final sweep: 26
routes at 375px and 1280px — one h1 each, main landmark present, every control named, no horizontal
overflow, and nothing rendering `undefined`/`NaN`.

---

## 2026-08-21 — The last two Phase 2 items, and the rest of the seed data

### Development Map ✅ — current → target → gap, with nothing invented
The obvious build was the wrong one. *"Technical: current 6/10, target 8/10"* reads well and means
nothing — MIDO does not assess players, has no scout and holds no rating. Those bars would have been
exactly the invented attribute ratings that came off the profile page an hour earlier.

So each term is redefined as something already in the user's record:

- **current** — what the evidence says. Progress across the category's goals, which moves only when
  evidence is attached to them.
- **target** — the goals the player set. The target *is* the goal; nobody else decides what a player
  is aiming at.
- **gap** — said concretely: which goals are open, and which kind of evidence they are short of.
  *"1 open at 46%. Nothing here is backed by coach input yet — that is the fastest thing to change."*

The map's most useful output turns out not to be per-category progress at all. It is **coverage** —
*"3 of 5 areas have goals set. Nothing in physical and mental — worth knowing whether that is
deliberate."* A real insight, from real data, with no number invented to produce it. Untouched areas
are shown rather than hidden; a map that only draws where you have been is a map of nothing.

### Daily briefing ✅ — and deliberately not an AI feature
Everything worth saying first thing in the morning is already a fact in the locker data: days to the
match, whether you checked in, whether last week's match is still unreviewed. Rules produce those
instantly, for free, identically every time, and **every line can be traced to the thing that caused
it**. Spending a model call to restate facts the software already holds would cost money and add
doubt.

Two rules govern it: every line names its cause (*"3 days to Riverside · MD-3, sharpening not
building"* is a briefing; *"you look sharp this week"* is a horoscope), and where there is genuinely
nothing to say it says so rather than manufacturing urgency.

Readiness in the briefing is derived with the **same** arithmetic the Recovery page uses. Two places
computing "how ready are you" two different ways is how a product ends up contradicting itself on
the same morning.

### The remaining seed leaks ✅
Three more, all the same shape as the Performance/Recovery bug:

- **`lib/search.ts` built its index at module scope from `lib/seed`**, so ⌘K's "Your football memory"
  returned a fictional player's matches, clips and goals to every real account. It is pure ranking
  now; `lib/data/search-index.ts` builds the index per user on the server and the layout hands it in
  — resolved once per navigation rather than fetched on keystroke. Deep links improved on the way:
  a result now opens the match or goal itself rather than its list page.
- **The Match Center's "next fixture" card was a hardcoded seed object rendered unconditionally** —
  a real account with no upcoming game saw a fictional one, kick-off time and all. It comes from the
  user's own calendar now, and when there is no match there is no card.
- **The match detail page named the user's club from a seed constant**, so every account played for
  Northgate FC. It reads the profile.

`app/app/community/actions.ts` also imports seed data, but only inside `isDemoMode` branches — that
one is correct and was left alone.

### Progressive profiling ✅ — Phase 2 closed
A twenty-field form at signup is how a product gets a database full of blanks: the person filling it
in has no idea which fields do anything, so they skip the ones that look like admin — and half of
those are the ones that make the product work.

`lib/data/profiling.ts` asks for **one thing at a time**, and every ask states what it unlocks:

> **What position do you play?** Study picks, session drafts and every concept MIDO surfaces are
> filtered by position. Without it they are written for nobody in particular.

Two rules, both pinned by tests: **nothing is asked for unless a real behaviour is degraded right
now** (a test asserts no prompt reads "complete your profile" or "for a better experience"), and
only one is ever shown. Dismissal lives in `sessionStorage` rather than the database on purpose —
someone who does not want to answer today is not saying "never ask again", and a prompt one
impatient click can permanently silence stops working for the accounts that most need it.

Verified live by temporarily blanking a field: the card appears with its options, dismisses, and
stays dismissed for the session. With a complete profile nothing renders at all, which is the point.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **202 tests, 17 files** — new
`development-map.test.ts` asserts the map never emits anything that reads as an ability rating
(no `n/10`, no "weak/strong/elite"), and `briefing.test.ts` asserts every line has an action, none
repeats, none comments on the player, and none strays into a medical claim.

Swept all 26 workspace routes again at 375px: one h1 each, main landmark present, every control
named, no horizontal overflow.

### Still open
- **Migrations 0009, 0010 and 0011 have not been run** —
  `supabase/RUN_NEXT_connections_video_referrals.sql`.

---

## 2026-08-21 — Phase 8: polish, and the fake data that was still shipping

### The worst thing found in the whole build ✅
Three pages — **Performance, Recovery and Profile** — imported a hardcoded
`lib/data/demo.ts` **with no branch on demo mode at all.** A real signed-in account with real
matches in it saw a fictional centre-forward's season presented as its own.

It was worse than stale data, because what those pages showed was not merely someone else's — it
was **unrecordable**:

| Shown | Reality |
|---|---|
| "Runs in behind 5.4 / 90", "Pressures 13.7 / 90", "Box touches 8.1 / 90" | No such column exists. These are tracking-data figures the capability registry explicitly refuses to produce. |
| HRV 75ms · Resting HR 52bpm · Hydration 2.6L · Sleep 8.0h · six-region soreness map | `daily_checkins` holds four 1–5 scores and a note. None of these can be entered anywhere in the product. |
| "Finishing 82 · Pace 84 · Pressing 88" as filled bars | Nothing in MIDO assesses any attribute. Nobody scored these. |
| A three-season career at three clubs | `player_profiles` holds one season. |

A player reads the Recovery page to decide whether to train. It was showing them invented
physiology.

**All three pages now go through adapters** — `lib/data/performance.ts` and `lib/data/recovery.ts`,
both branching once on `isDemoMode` like the rest of `lib/data` — and every figure is derived from
something recorded:

- **Per-90** comes from `match_stats`, and only from columns that exist. A metric is dropped
  entirely unless at least **two matches** and **90 minutes** fed it: a "3.2 shots per 90" built
  from one twenty-minute cameo describes the cameo, not the player. The bars are scaled to the
  player's own highest figure, so no chart implies a target nobody set.
- **Readiness** is the average of the four self-reported scores with soreness flipped, mapped onto
  0–100 — and the page says so, in those words. A readiness score out of a model the player cannot
  follow is asking them to trust a number about their own body that they have no way of checking.
  Below two fields answered it returns null rather than guessing.
- **Highlights** are read off the record, each naming the match it came from. A running total is
  labelled "To date" rather than stamped with a date it did not happen on.
- **The attribute bars are gone.** What replaced them is development goals — real, written by the
  player, with progress weighted by attached evidence.
- Each page now carries a **"what is not here"** panel naming the metrics MIDO cannot produce and
  what a vendor would be needed for, so the gap is stated where someone would go looking for it.
- Empty states are honest and specific: *"there is nothing here to show until then, and MIDO will
  not invent it."*

`lib/data/demo.ts` ended up **entirely unreferenced, and was deleted** — it cannot drift back in.

### Loading and error boundaries ✅
There were **zero** `loading.tsx` files across 41 routes. Every page awaits its data server-side, so
a navigation showed the *old* page until the new one was ready — which reads as a click that did
nothing. `app/app/loading.tsx` now fills the page region while the shell stays mounted, with
skeletons that mimic the shape of what is coming rather than generic grey boxes.

There was also no error boundary inside the workspace, so a failure on any one page bubbled to the
root and took the sidebar and command bar with it — a broken Assessments page looked like a broken
product. `app/app/error.tsx` keeps the shell mounted so the user can walk away from the page that
failed.

### Mobile — measured, not eyeballed ✅
Loaded all 27 workspace routes in a 375px frame and compared `scrollWidth` to `clientWidth`. **Four
routes overflowed.** One root cause behind all of them: a grid item defaults to `min-width: auto`,
so a card holding truncating text refuses to shrink and pushes the whole track wide.

`min-w-0` added to **39 card-shaped grid children**, plus six bare `<section>` grid children the
first sweep missed because it matched on class names.

A separate cause on Study: `.chip` is `white-space: nowrap`, which is right for a tag and wrong for
the study openers, which are whole sentences — a nowrap chip holding *"Summarise development trends
across the club"* is 340px wide on its own. Added `.chip-prose` for chips carrying prose.

**Re-measured: all 27 routes clean at 375px.**

### Accessibility — measured too ✅
Swept every route for unnamed controls, missing alt text, unlabelled fields, heading structure and
landmarks. Findings:

- **Every page had two `<h1>`s.** The topbar's section label was one — a breadcrumb competing with
  the page's own title on every screen in the product. It is a `<p>` with an aria-label now.
- One unlabelled `<select>` (the film-room tag filter).
- **No skip link** — reaching content by keyboard meant walking the whole sidebar on every
  navigation.
- **The command palette never restored focus on close**, dropping a keyboard user at the top of the
  document, which is worse than never having opened it.

All fixed; navs are labelled landmarks. Re-measured: 25 routes, one h1 each, main landmark present,
every control named, every field labelled.

### The command bar was searching seed data too ✅
The same bug, one layer down. `lib/search.ts` built its index **at module scope from `lib/seed`**,
so the "Your football memory" section of ⌘K returned a fictional player's matches, clips and goals
to every real account.

`lib/search.ts` is now pure ranking and nothing else. `lib/data/search-index.ts` builds the index
per user on the server and the layout hands it to the palette as plain data — resolved once per
navigation rather than fetched on keystroke, because a round trip in front of every character typed
into the fastest surface in the product would defeat the point of it. Matches and goals go through
the existing adapters, so both modes were already handled; clips are read directly.

Deep links improved on the way through: a match result now opens `/app/matches/{id}` and a goal
opens `/app/development/{id}`, where both used to land on the list page.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **163 tests, 14 files** — new
`records.test.ts` pins that a per-90 refuses thin evidence, that a blank stat is not counted as a
zero, that readiness reaches both ends of its scale and returns null below two fields, and that the
readiness advice never strays into a medical call.

---

## 2026-08-21 — AI review: what it builds, and what it costs

The question was whether the membership AI can "build anything football wise", and whether it is
efficient. Both halves turned up real defects.

### A bug that had been silently disabling structured output ✅
`generateJson` built `output_config` in two places and spread one over the other:

```ts
output_config: { format: { type: "json_schema", schema } },  // written first
...extra,                                                    // { output_config: { effort: "low" } }
```

`effort` and `format` are two fields of **one** `OutputConfig`. The spread replaced the object
wholesale, so **every Sonnet and Opus call was running without its JSON schema** — the two tiers
doing all the hard work — and quietly falling back to the regex that salvages JSON out of prose.
Haiku was unaffected, which is why nothing looked broken. Now built as one object.

### Prompt caching ✅ — the efficiency answer
Every engine has a long, stable system prompt: the persona, the curated football vocabulary, the
rules about what may not be claimed. It is identical on every call and dwarfs the request. A cache
breakpoint now sits on it with a 1h TTL, which suits a coach drafting several sessions in a sitting.

### Two ways spend was escaping the ceiling ✅
- **Cache reads were priced as fresh input.** The global `withinAiBudget()` ceiling reads the cost
  estimate, so over-charging does not just misreport — it switches Claude off early for everyone.
  Reads are now priced at 0.1× and writes at 1.25×.
- **`discover.ts` made two Claude calls and logged neither.** The Haiku intent call's tokens
  vanished entirely, and a run that failed *after* spending them logged nothing at all. Both calls
  are summed now, and a failed run still logs its spend — the user is not charged an allowance for a
  failure, but ops has to see the money.

`lib/ai/pricing.ts` is new: rates, `AiUsage`, `addUsage`, `estimateCostUsd` and `cacheSaving`, pure
and client-safe. It was previously inside the `server-only` client, which meant the one calculation
the budget ceiling depends on **could not be tested at all**.

### "Build anything football wise" — answered honestly ✅
`lib/ai/capabilities.ts` is the canonical registry: **11 builders**, each naming the route that runs
it, the roles that own it, what it needs first, and whether it costs anything. Alongside it,
**6 explicit limits** — measurement, fixture feeds, professional statistics, injury diagnosis,
nutrition prescription, and whether someone will "make it" — each with a reason and, where a vendor
would close the gap, what it would take.

**A real routing bug fell out of writing the tests.** `parseIntent` returned `null` for anything its
patterns missed, despite a comment claiming otherwise — so "set up a 4-3-3 build-up shape" got
nothing at all. Worse, once the registry was wired in at the bottom, *"analyse this clip and tell me
the sprint count"* matched the film pattern first and routed into a tool that cannot count sprints
and would not have said so.

The order is now principled, and the comment explains why it is not the order the patterns were
written in:

1. A **curated** subject wins outright — "Study Harry Kane" resolves to a real person.
2. **Refusals** are checked next, before any loose pattern gets a turn.
3. Then the fast patterns, then the registry, and only then nothing.

Surfaced in two places: the command bar renders a refusal with its own icon, its own group heading
and its reason left untruncated; and the membership page reads the registry directly, so what the
product claims about itself cannot drift from what it does.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **139 tests, 13 files** — new
`ai-cost.test.ts` pins the arithmetic the budget ceiling depends on, and `capabilities.test.ts`
pins that every builder reaches a route its role can actually see, that every refusal has a reason,
and that a measurement request is refused rather than improvised.

---

## 2026-08-21 — The affiliate programme

### The decision that shapes it: months, not money
A conversion earns the referrer **one free month of Pro**, and the person who joins gets one too.
That is a reward this product can hand over by itself — it writes a `comped_access` window that
`getMembership` reads back as a real entitlement, metered and capped exactly like a paid plan.

Cash commission is a different business: Stripe Connect, identity and tax onboarding per affiliate,
a payout schedule. None of it is built, so there is no dollar balance anywhere in the schema.
`PAYOUT_GAP` states that in the product, the way `TRACKING_GAP` does for film.

### A referral only earns when money moves, and stays moved
`convert_referral` is **revoked from every client role**. It is called by the Stripe webhook with
the service key, because "this person started paying" is a claim only the payment processor gets to
make. The conversion is then **held 14 days** before it ripens into a reward, so a refund inside the
hold reverses it instead of paying it — and `void_referral` takes back an unspent month while
leaving a spent one alone, because clawing back access someone is already using is worse than
eating the cost.

### The referrer never learns who signed up
`my_referrals()` returns statuses and dates and no identity. A referral programme is not a way to
find out who your friends are, and the page says so in as many words.

### Visits identify nobody
One counter row per code per day. No IP, no user agent, no fingerprint. Unknown codes are silently
ignored so the endpoint cannot be used to enumerate which codes exist.

### The loop, verified end to end
`/join/CODE` → visit counted → cookie set → `/signup?ref=CODE` with the invitation acknowledged →
attribution at onboarding (the first moment a new account is both real and authenticated) → Stripe
conversion → 14-day hold → reward → redeemed as real Pro time.

**Two bugs caught and fixed while building it:**
- `/join/[code]` was a page, and a page cannot set cookies — it threw, losing the attribution, which
  is the entire feature. It is a route handler now.
- The demo referral code was `MIDO7X`, which contains `I` and `O` — both banned from the alphabet
  precisely because they are ambiguous read aloud. The seeded code was unusable. Caught by the test
  that asserts the alphabet.

Also fixed: the redeem button unmounted the instant it succeeded (its own confirmation went with
it), so the whole card is a client component that shows the offer, then the result.

### Files
`supabase/migrations/0011_referrals.sql` · `lib/data/referral-types.ts` (pure, tested) ·
`referral-cookie.ts` · `referral-claim.ts` · `referrals.ts` · `app/join/[code]/route.ts` ·
`app/app/referrals/{page,actions}.tsx` · `components/referrals/{share-link,redeem-card}.tsx` ·
webhook + membership + signup + onboarding wiring.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **122 tests** at this point.
`scripts/verify-schema.mjs` now checks 0009–0011 **and the security-definer functions** — a
migration that created the tables but not the functions would have looked fine before.

### Needs a decision
**Migrations 0009, 0010 and 0011 have not been run.** Bundled ready to paste:
`supabase/RUN_NEXT_connections_video_referrals.sql`.

---

## 2026-08-21 — The simplification pass

### The problem, measured
Player and coach each carried **13 sidebar items** across 42 routes — and four of those thirteen
(Profile, Connections, Membership, Settings) were account admin sitting in the same list as the work.
A player opens MIDO XI to train, not to look at their subscription.

### What changed
`NavItem` gained `group: "primary" | "more"`, and account routes were lifted out of every role's nav
into a single `ACCOUNT_NAV`. `primaryNav(role)` / `moreNav(role)` are now the only things the shell
reads.

Each role's first screen answers **one question**, in 4–6 items:

| Role | Primary | Behind "More" |
|---|---|---|
| Player | Locker · Matches · Film Room · Training · Development · Study | Recovery · Performance · Calendar · Community |
| Coach | Touchline · Squad · Sessions · Opposition · Tactics · Study | Matches · Film Room · Calendar · Community |
| Trainer | Lab · Athletes · Programs · Assessments · Study | Sessions · Calendar · Community |
| Club | HQ · Teams · Staff · Methodology · Development · Study | Calendar · Community |

- **Sidebar** — the identity card became the account menu (Profile, Connections, Membership,
  Settings, Sign out). "More" is a disclosure that auto-opens when the active route lives inside it,
  so you are never in a section you cannot see. Footer reads `Press ⌘K to reach anything.`
- **Mobile** — a phone drawer shows everything at once, so there the fold becomes a labelled break:
  work, `MORE`, `ACCOUNT`, sign-out in the footer. Same hierarchy, no extra tap.
- **Command bar** — extended to `[...def.nav, ...ACCOUNT_NAV]`, so nothing that moved became harder
  to reach. Typing `member` from the Club OS returns **Membership** in one keystroke sequence.

**Nothing was deleted.** Every route that existed still exists and is still reachable by three paths
(nav, More/account menu, ⌘K).

### Verified live in all four operating systems
Player 6 items → More reveals Recovery/Performance/Calendar/Community · account menu opens with all
four routes plus Sign out · Coach 6 · Trainer 5 · Club 6 · mobile drawer at 375px shows the labelled
sections with **no horizontal overflow** (`scrollWidth === clientWidth === 375`) · ⌘K reaches
Membership from a role whose nav no longer lists it.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **96 tests, 10 files** — new
`tests/unit/roles.test.ts` pins the shape so it cannot silently regrow: ≤6 primary items per role,
no account route in any role nav, Study primary everywhere, and section titles resolving for hidden
routes.

---

## 2026-08-21 — Phase 7 (part 1): reading film

### The provider interface ✅
`lib/video/provider.ts` defines `VideoAnalysisProvider` and, more importantly, the distinction the
product must never blur:

- **frames** — describing what is visible in sampled stills. *Interpretation.*
- **tracking / events** — positions, distances, speeds, match events. *Measurement.*

`TRACKING_GAP` states in the product what a tracking vendor would add and that it requires a camera
system or a licensed feed. The interface is ready; no fake implementation ships.

### MIDO frame reading ✅ — route 1, built
- **Frames are captured in the browser.** An offscreen video element loads the film with CORS,
  seeks to each timestamp, draws to a canvas and encodes JPEG. No ffmpeg, no server-side video
  processing, and the film is never uploaded anywhere — only the stills the model is asked about
  leave the page. Verified live: 640×360 JPEG at ~28KB per frame.
- **The visible player is never touched.** Adding `crossOrigin` to it would break playback on any
  host without the header — I tried it, caught the regression, and moved capture to its own element.
- **Budget**: 12 frames maximum per analysis, three sampling rates, and the range picker is capped
  so the budget cannot be exceeded.
- **The prompt forbids measurement**: no distances, speeds or positions, no naming players or teams,
  no claiming anything the frames do not show, and it must acknowledge the gaps between samples.
  Observations are anchored to timestamps and map to curated concepts where they fit.
- Results save to `clip_analyses` with the provider that produced them, render as timestamped
  observations that seek the player, and any one can become a real clip.
- Gated on `deep_analyses`, metered, with honest unavailable states.

### Fixed while verifying
The demo film-room pointed at a Google sample bucket that now returns **403** — dead seed data.
Replaced with a public sample that both plays and permits frame reading.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **88 tests, 10 files** (new `video.test.ts`
pins the frame budget, even spacing, range caps and the tracking-gap honesty).

### Next
- **Phase 8 — polish**, then the queued requests: an affiliate programme, a review of AI efficiency
  and coverage, and a simplification pass on the product surface.

### Needs a decision
- **Migrations 0009 and 0010 have not been run.** Account linking and saved film analyses need them.

---

## 2026-08-21 — Migrations applied + account linking

### Migrations 0005-0008 are live ✅
Run against the hosted database and verified: all 21 tables plus the altered `teams` columns
respond. `scripts/verify-schema.mjs` does this check read-only, any time — `node scripts/verify-schema.mjs`.

### Account linking ✅ — the piece that connects the four systems
`supabase/migrations/0009_connections.sql` **(not yet run — see below)**.

- **Invites**: a coach, trainer or club issues a short spoken code (`697W-3VT3`, no O/0/I/1) against
  one squad / roster / staff record. Fourteen-day expiry, withdrawable, and it grants nothing on its
  own.
- **The player decides the scope** when they accept: `identity` (name and position),
  `development` (plus goals and match log), or `full` (plus daily check-ins). They can change it or
  disconnect at any time from `/app/connections`.
- **The database enforces it.** RLS policies are keyed on the accepted scope, so a coach cannot
  widen their own access and disconnecting removes it immediately. Acceptance runs through a
  security-definer function because the accepting player must not be able to write to a coach's rows.
- **Studies are never shared, at any level** — the connections page says so, and a test asserts no
  scope ever mentions study history.

### What linking makes real
- A trainer's **readiness is now computed from the athlete's own check-in** (energy, sleep, inverted
  soreness, mental) for linked athletes sharing `full` — and stays empty for everyone else rather
  than being estimated. The Lab shows an average only when real check-ins exist.
- Coaches and trainers see exactly what a linked person shares, stated on the profile.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **81 tests, 8 files** (new
`connections.test.ts`: scopes widen strictly, check-ins only at `full`, studies never mentioned,
codes avoid confusable characters, expiry rules).

### Verified in the running app
Issued a code from the coach's squad page → redeemed it on `/app/connections` at the `development`
level → the connection appears with its scope → changed it to `full` → confirmed. No console errors.

### Needs a decision
- **Migration 0009 has not been run yet.** Linking works in demo mode; it needs 0009 applied before
  it works against the real database.

---

## 2026-08-21 (final session block) — Phase 6: the Club OS

The last four scaffolds are gone. Every role's navigation is now live.

### Teams and staff ✅
`teams` gained an organization, an age group and a recorded squad size; `org_staff` records the
people working in the club — coaches, trainers, analysts, physios — with the team they are
responsible for. Teams with nobody assigned are flagged everywhere they appear, because a team
without a named coach is a team whose development nobody owns.

Recording someone grants them nothing. Access still comes only from their own account joining the
organization, and the page says so.

### Club methodology ✅ — the differentiator
`club_methodology` holds three documents — **how we play**, **how we train**, **how we develop
players** — as ordered sections of *principles*. Principles are the unit that matters, and the
editor says why: they are the part MIDO reads.

**The loop is wired and verified.** A club writes principles → a coach in that club drafts a
session → the session's coaching points carry the club's own principles, one per line, and the
result reports *"Written inside your club methodology (3 principles)."* With nothing written, MIDO
answers generically and says so rather than implying a methodology that does not exist. MIDO never
writes the methodology itself; it only ever answers inside it.

### Development trends ✅
Organisational coverage counted from club records: teams with staff, staff with linked accounts,
methodology documents written, recorded players by age group. The page carries an explicit
**"what this page can and cannot show"** panel: players' development maps, studies, check-ins and
clips belong to the player and a club administrator has no route to them — enforced in Postgres,
not hidden in the interface. Team-level trends are named as arriving with account linking rather
than estimated now.

### Also
- `supabase/migrations/0008_club_os.sql` — org-scoped teams, `org_staff`, `club_methodology`, with
  owner-administers / member-reads RLS.
- `lib/data/club.ts` owns the organization layer outright; `lib/data/roles.ts` is now coach + trainer
  only, and the placeholder club dataset is gone.
- `methodologyContext()` flattens principles one per line — better coaching points, better prompts.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **71 tests, 7 files** (new `club.test.ts`:
methodology counting including the "heading with no principles" case, unstaffed-team detection, and
label fallbacks).

### Verified in the running app
HQ reads the real club (4 teams, 6 staff, 9 principles) · wrote a new "U15-U16" development section
with two principles → 3/3 documents, 11 principles · created a U14 team → it appears immediately as
an unstaffed-team flag on Teams, HQ and Development trends · switched to Coach and drafted a
session → club principles landed as individual coaching points with the honest source note · no
console errors · no horizontal overflow at 375px.

### Where MIDO XI stands
All four operating systems are built on one codebase: **Player** (Locker, matches, film, training,
recovery, development, performance), **Coach** (squad, sessions, tactical board, opposition),
**Trainer** (athletes, programs, assessments), **Club** (teams, staff, methodology, trends) — plus
the Study Engine and the football knowledge graph shared across all of them.

### Next
1. **Account linking** — invite codes joining player ↔ coach ↔ trainer ↔ club. It is the single
   change that turns four working systems into one connected organization: linked athletes give
   trainers real readiness, linked players give coaches real development, and clubs get team-level
   trends honestly.
2. Phase 2 remainder: the Development Map (current → target → gap) and the Daily MIDO briefing.
3. Phase 7: clip annotations at timestamps and the analysis job infrastructure.
4. Move `performance` and `recovery` off `lib/data/demo.ts` — the last placeholder data in the app.

### Needs a decision
- **Migrations 0005, 0006, 0007 and 0008 have not been run against the hosted database.** Apply all
  four before using roles, Study, Coach, Trainer or Club in real mode.

---

## 2026-08-21 (later still) — Phase 5: the Trainer OS

Three scaffolds became three working surfaces, and the Lab now reads real data.

### The physical layer of the knowledge graph ✅
`lib/knowledge/physical.ts` — 9 training qualities (acceleration, max speed, repeat sprint,
lower-body strength, power, hamstring resilience, mobility, aerobic capacity, return to play) and
14 assessments. Each quality carries a definition, the football reason it exists, curated exercises
with real prescriptions and cues, progression and regression rules, and a weekly dose. Each test
carries its unit, its direction, its protocol, what a change in it tells you, and a retest interval.

**No invented norms.** A test never claims "elite is 1.72s" — normative data is population-specific
and asserting it would be fabrication. Qualities link back to football concepts, so the graph knows
acceleration serves running in behind.

### Athletes ✅
`trainer_athletes` CRUD with a typed, dated record (`athlete_notes`: objective, limitation, flag,
session note, note). Writing an objective or a limitation updates the roster headline, because a
limitation nobody sees is one that gets programmed straight through.

### Programs ✅
`programs` / `program_sessions` / `program_exercises`. A block is objective-first, waved across the
weeks — build weeks, a deload every fourth, and a **retest week that is the tests themselves**, with
their protocols, not the training with "retest" written next to it. Sessions can be marked
delivered. The page also shows the progression and regression rules the block was built from.

Two build buttons on purpose: **Build with MIDO** (metered) and **Build from the library**
(deterministic, free) — the difference is stated rather than hidden behind one ambiguous
"generate". The AI path is given the athlete's objective, their limitations and the tests actually
recorded, and is forbidden from inventing numbers.

### Assessments ✅
Record a result against a curated test, with its protocol shown in the form. Trends are plotted
honestly: the axis is scaled to the data and says so, and "improved" respects the test's direction —
a 10m sprint falling from 1.79s to 1.72s reads as **+3.9%**, a jump falling reads as a decline.
Retests are surfaced only for tests tied to a quality the athlete is actually being programmed for.

### Also
- `supabase/migrations/0007_trainer_os.sql` — five tables, owner-only RLS, plus read policies so a
  linked athlete can see their own notes, assessments and programs.
- `lib/data/trainer-compose.ts` — the deterministic engine half (client-safe, unit tested);
  `lib/ai/trainer-engine.ts` the metered half.
- The Lab dashboard now derives the current week of each active block from its start date, and
  flags come from recorded limitations and missing objectives — **the invented "readiness" numbers
  from the Phase 1 placeholder are gone.**
- Shared form furniture moved from `components/coach/ui.tsx` to `components/forms/ui.tsx`, since
  both role systems use it.
- Trainer navigation items are marked `live`.

### Fixed while verifying
- **Real layout bug**: dashboard grid children had no `min-w-0`, so a truncating child widened the
  track and produced horizontal overflow at 375px. Affected the coach and club dashboards too.
- The composer initially repeated identical weeks, dropped conditioning work for conditioning-led
  qualities, and wrote "retest" against training exercises. All three fixed and pinned by tests.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **64 tests, 6 files** (new
`trainer.test.ts`: library integrity, quality selection, the wave, retest sessions, limitation
propagation, and the assessment direction maths).

### Verified in the running app
Created a block for T. Okafor from an objective → the library built 8 sessions across 4 weeks, with
week 2 volume above week 1 and week 4 as a real retest session · the athlete's recorded ankle
limitation appears in every session · recorded a repeated-sprint result → trend updated to 3 results
and +29.7% (decrement 7.4% → 5.2%, lower is better) · the Lab shows week 4 of the seeded block,
derived from its start date · no console errors · no horizontal overflow at 375px.

### Note on verifying in this environment
The Browser pane is hidden (`document.hidden === true`), so Framer Motion exit animations never
complete and a closed modal lingers in the DOM at `opacity: 0`. React has already closed it — this
is an artifact of the harness, not a product bug.

### Next
1. **Phase 6 — Club OS**: organizations, teams, staff, and the methodology documents that make
   MIDO answer inside a club's own way of playing.
2. Player ↔ coach ↔ trainer account linking, so a linked athlete's check-ins become real readiness
   instead of a field the trainer fills in.
3. Phase 2 remainder: the Development Map and the Daily MIDO briefing.

### Needs a decision
- **Migrations 0005, 0006 and 0007 have not been run against the hosted database.** Apply all three
  before using roles, Study, the Coach OS or the Trainer OS in real mode.

---

## 2026-08-21 (later) — Phase 4: the Coach OS

The coach navigation is now four real surfaces instead of four scaffolds.

### Squad ✅
- `coach_players` CRUD end to end: add, edit, remove, availability status, squad number,
  position, development focus. Grouped by unit (goalkeepers → forwards) the way a team sheet reads.
- **Player pages** (`/app/squad/[id]`) with a typed, dated development history
  (`coach_player_notes`): focus, performance, in-training, in-a-match, note. Writing a *focus* note
  also updates the player's squad headline, so the list always shows what is being reinforced.
- Honest counters: how many players have no focus recorded, how many have their own MIDO account.

### Session planner ✅
- `session_plans` + `session_blocks`: objective-first sessions with duration, players, pitch,
  intensity and status, and blocks carrying phase, organisation, coaching points, progression and
  regression. Reorder, edit and delete inline.
- A time tracker compares planned minutes against session length ("5 minutes still to fill").
- **Draft with MIDO** turns the objective into a full session. The metered Claude path writes it;
  the free path composes it from the curated concept graph — verified live: an objective about
  attracting, switching and isolating produced switching-play and overload-to-isolate blocks with
  real organisations and cues.

### Tactical board ✅
- SVG board in normalised pitch coordinates (0–100, attacking upwards) so a board renders at any
  size. Five formation presets, draggable player/opponent/cone tokens, four arrow types (run, pass,
  dribble, press), zones, erase, notes, phase, save and delete.
- Board thumbnails render server-side on the index.

### Opposition ✅
- `opposition_reports`: formation, key players, and observations split by moment — in possession,
  out of possession, transition, set pieces, weaknesses.
- **Match plan** built strictly from what the coach recorded, organised into the moments of a match,
  with the coach's own words kept verbatim. With nothing recorded it **refuses**: "MIDO will not
  invent a scouting report — add what you have seen, then build the plan." Verified live.

### Also
- `supabase/migrations/0006_coach_os.sql` — the four coach tables plus `coach_player_notes`, all
  owner-only RLS, with a policy letting a player read notes written about them.
- `lib/data/coach-compose.ts` — the deterministic half of the coach engine extracted out of the
  server-only module so it is unit testable and provably model-free.
- The Touchline dashboard now reads the real Coach OS (squad, next session, next opponent, reports
  without a plan) rather than a separate demo dataset.
- Coach navigation items are marked `live`; nothing in the Coach OS is a scaffold any more.

### Checks
`npm run build` ✓ · `npm run lint` ✓ clean · `npm test` ✓ **47 tests, 5 files** (added
`coach.test.ts`: session arc and timing, concept selection, match-plan verbatim-and-no-invention
guarantees, formation geometry).

### Verified in the running app
Added a player (D. Whitfield, 10, #14) → appears grouped under Midfielders with counters updated ·
wrote a focus note on M. Al-Rashid → became the squad headline · drafted a session from an
objective → six coherent blocks, 55/60 minutes, honest "Pro feature" note on the free path · dragged
a token on the board, saved, reloaded → position persisted · built a match plan from 10 recorded
observations · empty report refused a plan · no console errors · no horizontal overflow at 375px.

### Next
1. **Phase 5 — Trainer OS**: athlete roster, program builder, assessments (the trainer dashboard is
   still reading a demo dataset).
2. Player↔coach account linking (invite codes) so a linked player's development flows both ways.
3. Attach tactical boards to session blocks and opposition plans.
4. Phase 2 remainder: the Development Map and Daily MIDO briefing.

### Needs a decision
- **Migrations 0005 and 0006 have not been run against the hosted database.** Apply both before
  using roles, the Study Engine or the Coach OS in real mode.

---

## 2026-08-21 — Phase 1 (Foundation) + Phase 3 core (Study Intelligence)

### Phase 1 — role architecture ✅

The product now transforms around who the user is, from one codebase.

- **Role registry** (`lib/roles/roles.ts`) — `player | coach | trainer | club`. Each role carries
  navigation, quick actions, terminology, an AI persona, command openers and the question its
  operating system exists to answer.
- **Session layer** (`lib/auth/session.ts`) — active role, provisioned roles, and the shell
  identity (name, identity line, badge). Demo mode switches role by cookie; real mode writes
  `profiles.role` and provisions the matching profile row on first use.
- **Adaptive shell** — sidebar, mobile nav, topbar, command palette and section titles all resolve
  from the registry. A role switcher sits under the identity card.
- **Four dashboards** — Player *The Locker* (pre-existing, moved to
  `components/dashboards/player-locker.tsx`), Coach *Touchline*, Trainer *The Lab*, Club *HQ*.
  `/app` dispatches on the active role.
- **Onboarding** — four-way role selection with role-specific profile and focus steps; a club
  account also creates its organization.
- **Migration `0005_roles_intelligence.sql`** — widened `profiles.role`; added `trainer_profiles`,
  `club_profiles`, `organizations`, `org_memberships`, `coach_players`, `trainer_athletes`, plus
  the Study Engine tables — all with RLS.
- **Honest scaffolds** — 11 new role sections (`squad`, `sessions`, `tactics`, `opposition`,
  `athletes`, `programs`, `assessments`, `teams`, `staff`, `methodology`, `intelligence`) render a
  `SectionScaffold` stating what is planned and what is already wired. No dead navigation.

### Phase 3 — the Study Engine ✅ (core)

- **Knowledge graph** (`lib/knowledge/`) — 25 curated football concepts with definitions, why it
  matters, what it looks like, cues and how to train it; 32 typed directional edges
  (`requires`, `counters`, `partOf`, `relatesTo`); 11 people (6 players, 5 coaches) with curated
  verified records and concept spines.
- **Truth model** — `verified` (curated public record) / `analysis` (MIDO interpretation) /
  `observation` (the user's own). Rendered differently, never blurred. The AI prompt forbids
  statistics, dates and match events outright.
- **Composition** — every study is composed deterministically and free: curated module bodies
  where they exist, graph-derived modules where they do not, plus match study, session plan,
  knowledge check and "apply to my game" — all built from curated material.
- **Personalisation** — `enhanceStudy()` is the metered Claude pass, gated on entitlement, quota,
  reachability and the global budget; results are saved so a generation is bought once.
- **Harry Kane** is the hand-authored proof of concept: six curated modules (DNA, movement,
  finishing, link play, scanning, decision making) at the quality bar every generated module aims
  at.
- **The loop is real** — "Add to my training" writes a real `training_sessions` row with the block
  breakdown; "Make X a development goal" writes a real `development_goals` row; both are recorded
  as study takeaways with links back. Verified end-to-end in the running app.
- **Command bar** — `parseIntent()` classifies commands deterministically and routes them into the
  owning module. The palette now layers intent → knowledge → the user's memory → role navigation.
- **`/app/library` retired** — the old Intelligence page rendered static sample data as if it were
  the user's own. It now redirects to the Study Engine.

### Verified in the running app
Role switching transforms navigation, dashboard, terminology and lens across all four roles ·
Kane study renders with verified panel, six curated modules, match study, session plan, quiz and
apply · Take-into-training created a session (Sat 22 Aug, 45m, 5 blocks) · Apply created the
"Dropping between the lines" development goal · Concept pages render graph edges · No console
errors · No horizontal overflow at 375px.

### Checks
`npm run build` ✓ · `npm run lint` ✓ (clean) · `npm test` ✓ 34 tests, 4 files (added
`knowledge.test.ts` — catalogue integrity, and `intent.test.ts` — command routing).

### Also
`npm run dev:demo` (+ `.claude/launch.json` entry) runs the dev server in demo mode regardless of
`.env.local`, so all four operating systems can be reviewed without signing in.

### Next
1. **Phase 2 remainder** — the Development *Map* (technical/tactical/physical/mental with
   current → target → gap), Daily MIDO briefing on the Locker, progressive profiling.
2. **Phase 4 — Coach OS**: make `squad` real (coach_players CRUD), then session planner, tactical
   board, opposition workspace.
3. Move `performance` and `recovery` off `lib/data/demo.ts` onto real adapters.
4. `lib/search.ts` still indexes seed data at module scope — replace with a server-side search over
   the user's real rows plus the knowledge graph.

### Needs a decision
- **Migration**: `supabase/migrations/0005_roles_intelligence.sql` has not been run against the
  hosted database — apply it before using the new roles or the Study Engine in real mode.
- **Study catalogue scope**: 11 people are curated. Expanding the catalogue is deliberate editorial
  work (verified facts are hand-written); confirm which people matter most next.
