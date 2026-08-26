# The Recommendation Engine

**Status:** built, wired into the Player Locker, verified in a browser.
658 tests passing.

The scorer decides *what to say*. This is everything around it — where
the inputs come from, what happens to advice once a person has seen it,
and how the two surfaces at the top of the Locker avoid saying the same
thing twice.

---

## The chain

```
domain tables ─┐
               ├─→ buildPlayerSignals ─→ toPlayerSignals ─→ PlayerSignals
event log     ─┘        (server)            (pure)
                                                │
                                                ▼
                                          explainActions
                                                │
                                  rankActions = the survivors
                                                │
                                                ▼
                                     surfaceRecommendations
                                        (reconcile + store)
                                                │
                                                ▼
                                   NextBestAction  ·  Briefing
                                    top 3            minus what
                                                     the panel covered
```

One entry point: `getNextActions()` in `lib/intelligence/next-actions.ts`.
A surface calls that and nothing else.

| File | Job |
|---|---|
| `lib/intelligence/signals.ts` | Rows → `PlayerSignals`. **Pure.** |
| `lib/intelligence/build-signals.ts` | The six reads. Server-only. |
| `lib/intelligence/next-best-action.ts` | Scoring. **Pure.** |
| `lib/intelligence/recommendation-types.ts` | Storage shape, source parsing, English. **Pure.** |
| `lib/data/recommendations.ts` | The store. Server-only. |
| `lib/intelligence/next-actions.ts` | The one call a surface makes. |
| `lib/intelligence/overlap.ts` | Where this collides with the briefing. |
| `components/locker/next-best-action.tsx` | The panel. |

The pure/server split is not tidiness. `toPlayerSignals` was originally
in the same file as its reads, and `import "server-only"` meant vitest
collected **zero** tests from it — the date arithmetic, which is where
this kind of code actually goes wrong, was untestable while appearing
tested.

---

## Hybrid sourcing, and why

Signals come from **two** places, deliberately:

- **Domain tables** are authoritative for *what exists* — goals, matches,
  check-ins, training. These are the truth, and they are queryable
  directly.
- **The event log** is authoritative for *what happened* — a study
  completed, an observation created. These have no domain table that
  records the act, only its result.

Reading everything from events would mean trusting the log to be
complete, which it is not yet. Reading everything from tables would lose
the two signals that make a recommendation feel earned rather than
generic: *you completed the study on this*, and *your own film showed
this*.

**Consequence to know:** a signal sourced from events is only as good as
its emitter. If `daysSinceStudy` looks wrong, suspect a missing emitter
before suspecting the scorer. The inspector's event tail exists for
exactly that.

---

## What gets stored, and what does not

The scorer returns six to eight candidates **on every dashboard load**.
Storing all of them would write tens of thousands of rows a week per
player, almost none of which anybody saw.

So only what is **surfaced** is stored, and the anti-graveyard rule lives
in the schema rather than in a promise to be careful:

```sql
-- 0032_mido_recommendations.sql
create unique index ... on mido_recommendations (user_id, kind)
  where status = 'active';
```

At most one active row per kind per person. A re-rank **updates** that
row; it does not add to it. What the table then answers is small and
honest: *what has MIDO told this player, and what did they do about it.*

`title` and `reason` are stored **as shown** and never regenerated on
read. If a player says "MIDO told me to recover", this is what it said —
re-deriving it later from changed data would quietly rewrite history.

`minutes` is deliberately **not** stored. Title and reason are history;
"how long would this take you right now" is a property of the current
situation, so it is re-derived from the live ranking each time and merged
in memory.

---

## Answering back

Two buttons, two different meanings, and both are claims the data does
not yet reflect.

| | What it means | What happens |
|---|---|---|
| **Done** | A claim about the past | Row closed. Kind silent for a day. |
| **Not now** | A claim about today | Row closed. Kind silent for a day, then **halved** for a week. |

Neither pressing a button nor closing a row changes the underlying
record — no training session appears because somebody said they trained.
So re-ranking identical inputs put the same card straight back, and with
one card gone the dismissed one was **promoted into the slot it was
dismissed from**. Both read as broken controls.

Hence two mechanisms, doing different jobs:

- `SETTLED_QUIET_DAYS = 1` — narrow and blunt. Not today, because you
  already answered today. Applied in the store, before reconciliation.
- `DISMISS_COOLDOWN_DAYS = 7` — the scorer **halves** a dismissed kind
  rather than removing it, so waving something away is respected without
  being permanent. A genuinely changed situation can still bring it back.

`RECOMMENDATION_TTL_DAYS = 3` expires anything nobody answered. Advice
built on "you played yesterday" is wrong by the weekend, and a stale row
that still looks current is worse than no row at all.

---

## Two rule engines, one slot

