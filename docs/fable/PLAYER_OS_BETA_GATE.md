# Player OS — Beta Gate

**Date:** 25 August 2026 · **Standard:** could 11 real footballers use
this weekly, unexplained, and trust it with their development?

Statuses: **PASS** · **FAIL** · **BLOCKER** (must clear before any real
player) · **LATER** (accepted for beta, scheduled after).

---

## PRODUCT

| Item | Status | Note |
|---|---|---|
| Core loop navigable without explanation (goal → study → train → match → review → film) | **PASS** | Walked end-to-end in browser; every step links to the next |
| One coherent world across screens | **PASS** | Fixed this session: one seeded season, one fixture clock, one day-counting function |
| Locker prioritises rather than lists | **PASS** | NBA panel leads; briefing drops covered lines; visual weight uneven by design |
| Every recommendation answers "why this?" | **PASS** | Sources in plain words; memory quoted when it bears |
| Empty states sequence the first action | **FAIL** | NBA/Memory exemplary; several panels still say "nothing yet" without ordering. Not a blocker — new accounts get the NBA onboarding state |
| Nav breadth | **FAIL** | 18 destinations for a 6-section loop. See CUT_LIST. Cutting is a product decision, not done unilaterally |

## AI

| Item | Status | Note |
|---|---|---|
| No invented statistics anywhere | **PASS** | Verified across Performance, Development, Recovery, Studies |
| AI refusals honest (no keys / quota / budget) | **PASS** | `enhanceStudy` returns the curated study with a plain note |
| Memory read before AI writes | **PASS** | `memoryPromptBlock` in the cached system block |
| Memory visible to the deterministic loop | **PASS** | Fixed this session — attached, never scored |
| Context bounded per call | **PASS** | Goals + concepts + subject, not the whole record; usage logged with cache metrics |
| Monthly budget cap enforced server-side | **PASS** | `withinAiBudget` gates every generation |

## VIDEO

| Item | Status | Note |
|---|---|---|
| Honest capability line | **PASS** | Short clips, user-driven observations, confidence labels; no claimed auto-analysis of full matches |
| Frame reading (CORS) limits stated | **PASS** | Sample footage chosen to permit it; YouTube tools degrade honestly |
| 90-minute automated analysis | **LATER** | Correctly not claimed. Do not add UI that implies it |
| Upload path (Supabase storage) exercised with a real large file | **FAIL** | Not verifiable in demo; needs one real-account test before beta |

## MOBILE

| Item | Status | Note |
|---|---|---|
| Locker at 375px | **PASS** | Clean hierarchy, NBA first, no horizontal scroll |
| Check-in thumb-reachable | **PASS** | Bottom-sheet sliders, ~10s to complete |
| Film Room at 375px | **PASS** | No overflow; discover cards stack |
| Full mobile pass of every route | **LATER** | Spot-checked the daily-use routes; long tail (reports, settings) unaudited |

## DATABASE

| Item | Status | Note |
|---|---|---|
| Migration 0031 (mido_events) applied | **READY — AWAITING USER RUN** | SQL validated; apply+verify script in `docs/beta/APPLY_MIGRATIONS.md` |
| Migration 0032 (mido_recommendations) applied | **READY — AWAITING USER RUN** | Same script |
| Migration 0033 (analytics + feedback) applied | **READY — AWAITING USER RUN** | Same script; consumers fail soft until then |
| RLS on all player tables | **PASS** | Per prior audits; club admin has no route to player rows |
| player_timeline untouched | **PASS** | Read-time enrichment only |

## SECURITY / PRIVACY

| Item | Status | Note |
|---|---|---|
| Dev-only inspector unreachable in production | **PASS** | Measured: not-found body, generic title, zero content |
| Memory user-ownable (edit/delete every line) | **PASS** | Bin on every entry |
| Data deletion path (account) | **READY — AWAITING USER RUN** | Code verified: storage purge (avatars, posts, uploaded video) before auth cascade; all user tables cascade; three deliberate `set null` retentions documented. Runtime proof: `REAL_ACCOUNT_TEST.md` §F |
| Shared report tokens leak nothing when invalid | **PASS** | Absent/expired/revoked render identically |

## PERFORMANCE

| Item | Status | Note |
|---|---|---|
| Dashboard renders under ~1s warm in dev | **PASS** | /app ~400–600ms application time in dev logs |
| Recommendation pipeline cost | **PASS** | Six bounded parallel reads + pure ranking; no model call |
| Production build clean | **PASS** | Verified this session |

## BILLING

