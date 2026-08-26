# Player OS — The Ten Biggest Problems

**Date:** 25 August 2026 · **Method:** used the product as a player in a
browser (desktop and 375px mobile), then traced each observation to the
code that causes it. Every finding below was seen on a rendered screen or
read in an actual call path — nothing is inferred from imports.

A note on what was NOT found: the audit expected to find disconnection
and mostly found the opposite. Film Discover speaks to goals by name.
Development is evidence-based and refuses to invent ratings. Performance
lists what it *cannot* know. Studies separate verified record from
interpretation. The AI layer gates on budget and quota and refuses
honestly. The product's philosophy is real in the code. The problems
below are the places where execution falls short of that philosophy.

---

## 1 · The demo describes three different worlds

**Severity: CRITICAL — trust · Complexity: medium**

**Evidence.** On adjacent screens, right now:

- Locker: *"Next match in **3 days**"* · Match Center: *"**4 DAYS
  OUT**"* — same fixture.
- Match Center: **3** matches played — Halton, Carlton, Ashwell.
  Performance: **6** matches — Halton, *Ashford, Fenwick, Marden, Colby,
  Deanwood*. Only Halton exists in both. "vs Carlton 3–0, 65 min, 8.1"
  and "vs Ashford 3–0, 90 min, 8.1" are visibly the same match wearing
  two names.

**Cause.** Three seed sources: `lib/seed.ts` (Locker, frozen dates and a
hardcoded `daysRemaining: 3`), `lib/data/store.ts` (Match Center /
Timeline / Film, week-relative and fresh), `lib/data/performance.ts` (a
private six-match season nobody else can see). Timeline already derives
everything from the store — the store *is* the intended single world; the
other two defected.

**Player impact.** A player who notices the same product giving two
different day-counts, or two different match histories, stops believing
every number on every screen. The demo is the first-touch experience and
every QA pass runs on it. This class of bug also deadens two of the
scorer's eight action kinds in demo (`match_prep`, recovery's fixture
urgency), so the product's intelligence cannot even be demonstrated.

**Fix.** One world: the store. Enrich `seedMatches()` to the six-match
season with relative dates and stat lines; derive `demoPerformance()`
from the store; derive the Locker's fixture clock and `todayIndex` from
the store's calendar.

---

## 2 · The fixture signal is starved — in production, not just demo

**Severity: CRITICAL — intelligence · Complexity: low**

**Evidence.** `app/app/matches/page.tsx` states the product's own rule:
*"[the next fixture] comes from the user's own calendar now."* But
`lib/intelligence/build-signals.ts` computes `daysUntilNextMatch` only
from **match rows** with future dates — rows the UI never encourages
anyone to create ("Add match" logs results). The calendar, where fixtures
actually live, is never read by the signal builder.

**Player impact.** `match_prep` — "prepare for tomorrow" — and the
match-proximity component of recovery scoring can effectively never fire
for a real player who uses the product as designed. The two rules most
tied to the rhythm of an actual week are dead code in practice.

**Fix.** Add calendar fixtures to `RawSignalInputs`;
`daysUntilNextMatch` = nearest of (future match rows ∪ calendar match
events). Small, pure, testable.

---

## 3 · MIDO's memory is invisible to MIDO's own recommendations

**Severity: HIGH — intelligence/trust · Complexity: medium**

**Evidence.** The Memory page holds, seeded: *"ALREADY TRIED: Six weeks
of near-post finishing reps — the timing improved, the finish did not."*
The Locker's top recommendation, on the same account, at the same moment:
*"Study: Near-post finishing."* The memory page promises "MIDO reads this
before it answers anything" — true for paid AI calls
(`memoryPromptBlock` in the study/coach/trainer engines), false for the
deterministic loop: `buildPlayerSignals` never touches memory.

**Player impact.** The player told the product something important about
this exact topic and the product's most prominent surface shows no sign
of having heard. That is the single fastest way to make "MIDO remembers
you" feel like marketing.

**Fix (honest version).** Do not pretend to parse free text into scores.
Match memory lines to a recommendation by word overlap (the
`coversSameGround` machinery already exists) and **attach** the matched
line to the card — "Worth knowing — you told MIDO: …" — leaving the
ranking untouched. The player sees they were heard; the scorer stays
deterministic and explainable.

---

## 4 · Studies hide their strongest connection: the player's own goals

**Severity: HIGH — intelligence · Complexity: low**

**Evidence.** The Harry Kane study teaches five concepts, one of which —
near-post finishing — **is the player's active development focus**. The
page renders the concept list without ever saying so. The join is free:
the study's `concepts` and the player's `goals` are both already loaded
on the page. Meanwhile the only personalization on offer is the paid
"Personalise with MIDO" button.

**Player impact.** The moment a player should feel "this product knows
me" — opening a study that bears directly on what they're working on —
passes silently. The free tier looks generic when it is not.

**Fix.** A strip on the study page naming the overlap: "This study bears
on your current focus: Near-post finishing." Same word-overlap join used
elsewhere. Zero AI cost.

---

## 5 · The Timeline is a list, not a story

**Severity: MEDIUM — product coherence · Complexity: high (do a slice)**

