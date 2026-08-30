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

## Deliberately not built

- Full-match single-call reads (research: density collapses; value is
  many chosen windows). The job model extends to it if that changes.
- Client-side fake background processing.
- A second vision provider. TwelveLabs deferred with criteria.
- Any UI implying tracking, measurement, or automated identity.
