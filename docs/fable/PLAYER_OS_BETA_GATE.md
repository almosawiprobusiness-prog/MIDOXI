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
| Migration 0031 (mido_events) applied | **BLOCKER** | Delivered, unrun. Event log silently off on real accounts until applied |
| Migration 0032 (mido_recommendations) applied | **BLOCKER** | Same. NBA works but nothing persists; Done/Not-now cannot stick |
| RLS on all player tables | **PASS** | Per prior audits; club admin has no route to player rows |
| player_timeline untouched | **PASS** | Read-time enrichment only |

## SECURITY / PRIVACY

| Item | Status | Note |
|---|---|---|
| Dev-only inspector unreachable in production | **PASS** | Measured: not-found body, generic title, zero content |
| Memory user-ownable (edit/delete every line) | **PASS** | Bin on every entry |
| Data deletion path (account) | **FAIL** | Wearable data deletable; whole-account deletion flow not verified this session — verify before beta |
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
| Stripe wiring | **LATER** | Exists (per membership pages); not exercised this session — needs one test purchase before charging real players |

## ONBOARDING

| Item | Status | Note |
|---|---|---|
| New account first-day path | **FAIL** | Progressive profiling + NBA onboarding exist, but no single guided "first 10 minutes." Acceptable for 11 hand-held founders; fix before open beta |

## ERROR HANDLING

| Item | Status | Note |
|---|---|---|
| Recommendation failure degrades to a rendered page | **PASS** | try/catch to honest empty state |
| Event emission never blocks user actions | **PASS** | Documented asymmetry, tested |
| Missing migrations produce readable errors | **PASS** | Timeline names the migration in its error |

## ANALYTICS / SUPPORT

| Item | Status | Note |
|---|---|---|
| Usage analytics | **LATER** | AI usage logged; product analytics not present. Fine for 11 players you can talk to |
| Support channel | **LATER** | Founders channel suffices for beta |

---

## The blockers, plainly

1. **Run migration 0031** (`mido_events`) — until then the event log is
   off for real accounts and the intelligence loop cannot learn.
2. **Run migration 0032** (`mido_recommendations`) — until then
   recommendations exist per-request only; Done/Not-now do not stick.
3. **Verify whole-account deletion** works end to end.
4. **One real-account smoke test**: sign up fresh, upload one real video,
   run one paid AI study, one test purchase. (Three FAILs above collapse
   into this single session.)

Everything else marked FAIL is quality debt that 11 hand-picked founders
can live with while it is worked down; everything marked LATER is a
deliberate deferral, written down so it cannot silently become a
forever.
