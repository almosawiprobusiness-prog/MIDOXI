-- ============================================================
-- MIDO XI — Initial schema + Row Level Security
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Privacy model: everything is OWNER-ONLY by default (fails closed).
-- Coaches gain scoped read access only to players who have joined
-- one of their teams — never to arbitrary players, and never to a
-- player's private journals (check-ins, library, preferences).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- helpers ------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- NB: is_coached_by() is defined later, after the teams / team_memberships
-- tables it references exist (SQL function bodies are validated at creation).

-- ---------- identity -----------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player','coach')),
  full_name text,
  known_as text,
  avatar_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table player_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  date_of_birth date,
  nationality text,
  foot text check (foot in ('Right','Left','Both')),
  height_cm int,
  weight_kg int,
  primary_position text,
  secondary_position text,
  club text,
  league text,
  squad_number int,
  season text,
  level text,
  is_public boolean not null default false,
  bio text,
  updated_at timestamptz not null default now()
);

create table coach_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  club text,
  team text,
  coaching_role text,
  level text,
  formations text[],
  focus text,
  season text,
  updated_at timestamptz not null default now()
);

-- ---------- clubs / teams / seasons --------------------------

create table clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  club_id uuid references clubs(id) on delete set null,
  name text not null,
  level text,
  season text,
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','left')),
  shirt_number int,
  created_at timestamptz not null default now(),
  unique (team_id, player_id)
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  starts_on date,
  ends_on date
);

-- ---------- matches ------------------------------------------

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opponent text not null,
  competition text,
  played_at timestamptz not null,
  home boolean not null default true,
  goals_for int,
  goals_against int,
  formation text,
  position text,
  started boolean not null default true,
  minutes int,
  rating numeric(3,1) check (rating >= 0 and rating <= 10),
  goals int not null default 0,
  assists int not null default 0,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on matches (user_id, played_at desc);

-- Flexible per-position stat lines: fixed common columns + jsonb extras.
create table match_stats (
  match_id uuid primary key references matches(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shots int, shots_on_target int, touches int, passes int, pass_pct numeric,
  key_passes int, chances_created int, dribbles int, duels_won int, duels_total int,
  aerials_won int, recoveries int, interceptions int, tackles int,
  fouls_won int, fouls_committed int, offsides int,
  yellow int default 0, red int default 0,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table match_reviews (
  match_id uuid primary key references matches(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  did_well text, could_improve text, repeated text,
  best_decision text, moment_to_study text, into_training text,
  self_rating int check (self_rating between 1 and 10),
  confidence int check (confidence between 1 and 10),
  physical_feel int check (physical_feel between 1 and 5),
  mental_feel int check (mental_feel between 1 and 5),
  updated_at timestamptz not null default now()
);

-- ---------- film: videos / clips -----------------------------

create table videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  title text not null,
  storage_path text,          -- object-storage key (video NOT stored in DB)
  source text not null default 'upload' check (source in ('upload','youtube','url')),
  external_url text,
  thumbnail_url text,
  duration_seconds int,
  status text not null default 'ready' check (status in ('uploading','processing','ready','failed')),
  created_at timestamptz not null default now()
);

create table development_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('technical','tactical','physical','mental','positional')),
  title text not null,
  status text not null default 'active' check (status in ('active','monitoring','achieved')),
  why text,
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  goal_id uuid references development_goals(id) on delete set null,
  title text not null,
  start_seconds numeric not null default 0,   -- clip = interval reference into a video
  end_seconds numeric,
  sentiment text check (sentiment in ('positive','review','correction')),
  note text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index on clips (user_id, created_at desc);

create table clip_tags (
  clip_id uuid not null references clips(id) on delete cascade,
  tag text not null,
  primary key (clip_id, tag)
);

create table clip_notes (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at_seconds numeric,
  body text not null,
  created_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table collection_clips (
  collection_id uuid not null references collections(id) on delete cascade,
  clip_id uuid not null references clips(id) on delete cascade,
  primary key (collection_id, clip_id)
);

-- ---------- study --------------------------------------------

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid references development_goals(id) on delete set null,
  title text not null,
  source_kind text not null default 'youtube' check (source_kind in ('youtube','video','clip','url')),
  source_ref text,
  summary text,               -- USER notes / summary (AI summary stored separately)
  ai_summary text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table study_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references study_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at_seconds numeric,
  kind text not null default 'observation' check (kind in ('observation','principle','question','action')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Shared, cacheable external-content metadata (e.g. YouTube results).
create table saved_external_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default 'youtube',
  external_id text,
  url text not null,
  title text,
  channel text,
  thumbnail_url text,
  duration_seconds int,
  tags text[],
  created_at timestamptz not null default now()
);

-- ---------- training -----------------------------------------

create table drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  coaching_points text,
  created_at timestamptz not null default now()
);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('team','individual','gym','conditioning','speed','recovery','mobility','film','tactical','technical')),
  title text not null,
  scheduled_at timestamptz,
  duration_min int,
  objective text,
  created_at timestamptz not null default now()
);

