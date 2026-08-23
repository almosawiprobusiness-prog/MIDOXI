-- ============================================================
-- MIDO XI — RUN NEXT: migrations 0005 → 0008
--
-- Everything built in phases 1, 3, 4, 5 and 6:
--   0005  four-role architecture + the Study Engine
--   0006  the Coach OS
--   0007  the Trainer OS
--   0008  the Club OS
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste this
--   whole file → Run. It takes a second or two.
--
-- SAFE TO RE-RUN. Every statement is idempotent: tables use
-- `create table if not exists`, columns use `add column if not
-- exists`, and policies are dropped before being recreated.
-- Nothing here drops a table or deletes a row.
--
-- The only changes to existing objects are additive:
--   • profiles.role accepts 'trainer' and 'club' as well as
--     'player' and 'coach'
--   • teams gains org_id, age_group, squad_size, and coach_id
--     becomes nullable so a club can own a team directly
--
-- A verification query at the end lists what was created.
-- ============================================================


-- ============================================================
-- >>> 0005_roles_intelligence.sql
-- ============================================================

-- ============================================================
-- MIDO XI — 0005: four-role architecture + the Study Engine
--
-- 1. Widens profiles.role to the four operating systems.
-- 2. Adds trainer / club profile rows and the organization layer
--    (organizations -> memberships -> teams) plus the explicit
--    coach->player and trainer->athlete relationship edges that
--    authorization depends on.
-- 3. Adds the Study Engine tables: a study is a persisted,
--    personalised lesson about a football person or concept, with
--    every block carrying its provenance (verified / analysis /
--    observation) so interpretation is never shown as fact.
--
-- Privacy model unchanged: owner-only by default, fail closed.
-- Safe to re-run.
-- ============================================================

-- ---------- 1. roles -----------------------------------------

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('player','coach','trainer','club'));

-- ---------- 2. role profiles ---------------------------------

create table if not exists trainer_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  practice text,                -- business / club they train under
  specialism text,              -- e.g. "Speed & power", "Return to play"
  qualifications text[],
  athlete_capacity int,
  bio text,
  updated_at timestamptz not null default now()
);

create table if not exists club_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  club_name text,
  level text,                   -- academy / semi-pro / professional
  country text,
  age_groups text[],
  bio text,
  updated_at timestamptz not null default now()
);

-- ---------- 3. organization layer ----------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  short_name text,
  country text,
  level text,
  crest_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_role text not null default 'staff' check (org_role in ('admin','coach','trainer','analyst','player','staff')),
  team_id uuid references teams(id) on delete set null,
  status text not null default 'active' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now()
);