**Evidence.** The timeline renders 25 entries in chronological groups
with filters. Every entry stands alone: the clip "Near-post arrival"
does not point at the goal it evidences, the match it came from (it sits
next to it by coincidence of date), or the study it fed. The spec's ask
— "a player should look back three months and understand their
development arc" — is not met by ordering alone.

**Player impact.** Retention. The timeline is where a player should
*see* that the loop worked — goal → study → training → match →
improvement. Today it reads as an activity log.

**Fix (V1 slice).** Entries already carry goal/match linkage in their
underlying rows. Render the link as a line of context on the entry
("evidence → Blindside movement"), clickable. Full arc-rendering is a
later phase; do not build it now.

---

## 6 · Ten sections of chrome for a four-section product

**Severity: MEDIUM — clarity · Complexity: low (recommend, don't delete)**

**Evidence.** The player sidebar exposes Work (6) + More (7): Locker,
Matches, Film Room, Training, Development, Study, Timeline, Memory,
Recovery, Performance, Calendar, Meetings, Community, Profile,
Connections, Membership, Refer, Settings. The command palette lists 18
destinations. The core loop touches six.

**Player impact.** Every additional destination dilutes the six that
matter. "Meetings" and "Community" sit beside "Development" as if they
were peers.

**Fix.** See `PLAYER_OS_CUT_LIST.md`. Nothing deleted in this pass —
recommendations only.

---

## 7 · Match review asks for effort it never visibly repays

**Severity: MEDIUM — retention · Complexity: medium**

**Evidence.** The review form asks six good football questions plus four
sliders plus an optional 19-field stat line. What happens to the answers
is invisible: "What should I study?" says *FEEDS FILM ROOM* but nothing
on the film room page ever references it; "What needs to enter next
week's training?" names no mechanism at all.

**Player impact.** Effort with no visible consequence trains players to
skip the review — and the review is the product's richest signal source.

**Fix (V1).** After saving, show where each answer went. Minimum honest
version: the review's "study this" line surfaces as a card in Film Room's
Discover rail, and the review emits into the recommendation reasons
("your own review flagged the near post"). Wiring exists for events;
what's missing is the visible round-trip.

---

## 8 · Empty states tell you what's missing, not why it matters

**Severity: LOW-MEDIUM — onboarding · Complexity: low**

**Evidence.** Mixed quality. Memory's empty sections are exemplary
("Built around, rather than treated as something to fix"). The NBA
empty state is exemplary. But a brand-new real account (not demo) lands
on a Locker whose panels largely say variants of "nothing yet" without
sequencing what to do first — the development map's "Nothing set in
physical" phrasing is good, but there is no ordered first-day path:
goal → fixture → check-in.

**Player impact.** Day-1 abandonment. The empty product must sell the
full one.

**Fix.** The NBA panel already sequences ("Set a focus / Log a match").
Extend the same treatment to the two or three panels a new account
actually sees first. Not a redesign.

---

## 9 · Check-in phrasing implies readiness data it doesn't have

**Severity: LOW — honesty at the margin · Complexity: low**

**Evidence.** Briefing line when readiness is low: "Below where you
usually are" — but `readinessOf` has no baseline model; there is no
"usually." Minor phrasing debt in an otherwise scrupulous product.

**Fix.** Say what is true: "You reported 32/100 this morning — that is a
low-readiness day. Consider volume over intensity." Delete the implied
baseline until one exists.

---

## 10 · The demo's own age

**Severity: LOW (rises weekly) — trust · Complexity: solved by #1**

**Evidence.** Store match dates are absolute ("2026-08-09") and drift
one day further into the past every day; `lib/seed.ts` freezes its
fixture at "3 days out" forever. Six months from now the demo describes
a player who stopped playing in August.

**Fix.** Relative dates everywhere in seeds (the store's calendar and
performance's season already do this correctly). Covered by the fix to
problem #1.

---

## What this session will implement

| # | Problem | Priority | Outcome |
|---|---|---|---|
| 1 | One demo world | **P0** | **Fixed** — store is the single season; verified across five pages |
| 2 | Calendar fixtures feed the scorer | **P0** | **Fixed** — `match_prep` fires on the Locker now; +5 tests |
| 3 | Memory acknowledged by recommendations | **P1** | **Fixed** — "You told MIDO you tried this — …" renders under the advice |
| 4 | Study ↔ goal relevance shown | **P1** | **Fixed** — "Bears directly on your current focus" caught both active goals |
| 5 | Timeline is a list, not a story | V1 slice | **Fixed (slice)** — goal threads named on clip/study/evidence rows, both modes, view untouched |
| 7 | Review effort never repaid | V1 slice | **Fixed (slice)** — "From your match reviews" rail in Film Room keeps the form's own promise |
| 9 | Readiness phrasing | **P1** | **Fixed** — no more implied baseline |
| 10 | Seed staleness | **P0** | **Fixed** — relative dates everywhere; falls out of #1 |
| 6 | Nav breadth | recommend | `PLAYER_OS_CUT_LIST.md` |
| 8 | Empty-state sequencing | recommend | On the beta gate as quality debt |

One additional fix found during implementation, not on the original
list: all three surfaces counted days-to-fixture differently (ceil of
hours vs UTC calendar days) — "Next match in 4 days" rendered directly
above "you play in 3 days". Every surface now uses the scorer's
`daysBetween`; the deeper player-timezone question is documented and
deferred deliberately (see the beta gate).
