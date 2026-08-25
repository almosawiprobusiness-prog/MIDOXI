# Event System

**Status:** built and instrumented for goals and matches. Runs alongside
`player_timeline`, which is untouched.

---

## Why

The audit's finding: MIDO assembles rich context during a single action —
the film reader reads goals, position, prior studies and the knowledge
graph before it watches anything — and then forgets all of it when the
action returns.

This is the memory. One row per meaningful thing that happened.

## What it is not

- **Not a copy of the domain.** A match lives in `matches`. The event
  references it by `subject_id` and carries only what the event itself
  means. Domain tables stay authoritative for *what exists*; this records
  *what happened*.
- **Not analytics.** No `BUTTON_CLICKED`, no `PAGE_OPENED`. The admission
  rule: **an event earns its place only if a row of it could change what
  MIDO says or recommends later.** Telemetry is a separate system with
  different retention and privacy.
- **Not a replacement for `player_timeline`.** That view works and is
  unchanged.

## Schema — `mido_events` (migration 0031)

| Column | Note |
|---|---|
| `type` | text, validated against the catalogue before insert — a new type needs no migration |
| `actor_user_id` | null for system events |
| `subject_type` / `subject_id` | `subject_id` is **text**, not uuid: demo ids are `g1`, study slugs are words |
| `organization_id` / `team_id` | scope, for the coach/club timelines this grows into |
| `source` | `user \| coach \| trainer \| club \| ai \| system` — provenance is a trust question |
| `payload` | event-specific context only, capped at 4 KB |
| `occurred_at` vs `created_at` | a match played Saturday and entered Monday is a **Saturday** event |
| `idempotency_key` | unique where not null |

**Indexes** match the three read patterns and nothing else: everything a
user did (newest first), whether a *kind* of thing happened recently, and
one subject's history.

**RLS is deliberately narrow.** Owner-only read and insert. Cross-role
visibility is a permission model in its own right and is not decided
here — starting closed cannot leak; starting open cannot be taken back.

**There is no UPDATE policy.** History that can be edited is not history.
A correction is a new event.

## Failure behaviour — the decision

> **Recording an event must never fail the thing that caused it.**

A player logs a match; the event insert fails. They see their match
saved. Not an error, not a lost form.

The asymmetry is deliberate:

- a **missing event** costs a worse recommendation later
- a **failed user action** costs the user their work now

So `emitMidoEvent` never throws and never rejects. It returns a result
callers may ignore. Consequence: callers must **not** await it inside a
transaction and roll back on its result — there is nothing to roll back
on. Failures are logged, which is why the observability work matters.

## The vocabulary

21 types, in `lib/events/types.ts`, which is the authority. Player loop:
`PLAYER_CHECKIN_COMPLETED`, `GOAL_CREATED/UPDATED/COMPLETED`,
`MATCH_CREATED/REVIEWED`, `VIDEO_UPLOADED/ANALYZED`,
`FILM_OBSERVATION_CREATED`, `STUDY_STARTED/COMPLETED`, `TRAINING_LOGGED`,
`RECOVERY_LOGGED`. Coach/trainer/club and MIDO's own recommendation
events are defined but not yet emitted.

`EVENT_SUBJECT` maps each type to the one thing it can be about. A
`GOAL_CREATED` whose subject is a match is refused at emit rather than
stored — a bad row poisons every later query.

## Idempotency

Creation and completion are keyed (`goal:GOAL_CREATED:g1`), so a retry or
double submit is a no-op. **Ordinary edits are deliberately unkeyed** —
keying `GOAL_UPDATED` would silently swallow the second genuine edit.

A unique-violation on insert is treated as success, because it means an
earlier attempt already recorded it.

## Instrumented so far

| Action | Events |
|---|---|
| `development/actions.ts` → create / update goal | `GOAL_CREATED`, `GOAL_UPDATED`, `GOAL_COMPLETED` (on `status: achieved`) |
| `matches/actions.ts` → create match | `MATCH_CREATED`, backdated to the match's own date |
| `matches/actions.ts` → save review | `MATCH_REVIEWED` |

**The review payload records *whether* each answer was written, never the
answers.** A match review is the most personal text in the product — what
somebody thinks they did badly — and copying it into a second table would
double the places it must be protected and deleted.

## Not yet done

- Emitting from film, study, training, check-in
- Coach / trainer / club events
- Timeline parity tooling
- Cross-role read policies
