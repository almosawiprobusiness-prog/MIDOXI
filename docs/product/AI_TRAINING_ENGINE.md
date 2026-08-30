# The adaptive training engine — as built

Status 2026-08-30. The STUDY → AI TRAINING arrow, plus adaptation,
execution and the feedback loop. Everything below ships and is tested.

## The contract

1. **Derived from the record.** `draftSession(brief?)` builds from the
   bounded, citable `PlayerContext` — every block's `sourceKey` must
   exist in `validSourceKeys(context)` or the block is dropped in code
   (`validateBlocks`). The citation universe now includes completed
   studies (`study:<slug>`), which is what makes "apply what you
   studied" a citable fact rather than a vibe.
2. **The brief is chips, not a form.** `SessionBrief` (minutes /
   location / mode / equipment / focusKey) — closed sets, sanitized,
   remembered per-device in localStorage. Absence means MIDO decides.
   `focusKey` is how Study→Training, Film→Training and the NBA card
   arrive; the engine drops a focus the live record cannot back.
3. **Player confirms.** Nothing writes until Accept — the voice-log
   contract.
4. **Zod at the boundary.** `sessionPayloadSchema` gates the shape;
   engine clamps stay as the sanity gate; a malformed payload refunds
   like a model failure.

## Adaptation (`adaptSession(original, directive)`)

Ten directives with their football meaning written into the
instruction (`ADAPT_DIRECTIVES`) — "harder" is denser constraints and
faster decisions, never more volume. Enforcement is code:

- `adaptGuard` — deterministic safety, BEFORE any model: harder/longer
  refused outright the day before a match or under readiness < 40,
  with the reason in the player's terms. One-way: directives may lower
  intensity, never override what the record forbids.
- `deterministicAdapt` — the one adaptation arithmetic can do honestly
  (shorter, needing ≥2 middle blocks; browser QA caught the 3-block
  case gutting a session, so that goes to the model).
- `validateAdaptation` — what a rewrite must satisfy: objective
  preserved BY CONSTRUCTION (the model's echo is not trusted),
  citations a strict subset of the original's, duration moved only the
  way the directive says (±25% band on place/constraint directives).
- Failed contract = original survives with a note, not refunded (the
  model ran); model failure = refunded.

## Execution mode (`SessionRunner`)

The plan as a pitch-side card: one block at a time, count-up clock
(a prescription is not a countdown — a drill that works may run
long), thumb-height controls, zero network once loaded. Finishing
hands to the EXISTING log dialog — RPE, physical/technical feel,
improved/felt-off already live in `training_logs`, and a second
feedback form would be a second place the same fact goes.

## Evidence, honestly

Completing a generated session logs training like any other; goal
linkage travels through the existing `TRAINING_LOGGED` /
`development_evidence` paths. Completion is evidence of WORK — the
copy never claims the skill improved because a session was done.
Improvement claims belong to pattern arithmetic over new film.

## Quality without a content library

`FEATURE_DECISIONS.md`'s "no drill library" stands: sessions derive
from the record. Quality comes from (a) the curated concept graph's
`cues`/`trains`/`looksLike` vocabulary already injected into
generation, (b) citation enforcement cutting unattached blocks, and
(c) the golden tests below. If generation quality plateaus, the next
lever is enriching `lib/knowledge/concepts.ts` — vocabulary, not
sellable content.

## Golden tests (tests/unit/session-adapt.test.ts, ai-foundation.test.ts)

- **A — striker with evidence**: session targets the film pattern and
  the goal, honours the 45-minute brief; never generic conditioning.
- **B — safety**: "harder" the day before a match and "longer" on
  readiness 31 are refused with the number; load-lowering directives
  are never blocked.
- **C — no evidence**: a new player still gets a usable session that
  cites no film and mentions none.
- **D — study connection**: the study key is inside the enforcement
  universe; a minted citation ("study:invented-guru") is named and
  rejected.
