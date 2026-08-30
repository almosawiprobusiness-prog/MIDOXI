# MIDO11.COM — domain migration plan

Written 2026-08-30. **EXECUTED the same day** — status per step below.
The move was controlled, additive, and reversible throughout;
mido-xi.vercel.app keeps serving.

## Execution record (2026-08-30)

| Step | Status |
|---|---|
| 1. Vercel domains | ✅ owner had already attached both; flipped canonical: apex → Production, www → 308 → apex |
| 2. DNS | ✅ already valid (owner) |
| 3. `NEXT_PUBLIC_APP_URL` | ✅ → https://mido11.com (recreated as the var type Vercel now requires for public prefixes) + redeploy |
| 4. Supabase Auth | ✅ Site URL → mido11.com; redirect list carries BOTH `mido11.com/**` and `mido-xi.vercel.app/**` |
| 5. Stripe | ✅ second endpoint `we_1UAHbiRca6fER0GRGj0uUQfE` → mido11.com/api/stripe/webhook, same six events; `STRIPE_WEBHOOK_SECRET` rotated to its signing secret; old endpoint disabled after deploy verification (one secret env → one verifying endpoint; the old one would 400 anyway) |
| 6. Extension | ✅ 0.3.1: production base → mido11.com, host_permissions carries both origins; zips rebuilt; site download refreshed. Store upload = owner. Installed 0.3.0 users keep working against vercel.app until they update |
| 7. WHOOP | ➖ moot — WHOOP env is not configured in production |
| 8. vercel.app redirect | ⏳ deliberately NOT redirected yet (30 clean days; old share links + installed extensions) |
| 9. metadataBase / robots / sitemap | ✅ shipped (`app/robots.ts`, `app/sitemap.ts`, metadataBase from `env.appUrl`) |
| 10. Analytics | ✅ no domain assumptions in code; dashboards unaffected |

Session-cookie note: auth cookies are per-domain. Players signed in on
the vercel.app host stay signed in there; they sign in once on
mido11.com. Nothing breaks — two live hosts, two sessions.

## Decision: canonical shape

**Recommendation: `mido11.com` = marketing + app together** (the
current single-deployment shape), with `www.mido11.com` → 308 →
`mido11.com`. No `app.` split — the codebase is one Next.js app with
one auth domain, and splitting hosts would double the auth-cookie,
CORS and extension-origin surface for zero product gain today. Revisit
only if marketing ever becomes a separate deployment.

## The one architectural fact that makes this easy

The app reads its own origin from **one env var**:
`NEXT_PUBLIC_APP_URL` (`lib/env.ts:16`), which also feeds the extension
Origin allowlist (`lib/extension/api.ts:32`). There are no hardcoded
production hostnames in `lib/` or `app/`. The migration is therefore a
config change, not a code change.

## Runbook (ordered, reversible at every step)

1. **Vercel**: add `mido11.com` + `www.mido11.com` to the project
   (Domains tab). Vercel provisions certs; the old
   `mido-xi.vercel.app` keeps working throughout and afterwards —
   Vercel serves both, `.vercel.app` never breaks.
2. **DNS** (registrar): apex A/ALIAS → Vercel (`76.76.21.21` or the
   values Vercel shows), `www` CNAME → `cname.vercel-dns.com`.
   Propagation is the only waiting step.
3. **Env**: set `NEXT_PUBLIC_APP_URL=https://mido11.com` in Vercel
   production env → redeploy. This updates: extension CORS allowlist,
   any absolute-URL generation. (Share links use request origin —
   `shareUrl` takes `origin` from the caller — so they follow the host
   automatically.)
4. **Supabase Auth**: Dashboard → Authentication → URL Configuration:
   set Site URL to `https://mido11.com`; ADD `https://mido11.com/**`
   to Redirect URLs **without removing** the existing
   `https://mido-xi.vercel.app/**` (keep both during transition).
5. **Stripe**: webhook endpoints are configured by URL. ADD a second
   endpoint `https://mido11.com/api/stripe/webhook` with the same
   events (checkout.session.*, customer.subscription.*,
   account.updated); keep the old one until cutover is verified, then
   disable (not delete) it. Checkout success/cancel URLs are built
   from the request origin — no change needed.
6. **Extension**: `MIDO_EXTENSION_IDS` is id-based (unchanged). The
   extension's own `host_permissions`/connected origin points at the
   app URL — ship an extension update if its manifest names the vercel
   host; verify `npm run verify:extension` against the new origin.
7. **WHOOP OAuth** (wearables): the callback URL registered with WHOOP
   must gain `https://mido11.com/api/wearables/whoop/callback` — same
   add-both-then-retire pattern.
8. **Redirects**: keep `mido-xi.vercel.app` serving (Vercel default).
   Optionally add a permanent redirect from the vercel host to
   mido11.com in `next.config` AFTER 30 clean days — not before, so
   old share links and the extension's installed base keep working.
9. **SEO/meta**: set `metadataBase` to `https://mido11.com`; add
   `app/robots.ts` and `app/sitemap.ts` (marketing routes only; `/r/`
   and `/app/` stay unindexed — `/r/[token]` already carries per-page
   robots). Social OG tags inherit metadataBase.
10. **Analytics**: no domain assumptions found in `lib/analytics` —
    verify the dashboard filters after cutover.

## Rollback

Every step is additive until step 8. Rolling back = point
`NEXT_PUBLIC_APP_URL` back at the vercel host and redeploy; both
Supabase and Stripe still carry the old URLs because nothing was
removed.

## Owner actions when executing (cannot be done by the agent)

- Registrar DNS records (step 2).
- Supabase Auth URL additions (step 4, dashboard).
- Stripe webhook endpoint addition (step 5, dashboard).
- WHOOP developer console callback (step 7).
- The Vercel domain attach (step 1) — dashboard.

## Explicitly deferred

Email links (no email provider integrated), `app.mido11.com`,
white-label domains. None block the move.
