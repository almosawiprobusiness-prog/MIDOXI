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
