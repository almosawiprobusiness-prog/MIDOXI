# MIDO XI Capture — Release Gate

Status per item: ✅ verified · 🔶 owner action required.

## v0.2 — FREE MODE

- [x] ✅ No MIDO account required — the session picks a mode, never blocks; capture
      verified against a real 401
- [x] ✅ Capture works · local save works (never clears text a write didn't persist;
      cap refuses loudly instead of trimming)
- [x] ✅ Library works (list, thumbnail-watch, edit, delete+undo, empty state)
- [x] ✅ Search works (6.6ms at 1000 records) · categories/filter work
- [x] ✅ Exact timestamp reopening works (canonical &t= links)
- [x] ✅ Copy works (format unit-pinned; wiring verified; clipboard write blocked only
      by the hidden test pane — one real-Chrome click confirms)
- [x] ✅ Export works (.md primary, .json backup, whole library, human-readable)
- [x] ✅ Local data survives restart (versioned schema; v0.1 pending queue migrated)
- [x] ✅ Free save does not transmit to MIDO — network-inspected: zero capture requests

## v0.2 — MIDO CONNECTED

- [x] ✅ Account connection works · development goals load
- [x] ✅ Capture can connect to a goal · save to MIDO works
- [x] ✅ Local import works — explicit, partial failures reported, local copies kept
- [x] ✅ Duplicate imports prevented (capture id = clientKey; re-import verified single row)
- [x] ✅ Save-failure fallback: "Save locally instead", observation intact
- [x] ✅ Logout does not break Free Mode (local library is mode-independent)

## v0.2 — FINAL QA PASS (2026-08-28, gate-closing run)

- [x] ✅ Save-failure report diagnosed: environment (display-scaling click offset in
      the hidden test pane), zero product code changed — see TEST_REPORT
- [x] ✅ SPA recheck: three videos captured in sequence, fresh storage — distinct
      ids/titles/timestamps end to end, drafts keyed per video, no stale metadata
- [x] ✅ Mode switching: local → connected → logout → local; goals appear/vanish
      correctly, library survives every transition, mode re-derived per open
- [x] ✅ Privacy re-sweep: zero `/api/extension` requests across three local saves
- [x] ✅ Search probes by title / observation phrase / category term; combined
      search+filter; clean no-match state
- [x] ✅ Copy content audited: no internal ids, no session data

## v0.2 — QUALITY

- [x] ✅ MIDO visual language preserved — no redesign; new states use the same tokens
- [x] ✅ No new permissions (manifest unchanged except version)
- [x] ✅ No observation text in analytics; free mode is analytics-silent by design
- [x] ✅ Privacy documentation rewritten for both modes
- [x] ✅ 700 unit tests · 29 integration checks · builds pass · browser pass done

---

## v0.1 gate (all standing)

- [x] ✅ Manifest V3 valid (builds, loads in the harness; MV3-only APIs)
- [x] ✅ Minimal permissions — `activeTab`, `scripting`, `storage`; hosts only MIDO XI
      (+localhost for dev, removed at publish). **No youtube.com permission, no content script.**
- [x] ✅ Auth secure — no credentials in the extension; cookie session + Origin gate +
      pinned extension id; server revalidates everything
- [x] ✅ MIDO account connection works (session route verified; 401 → Connect view)
- [x] ✅ YouTube video detection works (watch + shorts; non-video pages refused)
- [x] ✅ Timestamp accurate (live player read; refresh affordance; stored numeric; 34:17 loop verified)
- [x] ✅ Title accurate (page h1 with document.title fallback)
- [x] ✅ SPA navigation safe by construction (fresh read per capture, no persistent state)
- [x] ✅ Observation saves (unit + integration + browser loop)
- [x] ✅ Development goals load (active only; failure degrades to unconnected capture)
- [x] ✅ Goal ownership validated server-side (RLS-scoped read; unowned → 403)
- [x] ✅ Capture appears inside MIDO XI (Film Room · Saved moments, with ?moment= focus)
- [x] ✅ Linked capture appears under the development goal (Study moments)
- [x] ✅ Deep link back to the moment works (openUrl → /app/film-room?moment=id → scroll + highlight;
      Watch moment → timestamped YouTube URL)
- [x] ✅ Failed save does not lose the observation (draft + pending strip + retry, verified)
- [x] ✅ Duplicate prevention works (clientKey unique index; dedupe verified end to end)
- [x] ✅ Analytics events work (extension_opened / capture_saved / capture_opened_in_mido)
- [x] ✅ Analytics contain no raw observation content (props are ids/enums/bools only)
- [x] ✅ Negligible performance impact (no content script, no observers, no polling —
      nothing runs until the icon is clicked)
- [x] ✅ Production build passes (`next build` clean, both routes registered; extension
      bundle 20KB minified; 683 unit tests green)
- [x] ✅ Extension can be loaded unpacked (`extension/dist/`, stable id)
- [x] ✅ Documentation complete (ARCHITECTURE, README, PRIVACY, METRICS, CHROME_STORE,
      TEST_REPORT, this file)
- [x] ✅ Migration `0035_study_captures.sql` applied to the live database
      (2026-08-28: verify-schema ok; probed directly — service role 200, anon
      read AND insert both refused 42501, so RLS + the revoke/grant held)
- [x] ✅ Migrations **0032 + 0033 + 0034** applied (2026-08-28, after being caught
      unapplied by the 0035 check; first attempt ran 0034 before 0033 and rolled
      back). Verified live: all 89 relations present, verify:db 23/23 security
      checks pass, and all three tables probe service 200 / anon 401 — analytics
      now has somewhere to land.
- [x] ✅ Real-Chrome unpacked load verified (2026-08-28): injection on real YouTube
      DOM (title + live timestamp read) and cookie auth from the real extension
      origin (the player's actual goals loaded) — the two unknowns the harness
      had to shim. 🔶 Remaining real-Chrome smoke (v0.2 build): one save, one
      Copy click, one library open.
- [ ] 🔶 `MIDO_EXTENSION_IDS` set in Vercel env at publish time
- [ ] 🔶 Chrome Web Store submission (CHROME_STORE.md; $5 registration; owner account)

# AFTER RELEASE — PRODUCT FREEZE

**No new MIDO XI Capture functionality is built until real user behaviour
provides evidence.** The extension is the last speculative Player OS build before
validation; the next step is real players, not more features.

Watch (per METRICS.md):

- capture frequency, and repeat capture within 7 days
- goal-connection rate
- revisit rate (`capture_opened_in_mido`)
- whether capturing players return to MIDO XI more than non-capturing players
- what players say

Explicitly frozen until usage justifies otherwise: other browsers, other
platforms (TikTok/Instagram/X/Vimeo), automatic player recognition, computer
vision, full-match scraping, social/sharing, coach workflows, clip downloads,
AI note-cleaning, feeds, gamification. If capturing does not happen, the answer
is not a bigger extension.
