# MIDO XI Capture — Release Gate

Status per item: ✅ verified · 🔶 owner action required.

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
- [ ] 🔶 Migration `0035_study_captures.sql` applied to the live database
      (SQL editor → `npm run verify:db`)
- [ ] 🔶 One real-Chrome unpacked capture on youtube.com against the live app
      (TEST_REPORT § "Not covered here")
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
