# MIDO XI Capture — Launch Plan

Two halves: the ship sequence (mechanical, an afternoon) and the first-user
plan (deliberate, four weeks). The product is frozen; everything below is
distribution. The goal is not growth — it is a clean read on one question:
**do football people who install this actually capture moments, and do the
serious ones connect MIDO XI?**

---

## PART 1 — SHIP SEQUENCE

Everything is prepared; the steps are in strict order because each depends on
the one before.

### 1. Deploy the backend (blocks everything)

**What ships:** `main` is strictly behind `feature/mido-xi-capture` (no
divergence — the merge is a fast-forward), so this push carries the 4
Founding XI beta commits plus all extension work. The database is already
ahead of the code (migrations 0031–0035 applied and verified live), so code
and schema land consistent. **No new env vars are needed for this deploy.**

**a. Pre-flight** (from the repo root, on `feature/mido-xi-capture`):
```bash
npm test && npm run build
```
Both must be green (they were at gate close).

**b. Merge and push:**
```bash
git checkout main
```
```bash
git pull origin main
```
```bash
git merge feature/mido-xi-capture
```
```bash
git push origin main
```
(`git pull` should say up to date; the merge should say fast-forward. If
either says anything about conflicts, stop — something changed on the remote.)

**c. Watch the deploy:** Vercel builds automatically on the push —
[vercel.com dashboard](https://vercel.com) → mido-xi → Deployments, wait for
**Ready** (~2 min). A failed build leaves the previous deployment serving, so
production is never down while you look at it.

**d. Verify production** (all three, in order):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mido-xi.vercel.app/api/extension/session
```
→ must print **401** (404 = not deployed; 500 = check Vercel logs).
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://mido-xi.vercel.app/privacy/extension
```
→ must print **200**.
```bash
node scripts/verify-extension-api.mjs https://mido-xi.vercel.app
```
→ runs the session/origin/validation contract against production (the
persistence tests self-skip without a login — expected; everything that runs
must pass).

**e. Rollback, if ever needed:** Vercel dashboard → Deployments → previous
deployment → **Instant Rollback** (seconds, no git surgery). The migrations
are additive and were already live before this deploy, so the database never
needs rolling back.

**f. Real smoke:** extension gear → Environment → **MIDO XI** (production),
sign in at mido-xi.vercel.app, one capture end to end.

### 2. Final smoke (2 minutes)
v0.2 unpacked in real Chrome, extension env set to **production**: one free
save on YouTube, open My moments, one Copy click, then sign in at
mido-xi.vercel.app and confirm goals load.

### 3. Developer account
[chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) —
$5 one-time registration. Use a MIDO Group Google account, not a personal one:
the publisher name shows on the listing.

### 4. Upload
```bash
cd extension && npm run package:store
```
Upload `mido-xi-capture-store-0.2.0.zip` (key stripped, localhost hosts
stripped — verified by the build).

### 5. Listing
Paste from `CHROME_STORE.md` (title, short + long description, category).
Assets are ready in `extension/store-assets/`:
- Screenshots (1280×800, in this order): `shot-1-hero.png`, `shot-2-library.png`,
  `shot-3-saved.png`, `shot-4-connected.png`
- Small promo tile: `promo-tile-440x280.png` · Marquee: `promo-marquee-1400x560.png`
- Privacy policy URL: `https://mido-xi.vercel.app/privacy/extension`

### 6. Privacy form (answers match PRIVACY.md — do not improvise)
- Single purpose: capture a timestamped observation from the YouTube video the
  user is watching, saved locally or to the user's MIDO XI account
- Collects "website content": **yes, narrowly** — the invoked video's
  title/channel/playback time, only on user action
- Authentication information: no (session cookie is used, never read or stored)
- Sells data / uses for unrelated purposes / creditworthiness: **no ×3**
- Permission justifications: copy the table from `CHROME_STORE.md`

### 7. Submit → review is typically 1–3 days for a first submission.

### 8. After approval
- Note the **final store extension id** (differs from the dev id)
- Set `MIDO_EXTENSION_IDS=<store-id>` in Vercel env → redeploy
- Install from the store, one full smoke (free save + connect + save to MIDO)

---

## PART 2 — FIRST USERS

Target: **50 installs → 10 real capturers → watch the connect/import funnel.**
Small on purpose: at this stage ten people genuinely using it beat a thousand
installs, and every early user is someone we can talk to.

### Phase 0 (launch week) — the warm network, one by one
The highest-signal cohort, recruited by DM, not broadcast:
- Founding XI beta players and everyone around them (teammates, their coaches)
- The MIDO Group's football contacts — local MN academy and club coaches
- 10–15 people, each asked personally

DM script (adjust per person):
> Built something you might actually use — a free Chrome extension that saves
> timestamped notes while you watch football on YouTube. You spot something,
> hit Alt+Shift+M, write one line, back to the video. No account needed.
> [store link] — would love to know if it sticks for you after a week.

Ask each one, a week later, a single question: *"still using it?"* — and if
not, *why not*. That answer is worth more than any dashboard.

### Phase 1 (weeks 1–2) — where football students already are
- **Reddit** — r/footballtactics, r/bootroom, r/SoccerCoachResources,
  r/footballstrategy. Read each sub's self-promotion rules first; post
  value-first and flagged as the maker:
  > I take notes while watching match film on YouTube and kept losing the
  > timestamps, so I built a free extension that saves the exact second +
  > what I noticed, searchable later. No account, notes stay on your device,
  > export to Markdown. Would genuinely value feedback from people who study
  > film properly. [link]
- **Discord** — football analysis and coaching servers; same tone, in the
  channels where tool-sharing is welcome.
- **X/Twitter tactics community** — one thread: a 30s screen capture of the
  loop (watch → Alt+Shift+M → note → library), the store link, nothing else.
- **Analysis creators (the sleeper channel)** — 5–10 mid-size YouTube
  tactics/analysis creators (10k–100k subs). They scrub film for a living,
  which makes them power users AND a distribution channel. Short email/DM:
  the tool is free, no affiliation needed, "thought your viewers who take
  notes might want this."

### Phase 2 (weeks 3–4) — show the output, not the tool
- Publish 1–2 real **exported study libraries** as posts ("12 moments from
  studying Rodri's scanning — made with MIDO XI Capture", the actual .md
  export) — the export IS the ad, and it demonstrates data ownership
- Re-cut the demo clip for TikTok/IG reels if Phase 1 shows pull
- Product Hunt: optional, later — football-specific channels convert better
  than generic tech traffic for this

### What we measure weekly (already instrumented — see METRICS.md)
| Signal | Source |
|---|---|
| Installs | Store dashboard |
| Connected users | distinct users with `extension_opened` |
| Free→connected conversions + library size at connect | `capture_saved` with `via: "import"` |
| Live connected captures | `capture_saved` with `via: "popup"` |
| Repeat capture inside 7 days | same, per user |
| Revisits | `capture_opened_in_mido` |

Free-mode usage is deliberately untracked (see METRICS.md) — the weekly
"still using it?" DMs to Phase 0 users are the free-mode instrument.

### Decision rules (so the data gets acted on, not admired)
- Installs but no connects after 3–4 weeks → the free product may be enough
  on its own; interview free users before concluding anything
- Phase 0 users stop capturing within a week → there is a friction problem;
  watch one of them use it before changing one line of code
- Captures happen but never connect to goals → the MIDO value story needs
  work in the app, not the extension
- **In every case: the answer is learning, not features. The freeze holds.**

---

## OWNER-ONLY ACTIONS (nothing here can be done by tooling)
1. The merge/deploy decision (step 1)
2. Store account registration + submission (steps 3–7)
3. Recording the 30–60s demo screen capture (any screen recorder; the flow to
   record is the Phase 1 clip: watch → shortcut → type → save → library)
4. Sending the Phase 0 DMs — these must come from a human, and from you
