# MIDO AI 2.0 — architecture for the intelligence layer

**Written 2026-08-30, from a full audit of the repository** (AI layer, video
infrastructure, billing/metering, reports/sharing) plus fresh provider
research (`MIDO_VISION_RESEARCH.md`). This is the plan of record for the
intelligence-layer phase: MIDO AI 2.0, MIDO VISION, Adaptive Training, and
MIDO Publish + PDF.

The phase deepens; it does not widen. Nutrition, Trainer OS expansion,
sourcing, and community are explicitly out.

---

## 0. What the audit found

The directive assumed a football app that records; the repository already
contains most of an intelligence layer, built to a discipline worth keeping:

**Standing architecture (do not rebuild):**

- **"Code decides, AI phrases."** Every AI feature is a deterministic
  composer with an optional metered Claude pass. The NBA scorer
  (`lib/intelligence/next-best-action.ts`) is pure, tested, safety-floored.
- **One provider door per vendor.** `lib/ai/anthropic.ts` (tier router,
  JSON-schema output, circuit breaker, 1h prompt caching);
  `lib/video/gemini.ts` (native video, streamed uploads, measured).
- **A context engine exists** — `lib/intelligence/context.ts`:
  `selectPlayerContext` (bounded, citable), `validSourceKeys`,
  `contextPromptBlock`. One signal pipeline shared with the scorer.
- **Citation enforcement exists** — `session-engine.ts` drops any generated
  block whose `sourceKey` is outside `validSourceKeys(context)`. In code,
  not in the prompt.
- **A truth model exists** — `verified` / `analysis` / `observation`
  provenance (Study), `observed` / `inferred` / `uncertain` confidence with
  an identity ceiling **derived in code** (native video).
- **Metering exists** — entitlement → global budget → consume-then-refund;
  `ai_usage_events` with estimated cost; platform kill-switch.
- **Vision V1 exists and is measured** — Gemini clip reads (10–90s), 99
  tokens/sec, identity via `pitch_identity`, persistence in `clip_analyses`,
  prior-observation feedback ("the fourth clip where…"), refund discipline.
- **Reports exist** — print-first documents (monthly/training/film),
  192-bit share tokens, frozen field scope, mandatory expiry.

