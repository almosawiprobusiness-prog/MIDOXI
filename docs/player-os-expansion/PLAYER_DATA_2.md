# Player data model 2.0

The current model is not wrong. It is **flat, un-sourced and un-historied**, and
those three gaps are what stop MIDO XI from doing the things in
`GAME_CHANGERS.md`.

---

## 1 · What exists

`player_profiles` — one row per user, overwritten in place:

```
date_of_birth, nationality, foot, height_cm, weight_kg,
primary_position, secondary_position, club, league,
squad_number, season, level, is_public, bio, updated_at
```

Around it: `matches`, `match_stats`, `match_reviews`, `daily_checkins`,
`assessments`, `development_goals`, `development_evidence`, `clips`,
`clip_analyses`, `studies`, `coach_feedback`, `calendar_events`.

The data is there. It is the **relationships between the rows** that aren't.

## 2 · The three gaps

**No provenance.** `height_cm = 178` — did the player type that, did a coach
record it, or did MIDO infer it? The app has no way to know, so it cannot say.
This directly violates the product's own rule about separating verified fact from
interpretation: the rule is enforced in the AI layer and nowhere in the data.

**No history.** Change club and last season's club is gone. Grow 4cm and the
old height is gone. A development product that overwrites its own past cannot
show progress, which is the only thing it exists to show.

**No confidence.** Nothing distinguishes a figure measured under a stopwatch
from one a player guessed. The AI treats both as equally solid, which means the
worst input silently degrades every conclusion built on it.

## 3 · The change

Not a rewrite. Three additions.

### 3.1 · A provenance envelope on facts

Rather than replacing `player_profiles`, add a companion table of **typed,
sourced, dated facts** for anything that changes or that anyone might dispute:

```
player_facts
  id, user_id
  key            'height_cm' | 'club' | 'squad_number' | 'position' | ...
  value          jsonb — the value plus its unit where relevant
  source         'self' | 'coach' | 'club' | 'device' | 'mido'
  source_ref     the coach's user_id, the device name, the analysis id
  confidence     'measured' | 'stated' | 'inferred'
  observed_at    when it was true — not when it was typed
  superseded_at  null while current
```

`player_profiles` stays as the fast read of *current* values. It becomes a
projection of the latest non-superseded fact per key, which keeps every existing
query working unchanged.

`observed_at` vs `created_at` is the important distinction: a player entering
last season's data in September is recording something that was true in May.

### 3.2 · Confidence, and what it's for

Three levels, and each has to actually change behaviour or it is decoration:

| Confidence | Means | Effect |
|---|---|---|
| `measured` | Recorded under a defined protocol — a timed test, a GPS unit, a match sheet | Used in comparisons and trends without qualification |
| `stated` | The player or coach said so | Used, but labelled; never the sole basis for a strong claim |
| `inferred` | MIDO derived it | Always shown as MIDO's read; never re-ingested as fact |

The rule that keeps this from rotting: **`inferred` facts must never become
`stated` facts.** If MIDO infers a weakness and that inference is later fed back
into another analysis as input, the model is now reasoning about its own output
and calling it evidence. Mark it and keep it marked.

### 3.3 · The timeline

One chronological view over the tables that already exist:

```
player_timeline (view)
  occurred_at, user_id, kind, ref_id, title, summary, meta
```

`kind` ∈ match, training, checkin, clip, observation, study, goal_set,
goal_reached, assessment, feedback, note.

This is a **view, not a table** — no sync problem, no write path, no way for it
to disagree with the source. Cost is one composite index per contributing table
on `(user_id, occurred_at)`. If it gets slow at volume, materialise it then;
don't pre-optimise a query nobody has run yet.

The timeline is the spine for reports, memory, career mode and the closed loop.
It is the single highest-leverage row in this document, and it is a view.

## 4 · The deep profile — what's actually missing

Beyond provenance, the fields a football development product should hold and
does not:

**Football identity.** Preferred role within the position (a "6" is not a "8"),
tactical style, the systems they've played in, the systems they're comfortable in.

**The career record.** Clubs with date ranges, levels, appearances per season,
honours. Currently one `club` text field with no history — the trial CV in
`REPORT_ENGINE.md` cannot be produced without this.

**Physical baseline over time.** `assessments` exists; growth does not. For a
14-year-old, height and weight trajectory is one of the most informative things
in the record, and it is currently overwritten monthly.

**Availability.** Injury periods, illness, unavailability. `daily_checkins` has
soreness but there's no concept of *out*, so minutes trends are silently wrong
across an absence.

**Constraints and context.** Travel time to training, school load, what they can
actually access (a gym? a wall? a field?). Every physical programme MIDO writes
currently assumes facilities that may not exist.

**Goals with a horizon.** `development_goals` has no timeframe. A goal for this
month and a goal for this season need different pacing and different reviews.

## 5 · Privacy

- `player_facts` inherits the same RLS shape as everything else: `user_id =
  auth.uid()`, with coaches reading through `coach_players` only.
- Coach-sourced facts are **visible to the player, always.** A record about
  someone that they cannot see is not a record, it's a file.
- Date of birth is the most sensitive field in the model — it identifies a minor.
  It should be readable by the owner and by explicitly linked staff, and it
  should never appear in a share link, an OG image, or a log line.
- Deletion has to be real: a facts table with `superseded_at` makes it tempting
  to keep everything forever. Account deletion deletes, including history.

## 6 · Migration path

1. Create `player_facts`; backfill from `player_profiles` as
   `source='self', confidence='stated', observed_at=updated_at`. Honest about
   what those values actually are.
2. Write new values to both. `player_profiles` remains the read path.
3. Add the `player_timeline` view plus indexes. Nothing else changes.
4. Add the profile fields from §4 as new fact keys — no schema change per field,
   which is the point of the envelope.
5. Move reads to the facts table where provenance matters (reports, AI context).

Every step is additive. Nothing existing breaks at any point, which is the only
way a migration like this survives contact with a live product.