-- One membership per person per team (a null team means org-wide).
create unique index if not exists org_memberships_unique
  on org_memberships (org_id, user_id, coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Explicit coaching relationships. A coach sees a player only through one of
-- these edges (or a shared team) — never the whole platform.
create table if not exists coach_players (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid references auth.users(id) on delete cascade,
  -- Unlinked players a coach manages manually until the player joins MIDO XI.
  display_name text,
  position text,
  squad_number int,
  status text not null default 'active' check (status in ('active','trial','injured','left')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists trainer_athletes (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  athlete_id uuid references auth.users(id) on delete cascade,
  display_name text,
  position text,
  date_of_birth date,
  objective text,
  limitations text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now()
);

-- ---------- 4. the Study Engine ------------------------------

-- A study the user has opened: "Study Harry Kane", "Study Pep Guardiola",
-- "Study pressing triggers". Subject metadata is denormalised so a study
-- stays readable even if the curated catalogue changes.
create table if not exists studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_slug text not null,
  subject_name text not null,
  subject_kind text not null check (subject_kind in ('player','coach','concept')),
  -- The lens the study was generated through.
  viewer_role text not null default 'player' check (viewer_role in ('player','coach','trainer','club')),
  viewer_position text,
  headline text,
  status text not null default 'active' check (status in ('active','completed','archived')),
  -- Which modules the reader has finished.
  completed_modules text[] not null default '{}',
  source text not null default 'curated' check (source in ('curated','ai','hybrid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studies_user_idx on studies (user_id, created_at desc);
create unique index if not exists studies_user_subject_idx on studies (user_id, subject_slug, viewer_role);

-- A generated module of a study (DNA, movement, finishing, match study...).
-- `provenance` is the truth model: verified facts, MIDO analysis, or the
-- user's own observation. The UI renders each differently.
create table if not exists study_modules (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  ordinal int not null default 0,
  provenance text not null default 'analysis' check (provenance in ('verified','analysis','observation')),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (study_id, key)
);

-- What the reader took from the study, and where it went in their system.
create table if not exists study_takeaways (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references studies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('note','training','goal','clip','quiz')),
  body text,
  -- Where this became real: a training session, a development goal, a clip.
  linked_table text,
  linked_id uuid,
  score int,
  created_at timestamptz not null default now()
);

create index if not exists study_takeaways_study_idx on study_takeaways (study_id, created_at desc);

-- ---------- 5. RLS -------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'trainer_profiles','club_profiles','organizations','org_memberships',
    'coach_players','trainer_athletes','studies','study_modules','study_takeaways'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Owner-keyed tables: straightforward user_id ownership.
do $$
declare t text;
begin
  foreach t in array array['studies','study_modules','study_takeaways'] loop
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

drop policy if exists trainer_profiles_self on trainer_profiles;
create policy trainer_profiles_self on trainer_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists club_profiles_self on club_profiles;
create policy club_profiles_self on club_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Organizations: the owner administers; members may read.
drop policy if exists organizations_owner on organizations;
create policy organizations_owner on organizations for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read on organizations for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = organizations.id and m.user_id = auth.uid() and m.status = 'active'
  ));

drop policy if exists org_memberships_admin on org_memberships;
create policy org_memberships_admin on org_memberships for all to authenticated
  using (exists (select 1 from organizations o where o.id = org_memberships.org_id and o.owner_id = auth.uid()))
  with check (exists (select 1 from organizations o where o.id = org_memberships.org_id and o.owner_id = auth.uid()));

drop policy if exists org_memberships_self_read on org_memberships;
create policy org_memberships_self_read on org_memberships for select to authenticated
  using (user_id = auth.uid());

-- Relationship edges: the professional owns the row; the person on the other
-- side may read the row that names them.
drop policy if exists coach_players_coach on coach_players;
create policy coach_players_coach on coach_players for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists coach_players_player_read on coach_players;
create policy coach_players_player_read on coach_players for select to authenticated
  using (player_id = auth.uid());

drop policy if exists trainer_athletes_trainer on trainer_athletes;
create policy trainer_athletes_trainer on trainer_athletes for all to authenticated
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists trainer_athletes_athlete_read on trainer_athletes;
create policy trainer_athletes_athlete_read on trainer_athletes for select to authenticated
  using (athlete_id = auth.uid());

-- ---------- 6. updated_at triggers ---------------------------

do $$
declare t text;
begin
  foreach t in array array['trainer_profiles','club_profiles','organizations','studies'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on %1$s;', t);
    execute format(
      'create trigger set_updated_at_%1$s before update on %1$s for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ============================================================
-- >>> 0006_coach_os.sql
-- ============================================================

-- ============================================================
-- MIDO XI — 0006: the Coach operating system
--
-- Adds the four coach surfaces on top of the squad relationship
-- created in 0005:
--
--   session_plans / session_blocks  the training week
--   tactical_boards                 drawn ideas, saved and reusable
--   opposition_reports              recorded scouting + the match plan
--   coach_player_notes              a player's development history
--
-- A coach plan is deliberately separate from `training_sessions`
-- (which is a player's own log of work they did). Same idea, two
-- different owners and two different lifecycles.
--
-- Privacy model unchanged: owner-only, fails closed. Players read
-- only the notes written about them.
-- Safe to re-run.
-- ============================================================

-- ---------- session planner ----------------------------------

create table if not exists session_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  title text not null,
  scheduled_at timestamptz,
  duration_min int,
  objective text,
  players_count int,
  pitch text,                    -- e.g. "Half pitch", "40x30"
  intensity text check (intensity is null or intensity in ('low','moderate','high')),
  status text not null default 'draft' check (status in ('draft','planned','delivered')),
  -- Where the plan came from, so generated work is never shown as authored.
  source text not null default 'coach' check (source in ('coach','mido','study')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_plans_user_idx on session_plans (user_id, scheduled_at desc);

create table if not exists session_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references session_plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phase text not null default 'technical' check (phase in
    ('warmup','technical','tactical','possession','conditioned-game','match-scenario','set-piece','cooldown')),
  name text not null,
  duration_min int,
  organisation text,             -- setup: area, players, rules
  coaching_points text[],
  progression text,
  regression text,
  position int not null default 0
);

create index if not exists session_blocks_plan_idx on session_blocks (plan_id, position);

-- ---------- tactical board -----------------------------------

create table if not exists tactical_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  formation text,
  phase text not null default 'in-possession' check (phase in
    ('in-possession','out-of-possession','transition','set-piece')),
  -- The drawing itself: tokens, arrows, zones and labels as normalised
  -- 0-100 pitch coordinates, so a board renders at any size.
  board jsonb not null default '{}'::jsonb,
  notes text,
  plan_id uuid references session_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tactical_boards_user_idx on tactical_boards (user_id, updated_at desc);

-- ---------- opposition ---------------------------------------

create table if not exists opposition_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opponent text not null,
  competition text,
  match_date date,
  home boolean,
  formation text,
  -- Everything below is what the COACH recorded. MIDO may interpret it;
  -- it may never invent it.
  key_players jsonb not null default '[]'::jsonb,
  in_possession text[],
  out_of_possession text[],
  transition text[],
  set_pieces text[],
  weaknesses text[],
  notes text,
  -- The generated match plan, kept separate from the observations it came from.
  plan jsonb,
  plan_source text check (plan_source is null or plan_source in ('coach','mido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opposition_reports_user_idx on opposition_reports (user_id, match_date desc);

-- ---------- player development notes -------------------------

create table if not exists coach_player_notes (
  id uuid primary key default gen_random_uuid(),
  squad_player_id uuid not null references coach_players(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'note' check (kind in ('focus','performance','note','session','match')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_player_notes_player_idx on coach_player_notes (squad_player_id, created_at desc);

-- ---------- RLS ----------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'session_plans','session_blocks','tactical_boards','opposition_reports','coach_player_notes'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- A player may read the notes their coach wrote about them.
drop policy if exists coach_player_notes_player_read on coach_player_notes;
create policy coach_player_notes_player_read on coach_player_notes for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.id = coach_player_notes.squad_player_id and cp.player_id = auth.uid()
  ));

-- ---------- updated_at triggers ------------------------------

do $$
declare t text;
begin
  foreach t in array array['session_plans','tactical_boards','opposition_reports'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on %1$s;', t);
    execute format(
      'create trigger set_updated_at_%1$s before update on %1$s for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ============================================================
-- >>> 0007_trainer_os.sql
-- ============================================================

-- ============================================================
-- MIDO XI — 0007: the Trainer operating system
--
-- Builds on trainer_athletes (0005) with the three things a
-- performance trainer actually works in:
--
--   programs / program_sessions / program_exercises
--       multi-week blocks, the sessions inside them, and the
--       prescriptions inside those
--   assessments
--       test results over time — the only honest way to show
--       that a block worked
--   athlete_notes
--       limitations, flags and observations, dated
--
-- Owner-only RLS throughout; a linked athlete may read what has
-- been written about them and the programs assigned to them.
-- Safe to re-run.
-- ============================================================

-- ---------- programs -----------------------------------------

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  athlete_id uuid references trainer_athletes(id) on delete cascade,
  title text not null,
  objective text,
  -- Curated quality slugs from lib/knowledge/physical.ts.
  qualities text[] not null default '{}',
  weeks int not null default 4 check (weeks between 1 and 24),
  sessions_per_week int not null default 2 check (sessions_per_week between 1 and 7),
  starts_on date,
  status text not null default 'draft' check (status in ('draft','active','completed','paused')),
  source text not null default 'trainer' check (source in ('trainer','mido','library')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_user_idx on programs (user_id, created_at desc);
create index if not exists programs_athlete_idx on programs (athlete_id);

create table if not exists program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week int not null default 1,
  day int not null default 1,
  title text not null,
  focus text,
  -- Relative load for the week, so a block reads as a wave rather than a list.
  intent text check (intent is null or intent in ('build','hold','deload','test')),
  notes text,
  completed_at timestamptz,
  position int not null default 0
);

create index if not exists program_sessions_program_idx on program_sessions (program_id, week, day);

create table if not exists program_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references program_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  prescription text,            -- "4 x 5 @ 80% · 3 min rest"
  cue text,
  slot text not null default 'primary' check (slot in
    ('prep','primary','secondary','accessory','conditioning','recovery')),
  position int not null default 0
);

create index if not exists program_exercises_session_idx on program_exercises (session_id, position);

-- ---------- assessments --------------------------------------

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  athlete_id uuid not null references trainer_athletes(id) on delete cascade,
  -- Curated test id from lib/knowledge/physical.ts.
  test text not null,
  value numeric not null,
  unit text not null,
  -- Left/right where a test is sided; null when it is not.
  side text check (side is null or side in ('left','right')),
  tested_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists assessments_athlete_idx on assessments (athlete_id, test, tested_on desc);

-- ---------- athlete notes ------------------------------------

create table if not exists athlete_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references trainer_athletes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'note' check (kind in ('objective','limitation','flag','session','note')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists athlete_notes_athlete_idx on athlete_notes (athlete_id, created_at desc);

-- ---------- RLS ----------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'programs','program_sessions','program_exercises','assessments','athlete_notes'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- A linked athlete may read their own record: notes, assessments and programs.
drop policy if exists athlete_notes_athlete_read on athlete_notes;
create policy athlete_notes_athlete_read on athlete_notes for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.id = athlete_notes.athlete_id and ta.athlete_id = auth.uid()
  ));

drop policy if exists assessments_athlete_read on assessments;
create policy assessments_athlete_read on assessments for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.id = assessments.athlete_id and ta.athlete_id = auth.uid()
  ));

drop policy if exists programs_athlete_read on programs;
create policy programs_athlete_read on programs for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.id = programs.athlete_id and ta.athlete_id = auth.uid()
  ));

-- ---------- updated_at ---------------------------------------

drop trigger if exists set_updated_at_programs on programs;
create trigger set_updated_at_programs before update on programs
  for each row execute function public.set_updated_at();

-- ============================================================
-- >>> 0008_club_os.sql
-- ============================================================

-- ============================================================
-- MIDO XI — 0008: the Club operating system
--
-- The organizational layer on top of organizations / org_memberships (0005):
--
--   teams.org_id, age_group, squad_size
--       teams belong to the organization, with the age group and
--       the squad size the club maintains
--   org_staff
--       coaches, trainers and analysts as club records — linked
--       to a MIDO XI account when they join, working before that
--   club_methodology
--       HOW WE PLAY / HOW WE TRAIN / HOW WE DEVELOP, in sections.
--       This is the differentiator: once written, it becomes the
--       context MIDO answers inside for everyone in the club.
--
-- Owner-administers, members read. Safe to re-run.
-- ============================================================

-- ---------- teams under an organization ----------------------

alter table teams add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table teams add column if not exists age_group text;
alter table teams add column if not exists squad_size int;
-- A team created by a club has no individual coach owner.
alter table teams alter column coach_id drop not null;

create index if not exists teams_org_idx on teams (org_id);

-- ---------- staff --------------------------------------------

create table if not exists org_staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Set when the staff member joins with their own MIDO XI account.
  member_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  staff_role text not null default 'coach' check (staff_role in
    ('admin','head-coach','coach','trainer','analyst','physio','scout','staff')),
  team_id uuid references teams(id) on delete set null,
  status text not null default 'recorded' check (status in ('recorded','invited','active','left')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists org_staff_org_idx on org_staff (org_id);

-- ---------- methodology --------------------------------------

create table if not exists club_methodology (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc text not null check (doc in ('play','train','develop')),
  -- e.g. "Build-up", "Pressing", "U15-U16" — the club's own headings.
  section text not null,
  -- The principles themselves. One per line in the UI, an array here.
  principles text[] not null default '{}',
  detail text,
  -- Age band, when a development framework is age-specific.
  age_group text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_methodology_org_idx on club_methodology (org_id, doc, position);

-- ---------- RLS ----------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['org_staff','club_methodology'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Anyone active in the organization may read its staff list and its
-- methodology — that is the whole point of writing it down.
drop policy if exists org_staff_member_read on org_staff;
create policy org_staff_member_read on org_staff for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = org_staff.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

drop policy if exists club_methodology_member_read on club_methodology;
create policy club_methodology_member_read on club_methodology for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = club_methodology.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

-- Teams: the organization owner administers; org members read.
drop policy if exists teams_org_owner on teams;
create policy teams_org_owner on teams for all to authenticated
  using (exists (select 1 from organizations o where o.id = teams.org_id and o.owner_id = auth.uid()))
  with check (exists (select 1 from organizations o where o.id = teams.org_id and o.owner_id = auth.uid()));

drop policy if exists teams_org_member_read on teams;
create policy teams_org_member_read on teams for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = teams.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

-- ---------- updated_at ---------------------------------------

drop trigger if exists set_updated_at_club_methodology on club_methodology;
create trigger set_updated_at_club_methodology before update on club_methodology
  for each row execute function public.set_updated_at();

-- ============================================================
-- VERIFY — every row below should say 'created'
-- ============================================================

select
  t.name as object,
  case when to_regclass('public.' || t.name) is not null then 'created' else 'MISSING' end as status
from (values
  ('trainer_profiles'), ('club_profiles'), ('organizations'), ('org_memberships'),
  ('coach_players'), ('trainer_athletes'), ('studies'), ('study_modules'), ('study_takeaways'),
  ('session_plans'), ('session_blocks'), ('tactical_boards'), ('opposition_reports'),
  ('coach_player_notes'), ('programs'), ('program_sessions'), ('program_exercises'),
  ('assessments'), ('athlete_notes'), ('org_staff'), ('club_methodology')
) as t(name)
order by 2 desc, 1;