| Item | Status | Note |
|---|---|---|
| Free tier complete and honest | **PASS** | Curated studies full; paywalls label what is paid |
| Stripe wiring | **READY — AWAITING USER RUN** | Test-mode script: `REAL_ACCOUNT_TEST.md` §E (checkout, persistence, cancel, failed card, abandoned checkout) |

## ONBOARDING

| Item | Status | Note |
|---|---|---|
| New account first-day path | **ACCEPTED RISK** | Progressive profiling + NBA onboarding + the Founding XI welcome note; no rigid tutorial by design. Revisit before open beta |

## ERROR HANDLING

| Item | Status | Note |
|---|---|---|
| Recommendation failure degrades to a rendered page | **PASS** | try/catch to honest empty state |
| Event emission never blocks user actions | **PASS** | Documented asymmetry, tested |
| Missing migrations produce readable errors | **PASS** | Timeline names the migration in its error |

## ANALYTICS / SUPPORT

| Item | Status | Note |
|---|---|---|
| Usage analytics | **PASS (code)** | Migration 0033 + `lib/analytics/track.ts`; 12 named actions instrumented; separate from the football event log by design |
| In-product feedback | **PASS (code)** | Topbar feedback button; 👍/👎 on study pages and film analyses |
| Support process | **PASS** | `docs/beta/FOUNDING_XI_SUPPORT.md` — severity, comms, emergency disable, rollback |
| Beta metrics | **PASS** | `docs/beta/FOUNDING_XI_METRICS.md` — day-1/week-1/loop/NBA-trust queries |

---

## RELEASE GATE — 25 August 2026 (beta phase)

Statuses: **PASS** (verified), **READY — AWAITING USER RUN** (everything
that can be prepared is prepared and verified; the run itself needs your
credentials/email/payment and is scripted step-by-step), **ACCEPTED
RISK** (known, bounded, written down).

| Blocker | Status | Evidence / where the run is scripted |
|---|---|---|
| Migration 0031 | **READY — AWAITING USER RUN** | SQL validated line-by-line (RLS, owner-only policies, append-only, idempotency index, revoke-then-grant); emitter insert path matches policy. Apply + verify script: `docs/beta/APPLY_MIGRATIONS.md` |
| Migration 0032 | **READY — AWAITING USER RUN** | Same validation; one-active-per-kind enforced in schema. Same script |
| Real account signup | **READY — AWAITING USER RUN** | `docs/beta/REAL_ACCOUNT_TEST.md` §A — needs a real email only you receive |
| Real account player flow | **READY — AWAITING USER RUN** | §B, ~15 min, every step maps to verified code paths |
| Real video upload | **READY — AWAITING USER RUN** | §C, including the failure cases (bad file, interrupted upload, vertical phone video) |
| AI study (production path) | **READY — AWAITING USER RUN** | §C item 2; refusal paths (no key / quota / budget) are code-verified PASS already |
| Payment test | **READY — AWAITING USER RUN** | §E, Stripe test mode; entering payment details is yours by definition |
| Account deletion | **READY — AWAITING USER RUN** | Code verified this session: storage purge before cascade; every user table cascades (checked all migrations); the three `set null` cases are other people's records, correctly anonymized. Runtime proof: §F |
| Cross-account privacy | **READY — AWAITING USER RUN** | RLS policies verified in SQL; behavioral proof needs two real accounts: §D |
| Mobile core loop | **PASS** (demo) / §G re-run on real account | Locker, check-in, Film Room verified at 375px this session |
| Production build | **PASS** | Clean, verified this session |
| Test suite | **PASS** | 665 green, 41 files |

## Accepted risks (written down so they cannot become forever)

- **UTC day counting** — evening users far from UTC can see day labels
  flip early. Uniform across all surfaces now; the real fix needs
  player timezone on the profile.
- **No product analytics before migration 0033** — `track()` fails soft
  until it is applied; apply with the other two.
- **Error observability is Vercel logs + client-error relay**, not an
  APM. Right-sized for 11 users; revisit at 100.
- **Empty-state sequencing debt** on secondary panels.

## What changed since the previous gate

The four items previously marked FAIL because they were unbuilt are now
built and verified in code: product analytics (migration 0033 +
`lib/analytics/track.ts`, 12 named events instrumented), beta feedback
(button in the topbar, 👍/👎 on study pages and film analyses),
Founding XI onboarding note, client-error relay. The remaining
"AWAITING USER RUN" items are irreducibly yours: they require your
email, your Supabase dashboard, and your payment card. The scripts
turn all of them into ~45 minutes.
