# MIDO VISION — architecture as built

Status 2026-08-30: the pipeline below is implemented and tested.
Companion docs: `MIDO_VISION_RESEARCH.md` (provider decision),
`docs/player-os-expansion/VIDEO_INTELLIGENCE.md` (the measured
groundwork this stands on).

## The truth model (law, not guidance)

| Input MIDO had | What it may say |
|---|---|
| Text only | Never "I saw". |
| Frames (Claude, 12 stills) | "Based on selected frames"; between-frame moments explicitly unseen. |
| Clip (Gemini native, 10–90s) | Clip-level conclusions, identity-ceilinged. |
| Multiple windows (job) | "Across N analyzed passages" — synthesis reasons over stored observation ROWS, never claims to have watched the whole video. |
| Full match | Not claimed. Not available. `TRACKING_GAP` stays declared. |

Confidence: `observed / inferred / uncertain`, with the identity
ceiling DERIVED IN CODE (`identityCeiling` + `atMost`) — claims about
the viewer can never reach `observed`, because the model measurably
cannot tell number 9 in red from number 9 in yellow.

## Player identification

`player_profiles.pitch_identity` ("9, home kit") passed in the prompt —
the research's most reliable mitigation. No automated tracking is
claimed anywhere. The elegant identify-yourself moment in the Film
Room remains the settings field surfaced through `hasIdentity` in
`filmRoomCapabilities`.

## The pipeline

```
player picks passages (2–4) ──► startSpreadJob
        spreadWindows(duration) → ≤6 windows of ~60s      (pure, tested)
        createAnalysisJob → film_analysis_jobs row         (idempotent)
                    │
     client drives  ▼   one window per invocation
        advanceJob ──► analyseVideo (existing, metered, refunded)
                        ├─ resolveSource: YouTube URL pass-through /
                        │  upload → Gemini Files (handle cached;
                        │  stale handle → forgetFile → one re-upload)
                        ├─ generateFromVideo (json schema, temp 0.3)
                        └─ saveAnalysis + events (existing)
        recordWindowOutcome → windows jsonb + derived state (pure)
                    │
        queued → running → complete | partial | failed
```

Resilience properties, each pinned by a unit test:
- **Survives refresh/navigation/timeout**: the row is the only state;
  the page's `activeJobForVideo` resumes at the first pending window.
- **No infinite spinner**: progress = windows done / planned.
- **Failure isolation**: a window failing twice fails ALONE →
  `partial` with the honest count.
- **No smuggling**: `windowsIssue` applies single-read clip bounds.
- **No double-pay**: idempotency key on (user, plan); metering rides
  the existing per-read gate/consume/refund untouched.
- **Function budget**: `maxDuration = 120` exported on the film-room
  route; one window ≈ upload + poll + 31–43s generate.

## Where the output goes

`clip_analyses` rows (existing), which feed:
- `priorObservations` → the next read's context ("fourth clip where…")
- `detectPatterns` (pure arithmetic) → "MIDO has noticed" cards,
  match focus, and — through events — the NBA scorer's film signal
- the loop actions: observation → confirm → `development_evidence`
- the moment card's four arrows: clip / file / train / study

## The backend switch (Vertex migration, 2026-08-30)

The Gemini client speaks two platforms through one dialect
(`geminiBackend()` in `lib/video/gemini.ts`):

| | studio (AI Studio) | vertex (Vertex AI / Agent Platform) |
|---|---|---|
| Terms | consumer — **bars under-18-directed services** | enterprise |
| Endpoint | generativelanguage.googleapis.com | aiplatform.googleapis.com, project-bound |
| Auth | `x-goog-api-key` | `x-goog-api-key` (Cloud API key) |
| YouTube links | fileData passthrough | fileData passthrough |
| Uploads | Files API (48h scratch, streamed) | **no Files API** — inline bytes ≤ `INLINE_MAX_BYTES` (12MB), honest refusal above with the YouTube alternative |
| Handle cache | yes (+stale recovery) | not needed (no handles) |

Vertex wins when `VERTEX_API_KEY` + `VERTEX_PROJECT_ID` (+ optional
`VERTEX_LOCATION`, default `global`) are set; otherwise studio via
`GEMINI_API_KEY`. **A deployment migrates by adding env vars and rolls
back by removing them** — no code path changes. Voice logging rides
the same switch. `scripts/verify-vertex.mjs` proves auth, endpoint,
model existence, YouTube+videoMetadata, and the inline lane against
the real project before any player traffic does.

**EXECUTED 2026-08-30 — production runs Vertex.** Setup on project
`gen-lang-client-0202552309` (the same billed project behind the old
AI Studio key): Agent Platform API enabled; an account-bound API key
("MIDO XI Vertex Key", restricted to the Agent Platform API, bound to
the existing `ais-gemini-key-…` service account, which was granted
**Agent Platform User** — the rebranded `roles/aiplatform.user`; the
grant took ~1 min to propagate past 403). `verify-vertex.mjs` 3/3
against the live endpoint; env vars set in Vercel production and
redeployed. `GEMINI_API_KEY` stays configured as the documented
rollback: delete the VERTEX vars and the client speaks studio again.

**Model pin, and why:** `GEMINI_VIDEO_MODEL=gemini-2.5-flash`.
Measured live: YouTube `fileData` on Vertex returns **500 INTERNAL on
`gemini-3.6-flash`** (text and inline work) while `gemini-2.5-flash`
reads YouTube perfectly, with and without `videoMetadata` clipping.
2.5-flash is also the model every cost/density benchmark in these docs
was measured on, and is currently cheaper than 3.6's promo pricing.
Re-test 3.6+YouTube on Vertex before unpinning.

GCS-backed large uploads on vertex are deliberately unbuilt until the
inline ceiling is genuinely hit in practice; the current product wall
is the 50MB storage cap anyway, and match-length footage arrives as
YouTube links. Note from the current docs: YouTube ingestion is
documented as PUBLIC videos only (unlisted no longer listed as
supported) — the in-product advice about unlisted links needs a live
retest, tracked as an open item.

## Deliberately not built

- Full-match single-call reads (research: density collapses; value is
  many chosen windows). The job model extends to it if that changes.
- Client-side fake background processing.
- A second vision provider. TwelveLabs deferred with criteria.
- Any UI implying tracking, measurement, or automated identity.
