-- ============================================================
-- MIDO XI — 0032: recommendations that were actually given
--
-- The scorer produces six to eight candidates every time it
-- runs, and it runs on a dashboard load. This table holds only
-- the ones a person was actually SHOWN — the small subset that
-- has a life of its own, because it can be completed, waved
-- away, or go stale.
--
-- THE ANTI-GRAVEYARD RULE IS IN THE SCHEMA, not in a promise
-- to be careful: the unique index below permits at most ONE
-- ACTIVE recommendation of a kind per person. A re-rank updates
-- that row instead of adding another, so the table stays a
-- record of advice given rather than a log of arithmetic.
--
-- Separate migration from 0031 on purpose. Two schema changes
-- that can be run and rolled back independently are two
-- decisions; bundled, they are one decision nobody can undo
-- by half.
--
-- Safe to re-run.
-- ============================================================

create table if not exists mido_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Matches ActionKind in lib/intelligence/next-best-action.ts, which
  -- is the authority. Text rather than an enum so a new kind of advice
  -- does not need a migration and a deploy in lockstep.
  kind text not null,

  /*
    The words that were shown, stored as shown.

    Not regenerated on read: the reason is a claim MIDO made to somebody
    at a moment, and re-deriving it later from changed data would
    quietly rewrite history. If a player says "MIDO told me to recover",
    this is what it said.
  */
  title text not null,
  reason text not null,

  -- The score at the moment it was surfaced. Kept for the inspector and
  -- for judging whether the ranking behaved sensibly after the fact.
  priority integer not null default 0,

  /*
    Where it came from: [{ type, id?, label? }].

    Inspectable on purpose — this is what "why this?" is built from, and
    what makes a recommendation auditable rather than an assertion.
  */
  sources jsonb not null default '[]'::jsonb,

  status text not null default 'active'
    check (status in ('active', 'completed', 'dismissed', 'expired')),

  created_at timestamptz not null default now(),
  /*
    Short by design. Advice built on "you played yesterday" is wrong by
    the weekend, and an expired row is far better than a stale one that
    still looks current.
  */
  expires_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz
);

/*
  At most one ACTIVE recommendation per kind per person.

  This is the constraint that keeps the table small and the upsert
  honest. Completed and dismissed rows are exempt — they are history and
  there can be many.
*/
create unique index if not exists mido_recommendations_one_active_idx
  on mido_recommendations (user_id, kind)
  where status = 'active';

-- What the Locker asks for: my active advice, best first.
create index if not exists mido_recommendations_active_idx
  on mido_recommendations (user_id, status, priority desc);

-- What the cooldown asks for: what have I waved away lately.
create index if not exists mido_recommendations_dismissed_idx
  on mido_recommendations (user_id, status, dismissed_at desc);

alter table mido_recommendations enable row level security;

/*
  Owner-only, and updatable — unlike the event log.

  The distinction is deliberate. An event records that something
  happened and must never be editable. A recommendation has a LIFECYCLE:
  it is given, then completed or dismissed. Those are changes to the
  same thing, not new facts, so this table permits update where
  mido_events does not.
*/
drop policy if exists mido_recommendations_owner on mido_recommendations;
create policy mido_recommendations_owner on mido_recommendations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- anon, public AND authenticated, then grant back exactly what is
-- needed. The trap 0011, 0017, 0019, 0003, 0024, 0027, 0030 and 0031
-- each fell into, avoided by naming all three every time.
revoke all on mido_recommendations from anon, public, authenticated;
grant select, insert, update, delete on mido_recommendations to authenticated;

comment on table mido_recommendations is
  'Advice MIDO actually gave, not every candidate it scored. At most one active row per kind per person, enforced by a partial unique index, so a re-rank updates rather than accumulates. Title and reason are stored as they were shown: re-deriving them later would rewrite what MIDO said.';

notify pgrst, 'reload schema';
