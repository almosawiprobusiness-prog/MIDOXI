-- ============================================================
-- MIDO XI — 0024: meetings two people share
--
-- `calendar_events` is a PERSONAL calendar: one `user_id`, one
-- owner, no notion of anybody else. It already has a 'meeting'
-- kind, which was always a note-to-self rather than a meeting.
--
-- ONE ROW, TWO READERS. The obvious shortcut is to write a
-- calendar_events row into each person's calendar and keep them in
-- step. That design drifts the first time somebody reschedules,
-- and the failure is the one everybody has lived through: it moved
-- on his calendar and not on mine. So a meeting is a single row
-- that both parties read, and the calendar becomes a union of
-- personal events and meetings you are party to. There is nothing
-- to keep in sync because there is only one of it.
--
-- RESCHEDULING IS A PROPOSAL, NOT AN EDIT. If either side could
-- write `starts_at` directly, a coach could move a session onto a
-- player's match day and the player would find out by looking. A
-- new time is proposed and the other side accepts, which is also
-- what makes "who moved this?" answerable — `meeting_events` keeps
-- the history append-only.
--
-- Times are `timestamptz` throughout and rendered in each viewer's
-- own zone. A coach and a player in different countries is the
-- normal case here, not the edge case.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · the meeting ──────────────────────────────────────────

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),

  /*
    Two parties. Deliberately not a join table yet: every meeting
    this product has a use for today is a coach and a player, or a
    trainer and an athlete. A `meeting_participants` table can be
    added later without touching these two columns, and guessing at
    group meetings now would mean carrying an empty abstraction
    through every query in the meantime.
  */
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  with_user  uuid not null references auth.users(id) on delete cascade,

  kind text not null default 'call'
    check (kind in ('call','film','check_in','review','session')),
  title text not null,
  note text,

  starts_at timestamptz not null,
  ends_at   timestamptz not null,

  /*
    'proposed'  waiting on the other side
    'confirmed' both agree
    'declined'  the other side said no
    'cancelled' called off after being confirmed
    'done'      it happened

    'declined' and 'cancelled' are distinct on purpose: one never
    happened and the other was called off, and a player looking
    back at a coach who cancels repeatedly deserves to see which.
  */
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','declined','cancelled','done')),

  -- Video. `provider` is null until somebody attaches a way to
  -- meet; 'daily' rooms are created on demand and the room name is
  -- kept so the same room is reused for the life of the meeting.
  video_provider text check (video_provider is null or video_provider in ('daily','external')),
  video_room text,
  external_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A meeting with itself is not a meeting.
  constraint meetings_not_self check (created_by <> with_user),
  -- A zero-length or backwards meeting is a data-entry bug that
  -- renders as an invisible block on a calendar.
  constraint meetings_ordered check (ends_at > starts_at)
);

create index if not exists meetings_creator_idx on meetings (created_by, starts_at desc);
create index if not exists meetings_invitee_idx on meetings (with_user, starts_at desc);
create index if not exists meetings_upcoming_idx on meetings (starts_at)
  where status in ('proposed','confirmed');

/*
  Am I party to this meeting?

  SECURITY DEFINER because the child tables' policies need to ask
  it, and a plain subquery against `meetings` from inside a policy
  on `meeting_agenda` re-enters meetings' own policy. Kept to a
  single existence check over the two id columns so there is very
  little to get wrong inside the privilege escalation.
*/
create or replace function is_meeting_participant(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from meetings
    where id = m and (created_by = auth.uid() or with_user = auth.uid())
  );
$$;

-- ── 2 · rescheduling ─────────────────────────────────────────

create table if not exists meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  proposed_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','superseded')),
  created_at timestamptz not null default now(),
  constraint meeting_proposals_ordered check (ends_at > starts_at)
);

-- At most one live proposal per meeting: two competing "can we move
-- it to..." offers is how both people end up at different times.
create unique index if not exists meeting_proposals_one_open
  on meeting_proposals (meeting_id) where status = 'pending';

create index if not exists meeting_proposals_meeting_idx
  on meeting_proposals (meeting_id, created_at desc);

-- ── 3 · the shared agenda ────────────────────────────────────

