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
