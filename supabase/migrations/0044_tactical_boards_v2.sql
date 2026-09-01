-- ============================================================
-- MIDO XI — 0044: the tactical board becomes infrastructure
--
-- Migration 0006 gave the coach a board: a title, a formation, a
-- phase, and a `board` jsonb holding {tokens, arrows, zones}. It
-- worked, and it is still on disk untouched by this file.
--
-- What it could not do is be used anywhere else. A board could be
-- attached to exactly one session plan, through a single nullable
-- `plan_id` column — one board, one target, no way to say WHICH
-- block of that session it illustrates, and no way for a trainer's
-- exercise, a player's development goal, an opposition report or a
-- study to reference the same idea. So the same football got drawn
-- again in each place, as disconnected copies.
--
-- This migration makes a board a first-class object.
--
-- ADDITIVE, AND REVERSIBLE BY NEGLECT. Every change is a new
-- column or a new table. `board` keeps its v1 contents and is
-- still written on every save (lib/tactics/document.ts projects
-- the new document back to it), so rolling the application back to
-- the previous deploy renders every board exactly as before. The
-- v2 document lives alongside in `doc`, and a row with no `doc`
-- yet is upgraded in memory on read — nothing is rewritten in
-- place, so no existing board can be damaged by this file.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the board becomes a document ---------------------

/*
  `doc` is the v2 structured document: pitch surface, frames, and
  within each frame the entities, paths, zones and annotations —
  each carrying its football meaning rather than only its shape. It
  is nullable on purpose: null means "this row predates v2, upgrade
  the v1 `board` when you read it".
*/
alter table tactical_boards add column if not exists doc jsonb;

/*
  What the board is FOR. A drill board is a setup to run; a tactical
  board is an idea to teach; a personal board is a player thinking
  out loud. Same object, different reading — by the interface and by
  MIDO.
*/
alter table tactical_boards add column if not exists kind text not null default 'tactical';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tactical_boards_kind_check'
  ) then
    alter table tactical_boards
      add constraint tactical_boards_kind_check
      check (kind in ('tactical', 'drill', 'personal', 'study'));
  end if;
end $$;

/* One sentence on what the board is trying to achieve. Read by MIDO
   and shown on the card; distinct from `notes`, which is free text. */
alter table tactical_boards add column if not exists objective text;

/* Categorisation the coach controls. Deliberately free-form tags
   rather than a fixed enum: "wide trap" and "third-man" are the
   coach's own vocabulary, and a closed list would force them into
   ours. The phase column keeps the four fixed moments. */
alter table tactical_boards add column if not exists tags text[] not null default '{}';

/*
  Keywords derived from the board's own contents by
  lib/tactics/describe.ts — press, wide, final third, 4-3-3.

  Stored rather than computed at query time so "use my wide pressing
  board" can be resolved without loading and parsing every document
  the user owns. Refreshed on every write.
*/
alter table tactical_boards add column if not exists keywords text[] not null default '{}';

/* Where it came from: manual, MIDO, duplicated, derived from a drill
   or an opposition report. Kept for honest attribution — a generated
   board must never be presented as one the coach drew. */
alter table tactical_boards add column if not exists origin jsonb not null default '{"source":"manual"}'::jsonb;

/* Ownership is `user_id`; this is the intent to share. Enforcement of
   anything beyond private is not built yet — see the note on RLS
   below — so the column records intent and nothing more. */
alter table tactical_boards add column if not exists visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tactical_boards_visibility_check'
  ) then
    alter table tactical_boards
      add constraint tactical_boards_visibility_check
      check (visibility in ('private', 'team', 'shared'));
  end if;
end $$;

/* Archive rather than delete: a board attached to a delivered session
   is part of that session's history. */
alter table tactical_boards add column if not exists archived_at timestamptz;

create index if not exists tactical_boards_kind_idx on tactical_boards (user_id, kind, updated_at desc);
create index if not exists tactical_boards_tags_idx on tactical_boards using gin (tags);
create index if not exists tactical_boards_keywords_idx on tactical_boards using gin (keywords);

comment on column tactical_boards.board is
  'LEGACY v1 {tokens, arrows, zones}. Still written on every save so an older deploy renders correctly. `doc` is the source of truth; see lib/tactics/document.ts.';
comment on column tactical_boards.doc is
  'The v2 tactical document: pitch, frames, and semantically-typed entities/paths/zones. Null on rows written before migration 0044, which are upgraded from `board` on read.';

-- ---------- what a board is attached to ----------------------

/*
  The relationship table, replacing 0006's single `plan_id` column.

  Polymorphic on purpose: a board attaches to a session block, an
  opposition report, a development goal, a study, a programme
  exercise. A foreign key per target would mean eleven nullable
  columns and a new migration every time the product grows a new
  place to think about football.

  `mode` is the versioning decision (and the reason this is not just
  a join table):

    reference — the live board. Edit it and every place it appears
                shows the change. Right while planning.

    snapshot  — the board frozen at attach time, stored in
                `snapshot`. Right for history: a session delivered in
                March must keep showing what was actually coached,
                not what the board became in June.
*/
create table if not exists board_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references tactical_boards(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  entity_type text not null check (entity_type in (
    'session_block', 'session_plan', 'opposition', 'development_goal',
    'study_session', 'match', 'program_exercise', 'program_session',
    'athlete', 'squad_player', 'capture'
  )),
  entity_id uuid not null,

  -- Why it is attached. The same board means different things in
  -- different places: the visual for a drill, the concept behind a
  -- goal, reference material, or something assigned to a person.
  role text not null default 'illustrates'
    check (role in ('illustrates', 'concept', 'reference', 'assigned')),

  mode text not null default 'reference' check (mode in ('reference', 'snapshot')),
  snapshot jsonb,

  position int not null default 0,
  created_at timestamptz not null default now(),

  -- The same board attached twice to the same thing for the same
  -- reason is a double-click, not an intention.
  constraint board_links_unique unique (board_id, entity_type, entity_id, role)
);

create index if not exists board_links_entity_idx on board_links (entity_type, entity_id, position);
create index if not exists board_links_board_idx on board_links (board_id);
create index if not exists board_links_user_idx on board_links (user_id, created_at desc);

comment on table board_links is
  'What a tactical board is attached to. Polymorphic (entity_type, entity_id). mode=reference follows the live board; mode=snapshot freezes it in `snapshot` so historical sessions stay historically accurate.';

-- ---------- RLS ----------------------------------------------

/*
  Owner-only, matching every other Coach OS table from 0006.

  Cross-account visibility — a coach assigning a board to a player —
  is deliberately NOT enabled here. It needs a policy that reads the
  coach_players / trainer_athletes bridge, and shipping a
  half-considered cross-user read policy on a table that will hold
  team tactics is precisely the kind of thing migration 0029 had to
  come back and clean up. `visibility` records the intent; the policy
  that honours it arrives with the assignment feature, not before it.
*/
alter table board_links enable row level security;

drop policy if exists board_links_owner on board_links;
create policy board_links_owner on board_links
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on board_links from anon, public;
grant select, insert, update, delete on board_links to authenticated;

notify pgrst, 'reload schema';
