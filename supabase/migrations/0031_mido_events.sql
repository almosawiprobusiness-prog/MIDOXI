-- ============================================================
-- MIDO XI — 0031: the event log
--
-- The audit found that MIDO already assembles rich context —
-- the film reader reads goals, position, prior studies and the
-- knowledge graph before it watches anything — and then
-- forgets all of it the moment the action returns.
--
-- This is the memory. One row per meaningful thing that
-- happened, so that later work can ask "what has this player
-- actually done, and when".
--
-- WHAT THIS IS NOT:
--
--   · NOT a copy of the domain. A match already exists in
--     `matches`. The event references it and carries only what
--     the event itself means. The domain tables stay
--     authoritative for WHAT EXISTS; this records WHAT HAPPENED.
--
--   · NOT analytics. No BUTTON_CLICKED, no PAGE_OPENED. If a
--     row here would not change a recommendation, it does not
--     belong here. Telemetry is a different system with
--     different retention and different privacy.
--
--   · NOT a replacement for `player_timeline` yet. That view
--     works and stays exactly as it is. This runs alongside it
--     until a parity report says otherwise.
--
-- Safe to re-run.
-- ============================================================

create table if not exists mido_events (
  id uuid primary key default gen_random_uuid(),

  /*
    The vocabulary is deliberately small — see lib/events/types.ts,
    which is the authority. Kept as text rather than an enum so a
    new event type does not need a migration and a deploy in
    lockstep; the emitter validates against the catalogue before
    anything reaches here.
  */
  type text not null,

  -- Who did it. Null for system-generated events.
  actor_user_id uuid references auth.users(id) on delete cascade,

  /*
    What it was about. `subject_id` is TEXT, not uuid, on purpose:
    demo-mode ids look like 'g1', study slugs are words, and a
    subject is not always a row in a table with a uuid key. A
    foreign key here would be wrong more often than it was right.
  */
  subject_type text not null,
  subject_id text,

  -- Scope, for the coach/club timelines this will grow into.
  organization_id uuid,
  team_id uuid,

  -- Who or what caused it: user, coach, trainer, club, ai, system.
  source text not null default 'user',

  /*
    Event-specific context ONLY. A goal event carries the title
    and category, not the whole goal. The rule that keeps this
    table small: if the value can be read from the domain table
    via subject_id, it does not go in here.
  */
  payload jsonb not null default '{}'::jsonb,

  /*
    When it HAPPENED versus when it was RECORDED. These differ
    for anything backfilled or logged after the fact — a match
    played on Saturday and entered on Monday is a Saturday event.
    Every read orders by occurred_at.
  */
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- Payload shape version, so an old row stays readable.
  version integer not null default 1,

  /*
    Idempotency. A server action that retries — or a double
    submit — must not produce two events. Callers pass a key
    derived from the thing that happened, and the unique index
    below turns a duplicate into a no-op rather than a second
    row that would double-count in every recommendation.
  */
  idempotency_key text
);

/*
  The three read patterns this table has, and nothing else:

    · everything a user did, newest first — the timeline
    · whether a KIND of thing happened recently — "has this
      player studied this week?", which is the single most
      common recommendation question
    · one subject's history — this goal, this match
*/
create index if not exists mido_events_actor_time_idx
  on mido_events (actor_user_id, occurred_at desc);

create index if not exists mido_events_actor_type_time_idx
  on mido_events (actor_user_id, type, occurred_at desc);

create index if not exists mido_events_subject_idx
  on mido_events (subject_type, subject_id, occurred_at desc);

create unique index if not exists mido_events_idempotency_idx
  on mido_events (idempotency_key)
  where idempotency_key is not null;

alter table mido_events enable row level security;

/*
  Owner-only, deliberately narrow to start.

  Cross-role visibility — a coach reading their player's events —
  is a permission model in its own right and is NOT being decided
  here. Starting closed means the first version cannot leak; a
  policy can be widened later with the connection model in front
  of it. Starting open could not be taken back.

  No UPDATE policy at all: an event is a record of something that
  happened, and history that can be edited is not history. A
  correction is a new event.
*/
drop policy if exists mido_events_owner_read on mido_events;
create policy mido_events_owner_read on mido_events for select to authenticated
  using (actor_user_id = auth.uid());

drop policy if exists mido_events_owner_write on mido_events;
create policy mido_events_owner_write on mido_events for insert to authenticated
  with check (actor_user_id = auth.uid());

-- anon, public AND authenticated, then grant back exactly what is
-- needed. The trap 0011, 0017, 0019, 0003, 0024, 0027 and 0030
-- each fell into, avoided by naming all three every time.
revoke all on mido_events from anon, public, authenticated;
grant select, insert on mido_events to authenticated;

comment on table mido_events is
  'What happened, as opposed to what exists. One row per meaningful football-development action, referencing the domain rather than copying it. Append-only: there is no update policy, because history that can be edited is not history — a correction is a new event.';

notify pgrst, 'reload schema';
