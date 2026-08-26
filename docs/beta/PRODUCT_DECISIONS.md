# Product Decisions

Every meaningful product change, with the evidence that caused it and —
crucially — the result after it shipped. The last field is the one that
makes this a log rather than a changelog: a decision whose result is
never filled in taught us nothing.

**Format:** Problem · Evidence · Decision · Change · Expected · Result.

**Rule for the beta:** no entry may have an empty Evidence field. If the
evidence is "it seemed like a good idea", the entry belongs under
*Unvalidated ideas* at the bottom, not in the log.

---

## Pre-beta decisions

These predate the Founding XI. Their evidence is direct observation of
the product in a browser, not player behaviour — recorded here because
the Result field still has to be filled in once real players arrive, and
because a decision without a record is one nobody can revisit.

### 001 · One seeded world

**Problem.** The demo described three different worlds.
**Evidence.** Observed on adjacent screens: Locker said "Next match in 3
days", Match Center said "4 DAYS OUT" for the same fixture. Match Center
listed 3 matches; Performance listed 6 different ones, where "vs Carlton
3–0, 8.1" and "vs Ashford 3–0, 8.1" were plainly the same match renamed.
**Decision.** Make the demo store the single source; delete the two
defected seed sets.
**Change.** `lib/data/store.ts` holds the season; Performance, the
Locker's fixture clock and `todayIndex` derive from it. All dates
relative so the demo cannot age.
**Expected.** No player or reviewer ever sees two contradictory numbers.
**Result.** *Pending — no player has used the demo yet.*

### 002 · One day-counting rule

**Problem.** Three surfaces counted days-to-fixture differently.
**Evidence.** "Next match in 4 days" rendered directly above "you play in
3 days" on the same screen. Ceil-of-hours also called matchday morning
"1 day out".
**Decision.** Every surface uses the scorer's `daysBetween`.
**Change.** Locker, Match Center and signals share one function.
**Expected.** Day counts agree everywhere.
**Result.** *Pending.* Known limit accepted: UTC calendar days, so a
player far from UTC can see a boundary flip early. Watch for exactly one
kind of feedback — "it says tomorrow but the game is today".

### 003 · Fixtures feed the scorer from the calendar

**Problem.** Match preparation could never fire for a real player.
**Evidence.** `build-signals.ts` read `daysUntilNextMatch` only from
match ROWS with future dates; the product's own UI creates match rows
only for games already played, and the Match Center's source comment
says fixtures come from the calendar.
**Decision.** Read fixtures from the calendar as well.
**Change.** `fixtures` added to `RawSignalInputs`; nearest of both wins.
**Expected.** `match_prep` appears in the week before a real fixture.
**Result.** *Pending.* Measurable: `recommendation_shown` rows with
`kind: match_prep` should be non-zero once a founder adds a fixture. If
they stay zero, either nobody is adding fixtures — itself a finding — or
the rule is still starved.

### 004 · Memory is quoted back on recommendations

**Problem.** The Memory page promised "MIDO reads this before it answers
anything"; the deterministic loop never read it.
**Evidence.** Seeded memory "already tried: six weeks of near-post
finishing reps — the finish did not improve" sat on the same account as
the top recommendation "Study: Near-post finishing", with no
acknowledgement.
**Decision.** Attach the matching memory to the card. Do **not** let it
change the ranking — parsing free text into a score is guesswork wearing
a number.
**Change.** `relevantMemory()` matches by word overlap; the panel quotes
it.
**Expected.** Players feel heard; the scorer stays explainable.
**Result.** *Pending.* Watch 👎 reasons for "it already knows I tried
this" — if that appears, attaching was not enough and the ranking
question comes back with evidence behind it.

### 005 · The review's promise is kept

**Problem.** "Feeds Film Room" beside the review's study-moment field was
a promise nothing kept.
**Evidence.** Traced `momentToStudy` end to end: written to a column and
an event payload, read by no surface.
**Decision.** Surface those moments in the Film Room.
**Change.** `listStudyMoments()` + a rail on the Film Room page.
**Expected.** Review completion holds up, because the effort visibly
returns.
**Result.** *Pending.* Measurable: `match_review_completed` /
`match_logged` ratio. If reviews are skipped anyway, the fix was not the
missing feedback loop.

---

## Beta decisions

*(Nothing yet. The first entry is written when the first piece of player
evidence justifies a change.)*

### Template

```
### NNN · Short name

**Problem.**
**Evidence.**   ← player behaviour, feedback, logs. Never "it seems".
**Decision.**
**Change.**
**Expected.**
**Result.**     ← filled in 1–2 weeks after shipping. Including "no
                  measurable change", which is the most useful result
                  there is and the one most likely to go unrecorded.
```

---

## Unvalidated ideas

Things worth remembering and **not** building during the beta. An idea
moves up into the log only when evidence arrives — three independent
players, or a measured failure.

- Nav breadth: cut Meetings / Community / Refer from Player OS
  (`PLAYER_OS_CUT_LIST.md`). Evidence needed: do founders ever visit
  them? Currently unmeasurable — no page views by design — so the
  evidence would have to come from asking.
- Empty-state sequencing on secondary panels.
- Player timezone on the profile, to fix UTC day boundaries properly.
- Full timeline arc-rendering (goal → study → training → match as a
  drawn thread, not a per-entry label).
