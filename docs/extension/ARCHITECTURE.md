# MIDO XI Capture — Architecture

A Chrome extension (Manifest V3) that saves football moments from YouTube into the
existing MIDO XI Player OS. It is a capture companion, not a product: one popup,
one table, two API routes, and two places in the Player OS where the moments land.

## Current relevant systems (audited before building)

| System | What exists | Where |
|---|---|---|
| Auth | Supabase cookie sessions via `@supabase/ssr`; `getAuthUser()` verifies per request; no token/bearer auth anywhere | `lib/supabase/server.ts`, `proxy.ts` |
| Study | `study_sessions` + `study_notes` (session-scoped, `at_seconds`) | `lib/data/study.ts`, migration 0001 |
| Goals | `development_goals` (`status: active/monitoring/achieved`), `development_evidence` | `lib/data/development.ts` |
| Events | `mido_events` append-only log, closed vocabulary, `emitMidoEvent` never throws | `lib/events/*`, migration 0031 |
| Analytics | `product_analytics` insert-only, closed `ProductEvent` union, no free text | `lib/analytics/track.ts`, migration 0033 |
| Validation | House style: inline guards + DB CHECK constraints (Zod installed, unused) | every `actions.ts` |
| API | Server actions almost everywhere; route handlers only where cookies/webhooks demand | `app/api/*` |
| Demo mode | Whole product runs on seed data with no keys (`isDemoMode`) | `lib/env.ts`, `lib/data/store.ts` |

## Data model — why a new table

A capture is a drive-by: five seconds between noticing and pressing play. The
existing `study_notes` requires a `study_sessions` row — a deliberate sitting.
Forcing a session per capture makes the cheap thing expensive, so captures get
one dedicated table:

**`study_captures`** (migration `supabase/migrations/0035_study_captures.sql`)

- `user_id` (owner, RLS all four verbs), `source_type='youtube'`
- `video_id` (11 chars), `source_url`, `video_title`, `channel_name`, `thumbnail_url` — denormalised
  on purpose: captures reference football the player does not own; a `videos` row
  would drag every passing YouTube video into their film library
- `timestamp_seconds` (numeric, 0–43200), `observation` (1–1000 chars)
- `category` (15-value football taxonomy CHECK)
- `goal_id` → `development_goals` (SET NULL), `study_id` → `study_sessions` (SET NULL) —
  the bridges into the loop; a capture can become session material later with a one-column update
- `client_key` + partial unique index `(user_id, client_key)` — retry idempotency
- House pattern: RLS owner policies, `revoke all from anon, public, authenticated`
  then grant back, `notify pgrst`.

The shared contract lives in `lib/data/capture-types.ts` — pure, client-safe,
bundled verbatim into the extension and imported by the API routes and the
Player OS UI, so the three surfaces cannot drift.

## Auth flow — the extension holds no credentials

Chrome treats a fetch from an extension page as **same-site** with any host in its
`host_permissions`, so the player's existing Supabase session cookies ride along on
`credentials: "include"`. The routes authenticate exactly like every page in the
app (`supabase.auth.getUser()` on the cookie session). Signed in to MIDO XI in the
browser ⇒ signed in in the extension. Nothing stored, nothing to leak, nothing to
expire separately. "Connect MIDO XI" simply opens `/login` in a tab.

The cost of cookie auth is CSRF care, paid in `lib/extension/api.ts`:

- **Origin gate**: state-changing requests are accepted only from the app's own
  origins or a `chrome-extension://` origin; a cross-site web page is refused 403
  before any handler logic. `MIDO_EXTENSION_IDS` (env) pins specific extension ids
  in production; unset (dev) any extension origin passes — the residual exposure is
  another installed extension that also requested MIDO host permissions, which
  Chrome's install warning already surfaces.
- The extension id is **stable** (`fkdfojkjedbkikagcmgpioacioojelja`) because
  `manifest.json` carries a fixed public `key`.
- CORS headers are belt-and-braces (Chrome exempts host-permitted extension
  fetches), reflected only for allowed origins, never wildcarded.

## Data flow

```
YouTube tab                     popup (extension page)                MIDO XI server
────────────                    ──────────────────────                ──────────────
                    open ──────▶ chrome.tabs.query (activeTab)
                                 chrome.scripting.executeScript ────▶ [reads live <video>, title, channel]
                                 GET /api/extension/session ────────▶ cookie auth → name + active goals
                                 player types observation
                                 (draft → chrome.storage.local)
                                 POST /api/extension/captures ──────▶ Origin gate → captureIssue() →
                                                                      goal ownership (RLS) → insert
                                                                      → track("capture_saved")
                                                                      → emit STUDY_MOMENT_CAPTURED
                                 ◀── { id, openUrl } ────────────────
                    SAVED, View in MIDO → /app/film-room?moment=<id>
```

No content script, no youtube.com host permission: `activeTab` + `scripting`
grant one read of the page at click time. Every capture reads fresh, so SPA
navigation can never serve stale metadata — the bug class is structurally absent.

## Security model

- Server revalidates everything (`captureIssue()` — same function the popup ran,
  but the server's run is the contract). URL must name the same video id; thumbnails
  only from `i.ytimg.com`/`img.youtube.com`; observation ≤ 1000 chars; body ≤ 16KB.
- Goal ownership proven by an RLS-scoped read; an unowned goal id is a 403, not a
  silent drop.
- DB CHECK constraints enforce the same bounds last.
- All extension rendering is `textContent`; the only `innerHTML` takes static icon
  constants. API responses are shape-checked and bounded before use.
- MV3 default CSP; no remote code; fonts vendored locally.

## Files

| Area | Path |
|---|---|
| Migration | `supabase/migrations/0035_study_captures.sql` |
| Shared contract | `lib/data/capture-types.ts` |
| Server data layer | `lib/data/captures.ts` |
| Origin/CORS guard | `lib/extension/api.ts` |
| Routes | `app/api/extension/session/route.ts`, `app/api/extension/captures/route.ts` |
| Event type | `STUDY_MOMENT_CAPTURED` in `lib/events/types.ts` |
| Analytics | `extension_opened`, `capture_saved`, `capture_opened_in_mido` in `lib/analytics/track.ts` |
| Player OS surfacing | `components/film/saved-moments.tsx`, film-room + goal-detail pages, `app/app/film-room/capture-actions.ts` |
| Extension | `extension/` (src, build.mjs, harness, dist) |
| Tests | `tests/unit/captures.test.ts`, `scripts/verify-extension-api.mjs` |

## Decisions and non-decisions

- **Timeline view untouched.** `player_timeline` is a UNION view; adding a branch
  means re-creating it in a migration. The `STUDY_MOMENT_CAPTURED` event carries
  the signal for recommendations; a timeline branch can follow if usage justifies.
- **No Zod.** The house pattern is inline guards + CHECK constraints; introducing a
  validation framework for one endpoint would be a second convention.
- **No separate analytics calls from the extension.** `extension_opened` rides the
  session check; everything else is server-side at save/open time.
- **Demo mode fully supported** end to end (in-memory captures), so the whole loop
  is testable with zero keys — the same property the rest of the product has.