create table training_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  drill_id uuid references drills(id) on delete set null,
  name text not null,
  duration_min int,
  reps int, sets int, distance text, rest text,
  notes text,
  position int not null default 0
);

create table training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid references training_sessions(id) on delete set null,
  logged_at timestamptz not null default now(),
  duration_min int,
  rpe int check (rpe between 1 and 10),
  physical_feel int check (physical_feel between 1 and 5),
  technical_feel int check (technical_feel between 1 and 5),
  improved text, felt_off text, discomfort text
);

-- ---------- development evidence -----------------------------

create table development_evidence (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references development_goals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match','film','insight','training','coach')),
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- daily / calendar / feedback ----------------------

create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  energy int check (energy between 1 and 5),
  soreness int check (soreness between 1 and 5),
  sleep int check (sleep between 1 and 5),
  mental int check (mental between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match','team','individual','gym','recovery','study','meeting','rest','tactical','conditioning','film')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  md_tag text,
  recurs text,
  ref_match uuid references matches(id) on delete set null,
  ref_session uuid references training_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on calendar_events (user_id, starts_at);

create table coach_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  clip_id uuid references clips(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, read, created_at desc);

create table user_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  theme text default 'dark',
  email_opt_in boolean not null default true,
  notif_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- billing + AI metering ----------------------------

create table subscription_plans (
  id text primary key,                       -- 'free' | 'pro_monthly' | 'pro_annual'
  name text not null,
  price_cents int not null default 0,
  interval text,                             -- 'month' | 'year' | null
  entitlements jsonb not null default '{}'::jsonb,  -- feature → monthly allowance
  active boolean not null default true
);

create table billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references subscription_plans(id),
  status text not null default 'inactive',   -- Stripe status is authoritative
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table usage_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  counters jsonb not null default '{}'::jsonb, -- feature → count used
  unique (user_id, period_start)
);

create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  estimated_cost_usd numeric(10,5) default 0,
  latency_ms int,
  status text not null default 'ok',
  cached boolean not null default false,
  created_at timestamptz not null default now()
);
create index on ai_usage_events (user_id, created_at desc);
create index on ai_usage_events (feature, created_at desc);

create table ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,                        -- 'study' | 'training' | 'insight'
  goal_id uuid references development_goals(id) on delete set null,
  payload jsonb not null,
  based_on jsonb,                            -- cited MIDO source data
  status text not null default 'new' check (status in ('new','saved','dismissed','applied')),
  created_at timestamptz not null default now()
);

create table ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

-- ---------- updated_at triggers ------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','matches','match_stats','match_reviews','development_goals','subscriptions'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------- new-user bootstrap -------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, known_as, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'known_as', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'player')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- reference data -----------------------------------

insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('free', 'MIDO XI', 0, null, '{}'::jsonb),
  ('pro_monthly', 'MIDO XI Pro', 1499, 'month',
    '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb),
  ('pro_annual', 'MIDO XI Pro (Annual)', 11900, 'year',
    '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb)
on conflict (id) do nothing;

-- ---------- coach ↔ player relationship helper ----------
-- Defined here (after teams / team_memberships exist) so the SQL body
-- validates. security definer lets RLS policies read across owners.
create or replace function public.is_coached_by(_player uuid, _coach uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1
    from team_memberships tm
    join teams t on t.id = tm.team_id
    where tm.player_id = _player
      and tm.status = 'active'
      and t.coach_id = _coach
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS everywhere.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','player_profiles','coach_profiles','clubs','teams','team_memberships',
    'seasons','matches','match_stats','match_reviews','videos','clips','clip_tags',
    'clip_notes','collections','collection_clips','study_sessions','study_notes',
    'saved_external_content','drills','training_sessions','training_blocks','training_logs',
    'development_goals','development_evidence','daily_checkins','calendar_events',
    'coach_feedback','notifications','user_preferences','subscription_plans',
    'billing_customers','subscriptions','usage_periods','ai_usage_events',
    'ai_recommendations','ai_sessions'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Owner-only CRUD for the straightforward user-owned tables.
do $$
declare t text;
begin
  foreach t in array array[
    'seasons','matches','match_stats','match_reviews','videos','clip_notes',
    'collections','study_sessions','study_notes','saved_external_content','drills',
    'training_sessions','training_logs','development_goals','development_evidence',
    'daily_checkins','calendar_events','notifications','ai_recommendations','ai_sessions'
  ] loop
    -- NB: 'clips' is intentionally excluded — it has a dedicated owner
    -- policy plus a coach-read policy defined below.
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- profiles: self read/write; a coach may read a joined player's profile.
create policy profiles_self on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_public_read on profiles for select to authenticated
  using (exists (select 1 from player_profiles p where p.user_id = profiles.id and p.is_public));
create policy profiles_coach_read on profiles for select to authenticated
  using (public.is_coached_by(profiles.id, auth.uid()));

-- player/coach detail rows: self, plus coach read of joined players.
create policy player_profiles_self on player_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy player_profiles_public on player_profiles for select to authenticated
  using (is_public);
create policy player_profiles_coach on player_profiles for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));

create policy coach_profiles_self on coach_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_preferences_self on user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- clubs / teams owned by the coach.
create policy clubs_owner on clubs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy teams_coach on teams for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
-- players may read teams they belong to.
create policy teams_member_read on teams for select to authenticated
  using (exists (select 1 from team_memberships tm
                 where tm.team_id = teams.id and tm.player_id = auth.uid()));

-- memberships: the coach who owns the team, or the player themselves.
create policy memberships_coach on team_memberships for all to authenticated
  using (exists (select 1 from teams t where t.id = team_id and t.coach_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_id and t.coach_id = auth.uid()));
create policy memberships_player on team_memberships for all to authenticated
  using (player_id = auth.uid()) with check (player_id = auth.uid());

-- Coach scoped READ of a joined player's review-relevant football data.
create policy matches_coach_read on matches for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));
create policy match_stats_coach_read on match_stats for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));
create policy dev_goals_coach_read on development_goals for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));
create policy clips_coach_read on clips for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));
create policy videos_coach_read on videos for select to authenticated
  using (public.is_coached_by(user_id, auth.uid()));

-- clips owner + child tables (clip_tags / collection_clips have no user_id;
-- gate them through the owned parent row).
create policy clips_owner on clips for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy clip_tags_owner on clip_tags for all to authenticated
  using (exists (select 1 from clips c where c.id = clip_id and c.user_id = auth.uid()))
  with check (exists (select 1 from clips c where c.id = clip_id and c.user_id = auth.uid()));
create policy collection_clips_owner on collection_clips for all to authenticated
  using (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy training_blocks_owner on training_blocks for all to authenticated
  using (exists (select 1 from training_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from training_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- coach_feedback: coach who wrote it, or the player it's about.
create policy coach_feedback_coach on coach_feedback for all to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy coach_feedback_player_read on coach_feedback for select to authenticated
  using (player_id = auth.uid());

-- billing: users read their own; writes happen via service role (webhooks).
create policy billing_customers_self on billing_customers for select to authenticated
  using (user_id = auth.uid());
create policy subscriptions_self on subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy usage_periods_self on usage_periods for select to authenticated
  using (user_id = auth.uid());
create policy ai_usage_self_read on ai_usage_events for select to authenticated
  using (user_id = auth.uid());

-- subscription_plans: readable by everyone (pricing).
create policy plans_read on subscription_plans for select to authenticated using (true);
