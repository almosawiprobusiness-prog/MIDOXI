# Implementation Progress — Event Intelligence Foundation

**Updated:** 24 August 2026 · **Tests:** 575 passing (was 534)

The spec's implementation order, honestly marked. Nothing here is
described as done unless it is built, typechecked, tested and building.

| # | Step | Status |
|---|---|---|
| 1 | Event schema | **Done** — migration `0031_mido_events.sql` |
| 2 | Canonical emitter | **Done** — `lib/events/emit.ts` |
| 3 | Player-loop instrumentation | **Partial** — goals and matches only |
| 4 | Recommendation model | **Not started** |
| 5 | Next Best Action scoring | **Done** — `lib/intelligence/next-best-action.ts` |
| 6 | Locker integration | **Not started** |
| 7 | Context selector | **Not started** |
| 8 | Readiness → training | **Partial** — the rule exists in the scorer; not fed by live data |
| 9 | Fixture → preparation | **Partial** — same |
| 10 | Timeline parity tooling | **Not started** |

## Why 5 was built before 4

The recommendation *model* is a persistence concern; the *scoring* is the
part that decides whether this product is intelligent or merely
generative. Building the scorer first meant the safety rule — never
recommend a hard session into low readiness — could be pinned by tests
before anything depended on it.

The scorer already emits the shape a `Recommendation` needs (`title`,
`reason`, `score`, `sources`), so the model becomes a store rather than a
design problem.

## Migration status

**`0031_mido_events.sql` has not been run.** Until it is, `emitMidoEvent`
fails on the Supabase path, logs, and returns `{ ok: false }` — and every
user action continues to work normally. That is the failure behaviour
working as designed, not a broken state.

Demo mode keeps events in memory, so the loop is exercisable with no
keys.

## Deliberately not built

Per the spec's phase-15 list and the autonomy rule: no match computer
vision, no wearable integrations, no PDF engine, no new design system.

**No production Timeline change.** `player_timeline` is untouched. Parity
tooling comes before any switch, and the switch itself is on the "stop
and document first" list.

## Docs

| File | Status |
|---|---|
| `MIDO_XI_INTERCONNECTION_AUDIT.md` | Written — includes the three findings it got wrong first |
| `EVENT_SYSTEM.md` | Written |
| `NEXT_BEST_ACTION.md` | Written |
| `RECOMMENDATION_ENGINE.md` | **Not written** — would be fiction until step 4 exists |
| `CONTEXT_ENGINE.md` | **Not written** — same |
| `TIMELINE_PARITY.md` | **Not written** — same |

Writing architecture documents for unbuilt systems is the documentation
equivalent of a placeholder success state.

## Next three

1. **Instrument the rest of the player loop** — film, study, training,
   check-in. The scorer's signals are only as good as its inputs, and
   four of its seven currently have no emitter.
2. **Recommendation store** — persist what the scorer produces so it can
   be completed, dismissed and expired, and so
   `MIDO_RECOMMENDATION_COMPLETED` closes the loop.
3. **Locker integration** — one prominent action, two quiet ones, with
   "why this?" reading from `sources`.