**The real gaps (this phase's work):**

| # | Gap | Where it bites |
|---|---|---|
| G1 | No runtime schema validation — `JSON.parse(text) as T` | every engine |
| G2 | No prompt registry/versioning; `model` null in `ai_usage_events` for all Claude calls | governance |
| G3 | Context engine serves one consumer; memory injection inconsistent | MIDO AI 2.0 |
| G4 | No training adaptation, no execution mode, no post-session feedback loop | Adaptive Training |
| G5 | Study→Training and Film→Training are scored *hints* (NBA bonuses), not actions | the loop |
| G6 | No pattern surface — `priorObservations` feeds prompts but no UI aggregates repetition | Film |
| G7 | No async video pipeline; `videos.status` enum never written; no `maxDuration` on analysis paths | Vision |
| G8 | No match focus (one-cue prep from film patterns) | Match |
| G9 | No social artifacts (zero `ImageResponse` usage); film/training shares half-wired | Publish |
| G10 | Documents are app pages that print, not designed documents; no QR; no per-report privacy outside monthly | PDF |
| G11 | Gemini consumer-API minors clause (see research) | compliance |

**Two recorded decisions this phase re-opens, explicitly:**

- *"No PDF engine"* (`FEATURE_DECISIONS.md`) — **stands, reinterpreted.** The
  print pipeline produces real vector PDFs and remains the mechanism; what
  changes is that the document routes get document-grade design (masthead,
  page architecture, reflection blocks, QR) instead of looking like printed
  app pages. No PDF library unless server-generated documents (email) become
  a requirement — they are not in this phase.
- *"No drill/content library"* — **stands in spirit, refined in letter.**
  MIDO still derives sessions from the record — that is the moat. What gets
  added is a curated **block pattern library** (structured constraints,
  progressions, coaching cues per concept — an extension of
  `lib/knowledge/concepts.ts` `trains[]`), which the AI composes *with* the
  player's evidence. Assembling validated building blocks beats hallucinating
  drills for quality, safety, cost and explainability. It is not sellable
  content; it is vocabulary.

---

## 1. The loop, and where each build lands

```
MATCH ──→ FILM ──→ OBSERVATION ──→ DEVELOPMENT ──→ STUDY ──→ TRAINING ──→ PERFORMANCE
  ↑          (Vision: G6,G7)        (G5: file as     (exists)   (G4,G5:        │
  │                                  evidence — exists)          generate/adapt/│
  │                                                              execute/feed)  │
  └── MATCH FOCUS (G8) ←── PATTERNS (G6) ←── PLAYER MEMORY ←── EVIDENCE ────────┘
                                    NBA (exists) surfaces the next arrow
```

## 2. Foundation (Phase 1): schema truth, prompt registry, wider context

### 2.1 `lib/ai/schemas.ts` — Zod at the AI boundary (G1)

Zod is already a dependency (auth forms). One module holds a Zod schema per
AI product object (session proposal, adaptation, film analysis payload,
match focus, study enhancement) **derived alongside** the JSON schema sent
to the provider, and a `parseAiJson<T>(schema, text)` helper that: parses,
validates, attempts one bounded repair (strip prose, re-parse), and returns
the same `AiResult` shape on failure. Engines keep their existing clamps —
Zod is the shape gate, clamps remain the sanity gate.

### 2.2 `lib/ai/prompts.ts` — the prompt registry (G2)

Each production prompt becomes a named, versioned constant:
`{ name, version, tier, system, schemaVersion }`. Engines import from here;
`logAiUsage` gains the real model id (from the `MODELS` table) and
`feature` stays the metering key. No behavioral change — governance only.
Shared hard-rules text (anti-fabrication block) becomes one exported
fragment instead of four drifting copies.

### 2.3 Context engine widening (G3)

`PlayerContext.situation` gains: next fixture (date + opponent when known),
last training (kind + how recent), and preference memory keys (duration,
equipment, environment) parsed from player memory. `validSourceKeys` gains
`fixture`, `training:last`, `pref:duration`, `pref:equipment`,
`pref:environment`, `study:<slug>` (completed studies are already in the
context; they become citable). Memory injection becomes uniform: every
player-facing engine receives the context block; none receives raw memory
separately.

**Provenance vocabulary unification:** one exported type
`EvidenceKind = "fact" | "match" | "observation" | "film" | "study" |
"training" | "inference" | "suggestion"` in `lib/intelligence/provenance.ts`,
mapped onto the existing `PROVENANCE_META` UI treatment. New surfaces use
it; existing surfaces keep their working tags.

## 3. Adaptive Training (Phase 2) — the primary feature

### 3.1 Generation — "Build my session"

`draftSession()` already exists with citation enforcement. It gains a
`SessionBrief` argument (all optional, defaults from context/memory):
`{ minutes?: 30|45|60|75|90, location?: pitch|gym|home|wall|small,
mode?: solo|partner|group, equipment?: string[] }`. The dialog pre-fills
from memory; the player adjusts chips, not forms.

### 3.2 Adaptation — objective-preserving transforms

`adaptSession(proposal, directive)` where directive ∈ shorter | longer |
harder | easier | no_goal | no_partner | small_space | gym | pitch |
low_intensity. **Deterministic first:** time-scaling, block substitution
from the pattern library, and constraint swaps are code. The AI pass only
rewrites block detail within the preserved skeleton (same `sourceKey`s, same
primary objective — enforced by `validateBlocks` + an objective-identity
check). Safety directives (low_intensity) are one-way: AI may never raise
intensity that a deterministic rule lowered. Metered as `ai_interactions`;
deterministic-only adaptations are free.

### 3.3 Safety (deterministic, tested)

The NBA safety rule extends into generation: `composeSessionPlan` already
de-intensifies under low readiness; add match-proximity (`daysUntilNextMatch
<= 1` → no high-load blocks, "harder" refused with the reason) and recent
high load (yesterday's session kind). These are code rules with golden
tests, not prompt lines.

### 3.4 Execution mode + feedback loop

`/app/training/session/[id]/run` (or in-page mode): one block at a time,
big timer, cue, next/complete. Client-side once loaded (no network per
interaction). On completion: three-tap feedback (done/partial/skipped ×
too-easy/right/too-hard, optional line) → stored on the training log,
emitted as an event, read by signals (recent feedback nudges the next
generation), and RPE stays where it already lives (`training_logs.rpe`).

### 3.5 Evidence, honestly

A completed generated session writes training evidence toward the goals its
blocks cited (`TRAINING_LOGGED` with linkage — the ELITE_ROADMAP Phase 1
contract). Completion is evidence of *work*, never of improvement; the copy
and the data model both say so.

## 4. Study → Training (Phase 3)

After a completed study: **Apply this → Build training**, which passes
`study:<slug>` into the brief. The engine already knows completed studies
via context; the study's curated principles (concept slugs + cues) become
the block vocabulary for that session. Study memory strengthens from
`study_completed = true` to retaining the concepts and the chosen focus —
already mostly present via events + `conceptsInPlay`; what's added is the
citable key and the CTA.

## 5. MIDO VISION (Phases 4–5)

### 5.1 Truth rules (unchanged, now written down as law)

- Text-only input → MIDO never says "I saw".
- Frame analysis → "based on N selected frames".
- Clip analysis → clip-level conclusions allowed, identity-ceilinged.
- No full-match pretense. Synthesis across windows speaks as "across N
  analyzed passages", and it reasons over stored observations, not footage.

### 5.2 The pipeline (G7) — smallest robust async

A `film_analysis_jobs` table: `id, user_id, video_id, windows jsonb,
state (queued|running|partial|complete|failed), completed_windows int,
attempts, idempotency_key, error, created_at, updated_at`. Each window is
one ≤90s grounded read (the measured sweet spot). The job advances one
window per server invocation (each safely within function limits, with
`maxDuration` exported); the client polls job state and can leave — a
refresh or navigation never loses work; a failed window retries with
backoff up to N attempts, then the job lands `partial` with the honest
count. Stale Gemini handles trigger `forgetFile()` + re-upload (wiring the
existing dead function). No fake client-side background processing; the
job row is the truth the UI renders.

### 5.3 Patterns (G6) — arithmetic, not vibes

`lib/intelligence/patterns.ts` (pure): aggregate stored observations
(clip_analyses + film observations + captures) by concept: count, spread
(videos/matches touched), recency, trend vs the player's history, and
positive/improvement detection (sentiment + confidence-aware). Surfaced as
REPEATING PATTERN and IMPROVEMENT cards in the Film Room and on the goal —
counts always shown as "development evidence", never statistics. Feeds NBA
via the existing `filmObservations` signal (no scorer change needed).

### 5.4 Moment experience + loop actions (G5)

Each observation/moment card gains: STUDY THIS (existing `suggestStudyFor`),
BUILD TRAINING (film:<concept> into the brief), ADD TO GOAL (existing
confirm flow), SAVE MOMENT (existing clip). Film→Training is the one new
arrow; the rest is wiring existing actions onto the card.

### 5.5 Match focus (G8)

`match_focus`: one or two cues max, derived deterministically from the top
pattern serving the top goal, phrased by AI (metered) or composed
(fallback), attached to the next fixture, shown in match prep and the
Locker. After the match + new film: the pattern arithmetic answers "did it
change", with evidence or with honest silence.

### 5.6 Player identification

Keep the shipped approach (it matches the research): `pitch_identity`
("9, home kit") + the code-derived confidence ceiling. Add an elegant
IDENTIFY YOURSELF step in the Film Room when identity is missing (jersey /
kit / side — writing `pitch_identity`), instead of the settings-only field.
No fake automated tracking; `TRACKING_GAP` stays declared.

## 6. MIDO PUBLISH (Phase 6)

`lib/publish/` + `ImageResponse` routes (no new dependency):

- **Template system**: one shared visual frame (MIDO type, black/graphite/
  off-white, restrained accent, small MIDO XI signature) + per-template
  data adapters reading the same libs reports read. Small elite set:
  MATCH PERFORMANCE, TRAINING COMPLETE, DEVELOPMENT PROGRESS (30-day),
  SEASON SNAPSHOT, PLAYER PROFILE, MILESTONE.
- **Formats**: 1080×1080, 1080×1920, 1200×630 presets.
- **Privacy before pixels**: the preview *is* the artifact; field opt-in
  reuses `lib/reports/fields.ts` defaults-minimal model; nothing private
  (notes, health, email, location) can enter a template's data adapter by
  construction — adapters whitelist fields, they never spread objects.
- **Sharing**: DOWNLOAD IMAGE + native Web Share API where present. No
  posting OAuth integrations.
- Auth: image routes render only for the signed-in owner; nothing public.

## 7. MIDO PDF (Phase 7)

Browser-print stays the engine (real vector PDFs, zero dependencies —
mechanism unchanged, per the re-opened decision above). The work is design
and coverage:

- Document-grade layout for: TRAINING SESSION (with WHY THIS SESSION,
  per-block purpose/setup/cues, SESSION TARGETS, REFLECTION with RPE and
  write-in lines), DEVELOPMENT REPORT (exists — elevate), MATCH REVIEW
  (exists as film report — elevate), STUDY NOTES (new), WEEKLY PLAN (new,
  from generated sessions).
- Print CSS gains running headers/footers, page-number counters, and a
  cover band; `.print-break` architecture per section.
- **QR**: a dependency-free pure-TS QR encoder in `lib/util/qr.ts` (SVG
  output) — evaluated against adding `qrcode` (accepted only if the pure
  implementation proves unreasonable). QR points at an existing authorized
  route or an existing share token — never a new public route.
- Share coverage: finish the half-wired `training` share kind; remove or
  implement `film` shares (decide by effort — the `/r/[token]` renderer
  branch bug where a film token would parse a videoId as a period gets
  fixed either way).

## 8. Metering & cost (Phase 8)

Existing units stay the product's language: `ai_interactions` (generation,
adaptation, study reasoning, match focus), `deep_analyses` (film windows —
one unit per analyzed window keeps the unit honest as windows multiply),
`study_discoveries`. No user-facing tokens. Additions:

- `model` recorded on every Claude call (G2).
- A per-operation `op` label in `ai_usage_events.feature` stays coarse; the
  cost model doc carries the fine breakdown.
- Runaway guards: job `attempts` cap; idempotency keys on analysis jobs;
  the existing consume-before-work + global ceiling stand.
- `/docs/product/AI_COST_MODEL.md` with current provider prices, per-op
  estimates, normal/heavy/vision-heavy player scenarios, margin at current
  tiers.

## 9. NBA & Locker (Phase 9)

The scorer is untouched. `training` recommendations gain a `target`
(BUILD SESSION → the dialog, pre-filled). Match focus, when present,
becomes the `match_prep` target. Pattern cards join RECENT INTELLIGENCE.
Locker hierarchy: NBA → today's session → next match → active development —
already the shape; verify against the cut-list rather than adding cards.

## 10. Sequencing

| Phase | Delivers | Gate |
|---|---|---|
| 1 | schemas.ts, prompts.ts, context widening, provenance vocab | tests+typecheck+lint+build |
| 2 | brief + adaptation + safety + execution + feedback | golden tests A–D |
| 3 | Study→Training CTA + citable studies | study connection test |
| 4 | analysis jobs + multi-window + identity step | pipeline survives refresh/failure; truth test |
| 5 | patterns + moment actions + match focus | Film→goal/training in browser |
| 6 | Publish templates + privacy + share | privacy leak test |
| 7 | document elevation + QR + share completion | PDF matrix test |
| 8 | model attribution + cost model doc | reconciliation math |
| 9 | Locker/NBA wiring | browser QA |
| 10 | mobile/perf/a11y/security polish + FINAL_AUDIT | release gate list |

Every phase ends green (tests, typecheck, lint, build) and committed.

## 11. Risks

1. **Gemini minors ToS** (research §1) — owner decision; Vision work
   proceeds on architecture, marketing waits.
2. **Serverless duration** — mitigated by per-window job advancement +
   `maxDuration`; the job table is the recovery mechanism.
3. **Adaptation quality drift** — held by objective-identity checks and
   golden tests, not prompts.
4. **Scope gravity** — everything not in the loop diagram is out; the
   directive's own exclusions (nutrition, trainer, sourcing, community)
   are honored.
5. **Print-engine ceiling** — if a future phase needs emailed/server PDFs,
   that is the point the REPORT_ENGINE doc already marks for headless
   rendering; not now.