The Locker already had a **Briefing** when this was built — same
philosophy, built earlier: rule-based not generative, every line names
its cause, an action attached, priority sorted. Six of its eight line ids
have a direct counterpart among the scorer's eight kinds.

Shipping both untouched would have put two panels at the top of the
Locker telling somebody to review the same match in different words.

Deleting the Briefing was not on the table — removing a working engine is
a decision for a person, not a side effect of adding a feature. So they
**coexist**: `lib/intelligence/overlap.ts` maps kind → briefing line, the
panel takes the top slot, and the Briefing drops any line already
covered. If that empties it, it renders nothing rather than an empty
"Today" header.

```ts
SUPERSEDES = {
  review_match: ["review"],   recovery:   ["readiness"],
  checkin:      ["checkin"],  study:      ["study"],
  match_prep:   ["match"],    set_goal:   ["focus"],
}
```

`training` and `log_match` supersede nothing — the Briefing never says
either, so both surfaces can speak. The `quiet` line is never
suppressible: it only appears when there is nothing to say, which cannot
be true at the same moment a recommendation is.

Retiring either engine later is a one-line change.

---

## "Why this?"

The scorer emits compact tokens — `goal:g1`, `study:recency` — because it
is pure and cannot look a title up. Rendered directly, the panel said:

> **GOAL** g1  ·  **STUDY** recency

Which is worse than saying nothing: it looks like the system is quoting
evidence while actually showing the reader its plumbing.

`describeSource()` translates each token into **the input it names** —
"Your current development focus", "When you last studied" — and returns
`null` for anything it cannot say in English, which the panel drops. A
"why this?" listing six items to prove diligence does the same job as no
explanation at all.

An observation token carries a real football phrase rather than a key, so
it is quoted verbatim: *"Late scan before receiving"*.

The inspector renders every token beside its translation and flags
untranslated ones in red — cheaper than finding them on the Locker.

---

## Failure behaviour

`getNextActions` catches everything and returns `{ items: [], informed:
false }`. A dashboard renders without its recommendations rather than not
at all.

`emitMidoEvent` never throws, and that asymmetry is deliberate: a missing
event costs a worse recommendation later; a failed action costs the user
their work now.

`settledRecently` fails **open** — re-offering something already answered
is mildly annoying, and better than a dashboard with no advice on it.

---

## Two kinds of nothing

Not knowing enough and having nothing left to say are opposite states,
and the panel says them differently:

- `informed === false` → *"MIDO does not know enough about you yet."*
  Needs one of: an active goal, a match on record, a readiness figure.
- `informed === true`, no items → *"You have answered everything for
  today."*

Collapsing these would tell a player who has just worked through
everything that MIDO knows nothing about them. This is also the place a
dashboard is most tempted to **invent** — an empty hero looks unfinished
— and inventing here is what would make every later recommendation
untrustworthy.

---

## Tests

| File | Covers |
|---|---|
| `next-best-action.test.ts` | Scoring, the safety rule, `explainActions` parity — 42 |
| `signals.test.ts` | Rows → signals, date arithmetic |
| `recommendations.test.ts` | Storage shape, source parsing, English — 15 |
| `overlap.test.ts` | Briefing collision, end to end — 9 |
| `player-journey.test.ts` | The chain, five journeys — 22 |

The journey tests stop at the last pure boundary. Persistence carries
`import "server-only"`, which vitest cannot load, and mocking Supabase to
reach past it would test the mock. So a journey ending "the player would
now see X" means **the ranking says X** — it does not prove a row was
written. The store is covered by its own tests and by browser
verification.

---

## Known limits

- **`daysSinceCheckin` is not the same as "checked in today".** The
  signal counts any check-in, scored or not; the Locker's own
  `checkedInToday` is a separate read. They agree today.
- **Player timezone.** `daysBetween` is UTC on both sides. A player six
  hours off UTC can see a day-boundary signal flip at a time that is not
  their midnight.
- **`RECOVERY_LOGGED` has no emitter.** There is no manual
  recovery-logging action, and the only recovery write is the WHOOP sync,
  which is untestable here. `PLAYER_CHECKIN_COMPLETED` already carries
  the readiness figure the scorer reads.
- **Demo mode reads two clocks.** `lib/seed.ts` states its fixture twice
  — a fixed date and a fixed `daysRemaining` — so the Locker's copy is
  frozen while signals compute against today. `match_prep` therefore
  cannot fire in demo. Production reads both from the same `matches`
  rows and cannot drift.

---

## Migrations

`0031_mido_events.sql` and `0032_mido_recommendations.sql`. **Neither has
been run.** Until they are, the Supabase paths fail, log, and return
empty — every user action continues to work normally, and the Locker
shows its honest empty state. That is the failure behaviour working, not
a broken state.

Demo mode keeps both in memory, so the whole loop is exercisable with no
keys.
