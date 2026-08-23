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
