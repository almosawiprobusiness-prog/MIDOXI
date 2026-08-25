# MIDO XI — Interconnection Audit

**Date:** 24 August 2026
**Scope:** every data module, AI engine, server action and route across
Player / Coach / Trainer / Club OS.

---

## How this was produced, including the mistake

Every claim below is **measured**, not assumed. Passes run:

1. **`lib → lib` import graph.** 170 edges, reduced to meaningful ones.
2. **`app/**/actions.ts` import graph.** 35 server-action files.
3. **Route sweep.** All 65 pages loaded in a browser, errors captured.
4. **Schema read.** Migrations inspected for cross-module views.

**The first version of this document was wrong, and the error is worth
recording because it is the same error a reader could make.**

I measured only `lib → lib` edges and concluded that the Coach AI never
sees the coach's squad, that the Trainer AI never sees its athletes, and
that club methodology is "a text field nothing reads". All three were
false.

They were false because **the wiring lives in the action layer, not the
data layer.** `app/app/sessions/actions.ts` fetches `listSquad()` *and*
`methodologyContext("play")` and passes both into the session drafter,
which scores the club's principles for relevance and reports back
"Written inside your club methodology (N principles)."

A data layer whose modules do not import each other is not evidence of
disconnection. In this codebase composition happens at the action
boundary — which is a defensible design, and invisible to the measurement
I ran first.

**Corrected method:** interconnection is counted where a server action or
page composes two or more domains. That is what the tables below use.

---

## Headline findings

| # | Finding | Evidence |
|---|---|---|
| 1 | **The product is far more connected than it looks from the data layer.** Seven server actions compose 3+ domains. | action-layer graph below |
| 2 | **Film analysis is the most connected thing in the product** — 10 modules, including the player's goals, position and prior studies. | `film-room/analysis-actions.ts` |
| 3 | **Session drafting already runs inside club methodology.** | `sessions/actions.ts` → `methodologyContext("play")` → `relevantPrinciples()` |
| 4 | **There is no event system at all.** | `emitEvent\|recordEvent\|EventType\|dispatchEvent` — zero matches repo-wide |
| 5 | **The Timeline is a SQL view over 8 tables** — derived history, not an event log. | `player_timeline`, migration 0015 |
| 6 | **Nothing consumes the connections after the fact.** Rich context goes *into* each action; almost nothing comes back out as reusable state. | no recommendation store, no context cache, no event log |
| 7 | **Genuine islands are the operational modules**, not the intelligent ones: calendar, training, recovery, meetings, tactics, teams. | action-layer graph |

**The real problem is not that MIDO knows too little. It is that MIDO
knows a great deal, once, at the moment of a single action, and then
forgets it.**

---

## Where interconnection already exists

Server actions composing three or more domains, measured:

| Action | Domains composed | What it means |
|---|---|---|
| `film-room/analysis-actions.ts` | video readers, `analyses`, `film`, `profile`, `development`, `studies`, `knowledge/graph`, `knowledge/mapping` | The film AI reads the player's goals, position and prior observations before watching |
| `film-room/loop-actions.ts` | `development`, `knowledge/mapping`, `concepts`, `graph` | Observation → proposed goal → player confirms → evidence |
| `sessions/actions.ts` | `coach`, `ai/coach-engine`, **`club`** | Session drafting inside club methodology, squad-focus aware |
| `matches/voice-actions.ts` | `ai/voice-match`, `matches`, `profile`, `clubs` | Spoken match logging with identity context |
| `programs/actions.ts` | `trainer`, `trainer-compose`, `ai/trainer-engine` | Programme generation from athlete data |
| `opposition/actions.ts` | `coach`, `ai/coach-engine` | Opposition plans from the coach's own reports |
| `study/actions.ts` | `studies`, `ai/study-engine` | Study engine reading `memory`, goals, profile |

And in the data layer:

| Edge | Meaning |
|---|---|
| `memory → development, timeline, concepts` | MIDO's beliefs are grounded in goals and history |
| `discover → profile, development` | Study recommendations cite the goal they serve |
| `studies → study-engine, profile, development, people` | Studies are goal-aware |
| `collections → film, annotations` | Reels carry clips and drawings |
| `search-index → matches, development` | Search spans domains |
| `timeline → 8 tables (SQL view)` | One chronological spine |

This is a substantial amount of real interconnection. **It should not be
rebuilt.**

---

## Module status

Status: **Connected** (composed with other domains at some layer) ·
**Island** (only its own page/action reads it) · **Derived** (composed,
not stored).

### Player OS

