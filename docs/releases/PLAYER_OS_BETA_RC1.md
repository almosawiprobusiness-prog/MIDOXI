# PLAYER_OS_BETA_RC1 — 2026-08-31

The locked release candidate for the founding-player beta. Everything
here was VERIFIED against the live system, not assumed.

## Release state

| | |
|---|---|
| Release commit | the commit tagged by this file's merge (parent: `6e99780` stabilization + this RC instrumentation commit) |
| Production domain | https://mido11.com (canonical; www 308s to apex; vercel.app kept, unredirected, through ~30 Sep) |
| Database | Supabase project ckhrphzxteygblmirakf; migrations 0001–0041 applied; verify:migrations 94/94 relations, verify:db/security/access/feed all green 2026-08-31 |
| AI routing | Claude: haiku-4.5 fast / sonnet-5 standard / opus-5 deep. Vision quick: gemini-3.7-flash; Vision deep: gemini-2.5-pro (2 film reads, fallback→quick+refund). Prompt video_read v2. Vertex backend, location global |
| Cost guardrails | AI_MONTHLY_BUDGET_USD SET in production; consume-before-work + refund-on-our-failure; per-plan film-read allowances (0/20/60/200); video + video_deep cost tiers logged per call |
| Tests | 844/844 unit · 120+ live verify checks · tsc clean · lint 0 errors · build clean |
| Mobile | 375/390/430 + landscape measured clean (STABILIZATION_AUDIT.md); physical devices UNVERIFIED — see ops/REAL_DEVICE_SMOKE_TEST.md |

## Environment (names only, verified in Vercel 2026-08-31)

SET: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, VERTEX_API_KEY,
VERTEX_PROJECT_ID, VERTEX_LOCATION, GEMINI_API_KEY, GEMINI_VIDEO_MODEL,
GEMINI_VIDEO_MODEL_DEEP, AI_MONTHLY_BUDGET_USD, MIDO_ADMIN_EMAILS,
NEXT_PUBLIC_APP_URL (https, canonical), STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, 6×
STRIPE_PRICE_*, YOUTUBE_API_KEY, EMAIL_FROM.

MISSING (all fail safe):
- **MIDO_EXTENSION_IDS** — capture API fails CLOSED (no extension origin
  accepted). Required before the Chrome-store extension ships. Owner
  instruction: after the store listing is approved, copy the 32-char id
  from its chromewebstore URL and set `MIDO_EXTENSION_IDS=<that id>` in
  Vercel (Production), then redeploy. Do not guess the id; unpacked dev
  ids differ from the store id.
- RESEND_API_KEY — email notifications feature-flagged off; auth email
  is Supabase's and unaffected.
- WHOOP_CLIENT_ID/SECRET — wearables report themselves unavailable.

No localhost values, no http URLs, no dev keys in production. No secret
is exposed client-side (NEXT_PUBLIC_* carries only the two public keys
and the app URL).

## Change policy during beta

Allowed into production: P0/P1, security, data loss, broken mobile,
provider failures, usability problems demonstrated by users, small
fixes with repeated evidence. Everything else →
docs/product/BETA_BACKLOG.md first. Vision routing changes require a
new benchmark run (scripts/vision-bench.mjs), not a newer model name.

## Known limitations (carried, documented)

12MB inline upload ceiling on Vertex (larger footage → YouTube link);
full-match analysis refused honestly; physical-device smoke pending;
coach/trainer/club consoles carry deferred P2 polish; frames lane caps
viewer claims at inferred by design; one 55MB blob in git history.
