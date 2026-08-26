# Implementation Progress — Event Intelligence Foundation

**Updated:** 25 August 2026 · **Tests:** 658 passing (was 575)

The spec's implementation order, honestly marked. Nothing here is
described as done unless it is built, typechecked, tested and building.

| # | Step | Status |
|---|---|---|
| 1 | Event schema | **Done** — migration `0031_mido_events.sql` |
| 2 | Canonical emitter | **Done** — `lib/events/emit.ts` |
| 3 | Player-loop instrumentation | **Done, bar one** — see below |
| 4 | Recommendation model | **Done** — `lib/data/recommendations.ts`, migration `0032` |
| 5 | Next Best Action scoring | **Done** — `lib/intelligence/next-best-action.ts` |
| 6 | Locker integration | **Done** — panel, complete/dismiss, "why this?", briefing coexistence |
| 7 | Context selector | **Not started** |
| 8 | Readiness → training | **Done** — rule in the scorer, fed by live check-in data |
| 9 | Fixture → preparation | **Done in production, dead in demo** — see below |
| 10 | Timeline parity tooling | **Not started** |

Plus, not on the spec's list: a **development-only intelligence
inspector** at `/app/dev/intelligence`, which shows the whole chain —
signals, every candidate including the rejected ones, briefing overlap,
stored rows, and the event tail.

## Why 5 was built before 4

The recommendation *model* is a persistence concern; the *scoring* is the
part that decides whether this product is intelligent or merely
generative. Building the scorer first meant the safety rule — never
recommend a hard session into low readiness — could be pinned by tests
before anything depended on it.

## Step 3 — what is instrumented

| Event | Emitted from |
|---|---|
| `GOAL_CREATED` / `GOAL_UPDATED` | `app/app/development/actions.ts` |
| `MATCH_CREATED` / `MATCH_REVIEWED` | `app/app/matches/actions.ts` |
| `STUDY_COMPLETED` | `app/app/film-room/study/actions.ts` |
| `TRAINING_LOGGED` | `app/app/training/actions.ts` |
| `FILM_OBSERVATION_CREATED` | `app/app/film-room/analysis-actions.ts` |
| `PLAYER_CHECKIN_COMPLETED` | `app/app/actions.ts` — keyed by day, so a corrected check-in is not a second one |
| `VIDEO_UPLOADED` | `app/app/film-room/actions.ts` — both entry points, pasted link and uploaded file |
| `RECOMMENDATION_*` | `lib/data/recommendations.ts` |

**`RECOVERY_LOGGED` is not emitted, on purpose.** There is no manual
recovery-logging action in the product, and the only path that writes
recovery data is the WHOOP sync — which cannot be exercised here. Adding
an untestable emitter to a blocked integration would look like progress
and produce a log that might be lying. `PLAYER_CHECKIN_COMPLETED` already
carries the readiness figure the scorer actually reads.

## Step 9 — true in production, dead in demo

The fixture branch works on a real account: `matches` holds future rows,
and both the Locker and the signal builder read them.

In **demo** it cannot fire. `lib/seed.ts` states its fixture twice — a
fixed `date` and a hardcoded `daysRemaining: 3` — so the Locker's copy is
frozen at "three days out" while signals are computed against today.
`daysUntilNextMatch` reads as *not known*, so `match_prep` never appears
and recovery's fixture urgency is inert.

Not fixed here: seed data design was not in scope, and rolling the date
forward would go stale again next week. The durable fix is to derive the
fixture from a demo anchor rather than stating both values. The inspector
says so inline, so nobody loses an hour to it.

## Migration status

**Neither `0031_mido_events.sql` nor `0032_mido_recommendations.sql` has
been run.** Until they are, both Supabase paths fail, log, and return
empty — and every user action continues to work normally while the Locker
shows its honest empty state. That is the failure behaviour working as
designed, not a broken state.

Demo mode keeps both in memory, so the loop is exercisable with no keys.

## Deliberately not built

Per the spec's phase-15 list and the autonomy rule: no match computer
vision, no wearable integrations, no PDF engine, no new design system.

**No production Timeline change.** `player_timeline` is untouched. Parity
tooling comes before any switch, and the switch itself is on the "stop
and document first" list.

**No Coach/Trainer/Club expansion.** Player OS first, per the spec.

## Docs

| File | Status |
|---|---|
| `MIDO_XI_INTERCONNECTION_AUDIT.md` | Written — includes the three findings it got wrong first |
| `EVENT_SYSTEM.md` | Written |
| `NEXT_BEST_ACTION.md` | Written |
| `RECOMMENDATION_ENGINE.md` | **Written** — the system now exists |
| `CONTEXT_ENGINE.md` | **Not written** — step 7 is not started |
| `TIMELINE_PARITY.md` | **Not written** — step 10 is not started |

The last two are unchanged from the previous pass, and for the unchanged
reason: writing architecture documents for unbuilt systems is the
documentation equivalent of a placeholder success state. A context-engine
document today would describe a design nobody has tested against a real
context window, and a parity document would describe a comparison that
has never been run.

## Next three

1. **Context selector (step 7)** — the one remaining piece of the
   player-side spec. What MIDO should be told about a player when a model
   *is* called, assembled from the same signals rather than a second
   pipeline.
2. **Timeline parity tooling (step 10)** — a read-only comparison of
   `player_timeline` against what the event log would produce, run before
   anybody proposes switching. The switch itself stops for a decision.
3. **Fix the demo fixture clock** — small, and it un-deadens two of eight
   action kinds in the only environment where the loop can be
   demonstrated without keys.