| Module | Status | Note |
|---|---|---|
| `development` | **Connected** | Read by memory, discover, studies, search-index, analysis, loop |
| `memory` | **Connected** | Reads development + timeline; read by study-engine |
| `analyses` (film readings) | **Connected** | Richest context assembly in the product |
| `studies` / `discover` | **Connected** | Goal-aware, cite their reason |
| `film` / `annotations` | **Connected** | Via collections, analyses, timeline view |
| `matches` | **Partial** | Rich on the voice path; the ordinary form writes to the store only |
| `timeline` | **Derived** | The spine — 8 sources, player-scoped |
| `training` | **Island** | Writes load; nothing reads it back |
| `recovery` | **Island** | Readiness computed and shown; feeds only the timeline |
| `performance` | **Island** | Derived stats, no consumer |
| `calendar` | **Island** | Store only — nothing reads the week |
| `meetings` | **Island** | Store only |
| `feed` (Community) | **Island** | Correctly so — social is not development data |

### Coach OS

| Module | Status | Note |
|---|---|---|
| `coach` (squad, sessions, opposition) | **Connected** | Feeds coach-engine via sessions + opposition actions |
| `coach-compose` | **Connected** | Scores club principles by relevance to the objective |
| `tactics` (boards) | **Island** | Boards are drawn and saved; nothing reads them |
| `squad` notes | **Partial** | `focus` reaches session drafting; notes do not |

### Trainer OS

| Module | Status | Note |
|---|---|---|
| `trainer` (athletes, programs) | **Connected** | Feeds trainer-engine via programs action |
| `assessments` | **Partial** | Recorded and read by trainer; no retest scheduling, no player link |

### Club OS

| Module | Status | Note |
|---|---|---|
| `club.methodology` | **Connected** | Read by session drafting — the strongest club→coach link in the product |
| `teams` / `staff` | **Island** | Structure recorded; nothing reads it |

---

## What is genuinely missing

### 1. No event system — the central gap

`emitEvent`, `recordEvent`, `EventType`, `dispatchEvent`: **zero matches
repo-wide.** Nothing announces that anything happened.

This is why finding #6 is the real story. Every rich composition in the
table above is **transient**: the film reader assembles goals, position,
prior studies and the knowledge graph, produces observations — and the
next action starts from nothing. Consequences:

- Notifications cannot be triggered by meaning, only written directly.
- Recommendations cannot expire when their basis changes.
- The Timeline sees only what somebody added to a SQL view.
- Nothing can answer *what changed since last time*, which is the
  strongest possible signal for context selection.

### 2. No recommendation object

`discover` produces recommendations with a stated reason — the right
shape, already live ("Speaks to your goal…"). But it is local to Discover:
no shared type, no scoring, no source attribution, no expiry, so nothing
else can produce or rank a recommendation.

### 3. No shared context selection

Three bespoke `*-compose` modules that disagree in shape. Each action
hand-assembles what it needs. This works, and it is why the product is
better connected than it looks — but it means every new surface pays the
assembly cost again, and nothing decides *what matters most right now*.

### 4. The operational modules are inert

Calendar, training, recovery, meetings, tactics and teams all record
things that should obviously affect other decisions — a match tomorrow, a
heavy load, a low readiness score, an unstaffed team — and none of them
are read by anything.

---

## Recommended build order

The spec's P0–P8 is close. Two adjustments on the evidence:

**The event system moves to P0.** It was P2. Everything the spec wants —
Next Best Action, notification intelligence, recommendation expiry,
context selection, the Player loop — needs the same missing primitive:
a record of what happened. It is also the cheapest to add, because the
Timeline view already defines the eight events worth emitting first.

**"Wire the AI engines to their data" comes off the list.** It is largely
done. What remains is narrower and should be stated as such: squad *notes*
into coach context, assessments into retest scheduling.

| Phase | Work | Why here |
|---|---|---|
| **P0** | Event system: `events` table, typed catalogue, `emit()`; emit from the actions that already compose | Unblocks everything else; Timeline view shows the shape |
| **P1** | Re-point `player_timeline` at the event log; add coach/trainer/club timelines | Proves the event log against a surface that already works |
| **P2** | Recommendation object + store, with source attribution and expiry | Makes `discover`'s good shape reusable |
| **P3** | Next Best Action scoring — deterministic rules, AI explains only | Depends on P0 + P2 |
| **P4** | Context selection driven by recent events | Now cheap, because "recent" is answerable |
| **P5** | Operational modules into the loop: readiness → training, fixture → match prep | Converts six islands into signals |
| **P6** | Coach ↔ Player and Trainer ↔ Player permissions | Needs a settled event and permission model |

---

## Honest limits of this audit

- **Static analysis cannot see runtime composition.** This was already
  written as a caveat in the first version and I then violated it. The
  action-layer pass fixes the largest blind spot, but a page that fetches
  two adapters and renders them together still scores as zero here.
- **Demo mode differs from production.** Several modules branch on
  `isDemoMode`; the Supabase path may be thinner than the seeded one.
- **"Island" is a claim about consumers, not about quality.** The Tactics
  board is an excellent feature that nothing reads. That is an
  interconnection finding, not a criticism of the board.
- **"Should be consumed by" is a product judgement**, not a measurement,
  and is the column most worth arguing with.
