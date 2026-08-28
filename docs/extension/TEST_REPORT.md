# MIDO XI Capture — Test Report

Date: 2026-08-28 · Branch: `feature/mido-xi-capture`

## v0.2 — FREE MODE + LOCAL LIBRARY + IMPORT

**Unit:** 700 tests / 43 files, all passing — 17 new in
`tests/unit/extension-library.test.ts`: search semantics (AND terms across
title/observation/channel/category, case-insensitive), category+text
combination, newest-first sort, date labels, the clipboard format, Markdown
export (readable, newest first, watch links, separators), JSON round-trip,
import wire shape (id = clientKey), pending-import partitioning, and the
v0.1 pending-queue migration (keeps client keys, skips junk/dupes/empties,
never invents notes). Integration: 29/29 (unchanged, now exercising the
`via` analytics prop). Strict TS clean; app + extension production builds clean.

**Real browser (production bundle, chrome-shim harness):**

| Scenario | Result |
|---|---|
| Free capture against a REAL 401 (real-keys server, no cookies) | Capture view with "Local" badge, no goals section, "Save moment", quiet Connect link |
| First local save | "Saved / 5:14 / **Your first moment is in your library**", count badge → 1 |
| **Privacy: free save is local** | Network log: exactly ONE request total (session status GET, 401) — zero capture data transmitted |
| Library | Card with thumbnail-watch, title, stamp, "Today", channel, quoted note, category chip, Watch/Copy/Edit/Delete |
| Search | "shoulders" → only the scanning capture; multi-term AND verified at unit level |
| Filter | Chips built only from present categories; Movement isolates the movement capture |
| Edit | Inline edit saved and re-rendered |
| Delete + undo | 2→1, "Moment deleted" bar, Undo → 2 |
| Export .md | Blob intercepted: correct header, count, both sections, timestamped watch links |
| Persistence | Reload (= popup closed/reopened): both moments + count badge survive |
| **Scale (1000 records)** | Search 6.6ms · narrowed 0.7ms · full 1000-card rebuild 24ms · correct result counts (125/8-word, 67/15-category) |
| Connected mode | No badge, goals section, "Save to MIDO" |
| Import banner | "4 local moments / Import them…? They also stay on this device." |
| **Partial-failure import** | Seeded 1 invalid among 4: "3 imported · 1 could not be imported — they stay safely local"; 3 "In MIDO" chips; all 4 local copies intact; the 3 verified in the demo Film Room; invalid one absent |
| **Duplicate protection** | Flipped an imported moment back to "local", re-imported: server deduped via clientKey — still exactly one row in the Film Room |
| Connected save failure | fail=save: error banner + **"Save locally instead"** → observation intact → saved to library, count advanced |
| Settings | Account, Export library, **armed clear** ("Delete all 5 moments — click again to confirm"), environment, shortcut, privacy, version |