/*
  What the meeting is actually about, in order, editable by both.

  This is the part that makes it a film session rather than a
  calendar invite: an item can BE a clip at a timestamp, a study or
  a development goal, so "join" opens both people on the same frame
  of the same video rather than on a call where somebody has to
  describe what they meant.
*/
create table if not exists meeting_agenda (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  added_by uuid not null default auth.uid() references auth.users(id) on delete cascade,

  /*
    Fractional ordering. Dropping an item between two others is a
    single row write of the midpoint, not a rewrite of every
    position — which matters because both people can reorder at
    once and a full rewrite makes their edits fight.
  */
  position numeric not null,

  kind text not null default 'note'
    check (kind in ('note','clip','study','goal','video')),
  title text not null,
  body text,

  ref_clip  uuid references clips(id) on delete set null,
  ref_study uuid references studies(id) on delete set null,
  ref_video uuid references videos(id) on delete set null,
  ref_goal  uuid references development_goals(id) on delete set null,
  -- Where in the film. Null for anything that is not a moment.
  at_seconds numeric,

  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meeting_agenda_order_idx on meeting_agenda (meeting_id, position);

-- ── 4 · what happened to it ──────────────────────────────────

/*
  Append-only. The whole point of proposing rather than editing is
  that the history survives, so nothing here is ever updated or
  deleted by the application — there is no update or delete grant
  below, which is what actually enforces that.
*/
create table if not exists meeting_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null
    check (action in ('created','accepted','declined','proposed_time','accepted_time','declined_time','cancelled','completed','joined')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meeting_events_meeting_idx on meeting_events (meeting_id, created_at);

-- ── 5 · RLS ──────────────────────────────────────────────────

alter table meetings          enable row level security;
alter table meeting_proposals enable row level security;
alter table meeting_agenda    enable row level security;
alter table meeting_events    enable row level security;

/*
  Both parties read and both parties write. A meeting is not owned
  by whoever happened to create it — a player must be able to
  propose a new time for a session a coach booked, or the proposal
  mechanism above is decoration.

  What neither may do is invent a meeting in somebody else's name:
  the insert check pins `created_by` to the caller.
*/
drop policy if exists meetings_read on meetings;
create policy meetings_read on meetings for select to authenticated
  using (created_by = auth.uid() or with_user = auth.uid());

drop policy if exists meetings_create on meetings;
create policy meetings_create on meetings for insert to authenticated
  with check (created_by = auth.uid() and with_user <> auth.uid());

drop policy if exists meetings_update on meetings;
create policy meetings_update on meetings for update to authenticated
  using (created_by = auth.uid() or with_user = auth.uid())
  with check (created_by = auth.uid() or with_user = auth.uid());

-- Only the person who called it may delete it outright, and only
-- while nobody has agreed to anything. After that it is cancelled,
-- not erased, so the other side can see what happened.
drop policy if exists meetings_delete on meetings;
create policy meetings_delete on meetings for delete to authenticated
  using (created_by = auth.uid() and status = 'proposed');

drop policy if exists meeting_proposals_rw on meeting_proposals;
create policy meeting_proposals_rw on meeting_proposals for all to authenticated
  using (is_meeting_participant(meeting_id))
  with check (is_meeting_participant(meeting_id) and proposed_by = auth.uid());

drop policy if exists meeting_agenda_read on meeting_agenda;
create policy meeting_agenda_read on meeting_agenda for select to authenticated
  using (is_meeting_participant(meeting_id));

/*
  Either party may add, reorder and tick off items — including ones
  the other person added. A shared agenda where only the author can
  move their own lines is not shared, it is two lists in a trench
  coat. Deleting is held to the author, because removing somebody
  else's point from the agenda is a different act from reordering
  it.
*/
drop policy if exists meeting_agenda_write on meeting_agenda;
create policy meeting_agenda_write on meeting_agenda for insert to authenticated
  with check (is_meeting_participant(meeting_id) and added_by = auth.uid());

drop policy if exists meeting_agenda_update on meeting_agenda;
create policy meeting_agenda_update on meeting_agenda for update to authenticated
  using (is_meeting_participant(meeting_id))
  with check (is_meeting_participant(meeting_id));

drop policy if exists meeting_agenda_delete on meeting_agenda;
create policy meeting_agenda_delete on meeting_agenda for delete to authenticated
  using (is_meeting_participant(meeting_id) and added_by = auth.uid());

drop policy if exists meeting_events_read on meeting_events;
create policy meeting_events_read on meeting_events for select to authenticated
  using (is_meeting_participant(meeting_id));

drop policy if exists meeting_events_write on meeting_events;
create policy meeting_events_write on meeting_events for insert to authenticated
  with check (is_meeting_participant(meeting_id) and actor_id = auth.uid());

-- ── 6 · grants ───────────────────────────────────────────────
-- Both PUBLIC and the named role, then grant back. A grant may come
-- from either and a revoke removes only the one it names — the trap
-- 0011, 0017, 0019 and 0003 each fell into.

revoke all on meetings          from anon; revoke all on meetings          from public;
revoke all on meeting_proposals from anon; revoke all on meeting_proposals from public;
revoke all on meeting_agenda    from anon; revoke all on meeting_agenda    from public;
revoke all on meeting_events    from anon; revoke all on meeting_events    from public;

grant select, insert, update, delete on meetings          to authenticated;
grant select, insert, update         on meeting_proposals to authenticated;
grant select, insert, update, delete on meeting_agenda    to authenticated;
-- No update, no delete: the history is append-only, and a grant is
-- a more honest way to say that than a comment.
grant select, insert                 on meeting_events    to authenticated;

revoke all on function is_meeting_participant(uuid) from anon;
revoke all on function is_meeting_participant(uuid) from public;
grant execute on function is_meeting_participant(uuid) to authenticated;

comment on table meetings is
  'One row, two readers. Never duplicated into each party''s calendar — that design drifts the moment somebody reschedules.';
comment on table meeting_proposals is
  'A new time is offered and accepted, never written directly, so nobody finds out a session moved by looking at it.';
comment on table meeting_agenda is
  'Shared and reorderable by both parties. An item can be a clip at a timestamp, which is what makes this a film session rather than a calendar invite.';
comment on table meeting_events is
  'Append-only history. Enforced by the absence of an update or delete grant, not by convention.';

notify pgrst, 'reload schema';
