# Stabilization audit — 2026-08-31

Full-product pass after the Vision accuracy work: static code audit (36
findings) + real-browser mobile QA at 375/390/430 and landscape on the
running app. Every finding lists its fate. Verification for fixes: gates
(844 tests / tsc / lint 0 / build) after each group, plus live checks noted.

## P0 — security / data loss (5 found, 5 fixed)

| # | Issue | Fix | Verified |
|---|---|---|---|
| 1 | Extension CORS failed OPEN: unset `MIDO_EXTENSION_IDS` accepted ANY chrome-extension:// origin with credentials, in production | Fails closed in production (deny all extension origins until ids are set); registered in `configIssues()` so the gap is named at boot | code + config issue renders |
| 2 | `http://localhost:3000/3100` in the production CORS allowlist — credentialed pass for any local page against prod | Localhost origins only outside production | code |
| 3 | Study "complete session" discarded the action result — a failed save destroyed the typed summary behind a success-looking close | Result checked; panel stays open, error rendered, text kept | code |
| 4 | Study notes: failed `addStudyNote` silently cleared the note text | Text kept, error rendered: "your note is still here" | code |
| 5 | `reportPost` failures showed "Reported. Somebody will look at it." | Result checked; failure rendered in the dialog | code |

## P1 — functional / mobile (12 found, 12 fixed)

| # | Issue | Fix |
|---|---|---|
| 6/7 | Vision passage job: a refused/thrown `advanceJob` left `state: running` → infinite spinner, no way out | `stalled` state + catch; "Resume reading" button appears with the error |
| 8 | Locker week strip `grid-cols-7` at 375px (~29px columns) | `grid-cols-1 sm:grid-cols-7` |
| 9 | Drawing-bar action row (5 buttons, no wrap) overflowed 375px, Discard off-screen | `flex-wrap`; measured live: wraps to 3 rows, all buttons on-screen |
| 10 | Study `onUnavailable={() => {}}` — failed embeds showed a dead black box | Unavailable state renders the refusal copy |
| 11/12 | Post delete / user block discarded results — failures looked identical to success | Results checked, errors rendered |
| 13/14 | `ConfirmDelete` (the shared two-step delete behind most destructive controls) never checked `onConfirm`'s result | Now reads `{ok,error}`, catches throws, renders the refusal in place |
| 15 | Every input at 14px → iOS zoomed the viewport on focus, app-wide | Global `@media (max-width:767px)` 16px rule in globals.css; verified live: 29/29 settings inputs at 16px |
| 16/17 | Hydration mismatches: `toLocaleString()` with no locale/timeZone (wearables), en-GB dates without timeZone in 5 client components — dates shift a day west of Greenwich | Locale + `timeZone: "UTC"` pinned at all 7 sites |
| + | `unplayable` 15s timeout latched permanently even when footage finished loading seconds later (slow connections / throttled tabs) — Draw + analysis locked on a playing video | `loadeddata` listener clears the latch; found by live repro, root-caused, fixed |
| + | Comment delete button was `opacity-0 group-hover` — invisible on touch devices | Visible at 60% on mobile, hover behaviour kept on desktop |
| + | Telestration `setPointerCapture` could throw on released pointers | try/catch guard |

## P2 — consistency (13 found, 11 fixed, 2 deferred)

| # | Issue | Fate |
|---|---|---|
| 18 | Film transport row overflow < 420px | fixed (`flex-wrap`) |
| 19 | Failed caption edits rendered in success green | fixed (separate `failed` state) |
| 20 | Post options popover had no outside-tap close | fixed (backdrop) |
| 21 | Long name overflowed the block menu | fixed (truncate) |
| 22 | Notification list mutated while open (stale-closure guard) | fixed (effect keyed on `open`) |
| 23 | Community FAB reserved 80px for a bottom nav that doesn't exist; ignored safe area | fixed (`bottom-[max(1.25rem,env(safe-area-inset-bottom))]`) |
| 24 | Safe-area insets applied in exactly one component; `black-translucent` status bar with no top inset | fixed (topbar `pt-[env(safe-area-inset-top)]`, main bottom inset) |
| 25–28, 32, 34 | Unprefixed `grid-cols-2/3/4` in training dialog, coach session tools, StatBand(3), embedded stage, opposition form, locker stats | all fixed (`grid-cols-1/2 sm:` ladders) |
| 29 | `/api/client-error` unauthenticated + unlimited log writer | fixed (per-instance token bucket, 30/min) |
| 30 | 24px colour swatches (the control that decides what a mark means) | fixed (40×40 hit areas on touch, verified live) |
| 31 | Role switcher swallowed refusals | fixed (`switchRole` returns a result; refusal rendered) |
| deferred | Silent action results in coach/trainer/club consoles (methodology, staff, team, notes, assessments) + notification mark-all-read + NBA confirm | secondary surfaces; `ConfirmDelete` covers their destructive paths; register kept so the next pass finishes the sweep |
| deferred | `AiFeedback` fire-and-forget rating | cosmetic by design — a lost rating costs nothing and shouldn't interrupt |

## P3 (2 found, 2 fixed)
Drawing-bar header wrap; film transport hint wrap. The demo "Load this
week" chart rendering thin at 375 was checked and is data-accurate (zero-
minute days), not a defect.

## Real-browser mobile QA (local, same build as prod)

Method: emulated mobile viewport (touch + mobile UA), JS layout probes
(scrollWidth vs innerWidth, element rects, computed font sizes) on every
route; trusted-input interaction tests on the critical surfaces; visual
screenshots on film + community + settings + training.

- 375/390/430: **zero horizontal overflow** on Locker, Matches, Film Room
  (list + video page + drawing open), Training, Development, Study,
  Community (feed/profile/composer), Publish, Profile, Settings,
  Onboarding, Login.
- Film drawing at 375: Draw → 7 tools, wrapped bar, real drag drew an
  arrow at exact coordinates (no offset), swatches 40×40. Landscape 812×375: no overflow.
- Composer at 375: true bottom sheet, kind chips wrapped, counter visible.
- One environment artifact chased to ground: a dev tab corrupted by ~30
  fast-refreshes stopped hydrating (fresh tab fine, production fine) — not
  a product defect, but it *led to* discovering the real `unplayable`
  latch bug above.