**Save-failure diagnosis (the "stuck after Save Moment" report):** ROOT CAUSE —
no product bug. The Browser pane's ref-coordinate clicks were landing ~25%
off-target after the display moved to 125% scaling (devicePixelRatio 1.25),
and the hidden pane could not screenshot to recalibrate. Evidence:
`elementFromPoint` at the click coordinate returned the intended chip (the
coordinate was right, the transport wasn't); the draft held the typed text but
no category (the chip click before Save also never landed); and with clicks
dispatched at the DOM level the UNCHANGED save path completed first try. Zero
code changed for this. Real extension clicks are real user clicks — the
failure mode cannot exist in production.

**SPA navigation recheck (two videos, one sequence, fresh storage):**
Video A ("Barcelona vs Athletic — Full Match", 5:14) captured → navigate →
Video B ("Rodri — Tactical Analysis", 18:42) captured → Video C ("Defensive
Shape Clip", 4:05) captured. Library shows all three, newest first, each with
its own title/stamp/observation; the three Watch links carry three distinct
video ids each with its own `&t=` (intercepted and verified); and Video A's
draft did NOT leak into Video B's textarea (drafts are keyed by video). No
stale metadata anywhere — as designed: no persistent page state exists to
go stale.

**Mode switching (local → connected → logout → local):** connected shows the
goals and "Save to MIDO" with the library intact and the import banner offered;
logged out shows the Local badge, "Save moment", goals COMPLETELY gone (the
extension holds no cloud data to leak), import banner gone, library intact at 3.
Mode is re-derived on every popup open — no reload gymnastics.

**Privacy re-sweep:** across the three local saves of the SPA sequence, the
network log shows zero requests to `/api/extension/*`; the only request in the
whole window was the connected-phase session status GET.

**Copy content audit:** the clipboard format (unit-pinned) contains title,
timestamp, observation, category label and the timestamped URL — no internal
ids, no sync state, no session values.

**Harness environment caveats (not product issues):** the Browser pane ran
`visibility: hidden`, where Chrome denies all clipboard writes and clamps
timers — so the final clipboard write could not fire there (its formatting is
unit-pinned, its wiring verified, and `copyText` has an execCommand fallback);
and synthetic JS clicks were used after display scaling (dpr 1.25) broke
ref-coordinate clicks — real pointer hit-testing was already proven in the
v0.1 pass and the owner's real-Chrome test. Owner smoke test: one Copy click
and one capture in real Chrome covers both.

---

## v0.1 — original report

## Automated — unit (vitest)

`npm test` — **683 tests, 42 files, all passing**, including the new
`tests/unit/captures.test.ts` (33 assertions across 13 tests):

- YouTube URL parsing: watch, watch+params, mobile, shorts, embed, live,
  youtu.be, youtu.be+t — and refusals (homepage, feed, non-YouTube host, junk)
- Video id shape; timestamp formatting (m:ss, h:mm:ss, junk-proof); canonical
  timestamped URL (t= dropped at 0, fractions floored)
- Category vocabulary (15, labels, refusals)
- `captureIssue()` — the shared contract: valid full/minimal payloads pass;
  refusals for id/URL mismatch, bad id, empty/oversized observation, timestamp
  bounds (negative, >12h, NaN, string), non-YouTube thumbnail hosts, unknown
  category, malformed/oversized goal id, oversized title/channel/clientKey
- Existing `events.test.ts` still pins the event vocabulary with
  `STUDY_MOMENT_CAPTURED` admitted

`extension npm run typecheck` — strict TS, clean.

## Automated — integration (`scripts/verify-extension-api.mjs`)

Against a live `npm run dev:demo` server — **29 checks, 0 failures**:

- SESSION: 200 with extension Origin; ACAO reflects the origin; credentials
  allowed; auth state + goals + appUrl in body; **403 for a web Origin**;
  preflight 204
- CAPTURE validation: 403 evil Origin; 400 malformed JSON; 400/422 oversized
  body; 422 with the right `field` for: bad video id, URL naming a different
  video, empty observation, observation past cap, unknown category, non-YouTube
  thumbnail, negative timestamp, timestamp past 12h
- Persistence: valid capture saves (id + openUrl returned); **repeat clientKey
  dedupes** (`deduped: true`)
- Surfacing: `/app/film-room?moment=<id>` renders the Saved Moments section with
  the observation text and 34:17 timestamp; the goal page renders Study Moments

## Real browser (Browser pane, real built `dist/popup.js` via the chrome-shim harness)

The harness loads the production bundle with `chrome.*` shimmed and talks to the
live demo server over HTTP — the popup code, styling, fetches, and storage are
all real. Verified by accessibility tree, console, network log, and JS probes:

| Scenario | Result |
|---|---|
| Watch page, playing at 34:17 | Capture view: title "Harry Kane — Every Movement Pattern Explained", channel, **34:17**, thumbnail, textarea focused |
| Goals load | The two **active** demo goals shown with category sub-labels; the "monitoring" goal correctly excluded |
| Categories | 8 shown + "+ More" expands to all 15 |
| Timestamp refresh | 34:17 → 34:28 after the re-read injection |
| Type + select goal + select category | `aria-pressed` states correct; **draft persisted to storage on every input** |
| Draft recovery | Reload (= popup closed/reopened): observation, goal AND category restored |
| Save | SAVED state: "Saved / 34:17 / Added to your Player OS / View in MIDO / Capture another moment" |
| Server round trip | Capture appears in `/app/film-room` with `origin: chrome_extension`, `goalId: g1`; goal page shows it under Study Moments |
| Not on YouTube | Empty state with "Open a YouTube football video…" + Open YouTube / Open MIDO XI |
| Signed out (401) | Connect view with the 3-line onboarding + Connect MIDO XI + "I've signed in — check again" |
| Offline | "MIDO XI is unreachable… nothing is lost" + Try again |
| **Failed save** | Error banner, observation kept in the textarea, **"1 unsaved moment" strip** with Retry; pending survives reload |
| **Retry after recovery** | Pending posts with its original clientKey, strip clears, capture verified on the server |
| Shorts | Detected: "Rodri scans before every touch", channel, 0:31 |
| Settings | Account name, environment select (production/localhost), shortcut info, Open Player OS, version |
| Fonts | All three brand woff2 files served locally, 200 |
| Console | Zero errors across every scenario |

One real bug was caught by this pass: the popup bundle predated the demo-goal-id
relaxation and refused `goalId: "g1"` — fixed (shape check widened; ownership is
the server's RLS check) and re-verified.

## Not covered here (owner, ~5 min) — cannot be automated from this environment

1. **Load `extension/dist/` unpacked in real Chrome** (native file dialog) and run
   one capture on youtube.com against a server with migration 0035 applied —
   confirms the two things the harness must fake: `activeTab` script injection on
   real YouTube DOM, and session-cookie attachment from a real extension origin.
2. Migration 0035 applied to the live database (SQL editor, then `npm run verify:db`).
3. Voice input end-to-end (needs a real microphone grant; the button is
   feature-detected and fully error-guarded, and degrades to typing).

## SPA navigation note

The dreaded stale-metadata-after-SPA-navigation class is structurally absent:
there is no content script holding state — every popup open injects a fresh read
of the live page. The "switch video without reload, capture again" sequence
reduces to two independent fresh reads, which is what the harness scenarios
exercise.
