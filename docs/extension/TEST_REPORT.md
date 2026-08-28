# MIDO XI Capture — Test Report

Date: 2026-08-28 · Branch: `feature/mido-xi-capture`

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
