# Next Best Action

**Status:** engine built and tested (42 tests). Wired into the Player
Locker — see `RECOMMENDATION_ENGINE.md` for everything around it.

`lib/intelligence/next-best-action.ts` — pure, deterministic,
dependency-free. Signals in, ranked actions out. No database, no model
call, no clock of its own.

---

## Why this is not an LLM call

The obvious implementation hands a model the player's history and asks
what they should do. It would work, roughly, and be wrong in three ways
that matter:

1. **It cannot be trusted with the answer that has a safety edge.**
   "Readiness is low and there is a match tomorrow" must never produce
   "go and do a maximal finishing session". That is a rule, and rules
   belong in code where they can be tested and cannot drift between
   requests.
2. **It cannot explain itself honestly.** A model asked to justify its own
   output produces a plausible reason rather than the actual one. Here
   the reason *is* the calculation.
3. **It costs money and latency on every page load**, for a question
   whose inputs change a few times a day.

> **Code decides. AI explains.**
> This file ranks. A model may later phrase the top result more warmly —
> and it will be phrasing a decision it did not make.

## Signals

A flat, small, serialisable shape. **If a signal is not in
`PlayerSignals`, it cannot influence the ranking** — which is what stops
this quietly growing into "pass the whole database".

All time values are numbers (`daysSinceLastMatch`, `daysUntilNextMatch`)
rather than dates, so the function stays pure and has no clock. The
caller resolves time once; tests state a situation directly.

## The safety rule

Hard training is **pushed below the surfacing floor** — not merely
down-weighted — when readiness is low or a match is tomorrow.

Down-weighting would still recommend it on a quiet day. It has to be
gone, not unlikely. This is pinned by three tests.

## Scoring

| Action | Driven by |
|---|---|
| `review_match` | played and unreviewed; decays fast as the memory does |
| `recovery` | depletion **plus recent exertion**, then fixture urgency |
| `study` | serves the top goal; rises with staleness; **rewarded on low-readiness days** because it asks nothing of the legs |
| `training` | readiness and staleness — suppressed by the safety rule |
| `match_prep` | fixture within three days |
| `checkin` | scored on *absence*; the cheapest way to make everything above it accurate |
| `set_goal` / `log_match` | shown only when MIDO genuinely has nothing to go on |

### A rule that was wrong first

Recovery originally took its urgency from the fixture alone. That put
*study* above *recovery* for a player depleted the day after a match with
the next one five days out — backwards. A distant fixture makes hard
**training** less urgent; it does nothing to make recovery less needed.
Post-match is the classic recovery case, so recent exertion now counts in
its own right. Caught by the test encoding the spec's own example.

## Honesty

`hasEnoughToRecommend()` lets a surface choose between recommending and
saying so. When MIDO knows nothing it asks for a focus or a match rather
than inventing advice — and a test asserts it never states a readiness
number it was not given.

A product that invents a recommendation when it knows nothing is one
whose recommendations cannot be trusted when it does.

## Dismissal

A dismissed action is **halved, not deleted**. Repeatedly recommending
something somebody keeps waving away is how a helpful product becomes a
nagging one — but a study dismissed today may be exactly right in a
fortnight.

## Worked example (from the spec, and pinned as a test)

Striker · weak-foot goal · played yesterday, unreviewed · readiness 35 ·
next match in 5 days · last study 9 days ago.

```
review_match  88   "You played yesterday and have not reviewed it yet."
recovery      85   "Your readiness is 35 and you have just played."
study         78   "Your current focus is weak-foot finishing…"
training       —   suppressed by the safety rule
```

## Not yet done

- Locker integration
- Persisting recommendations so they can be completed or dismissed
- Coach / trainer / club variants
