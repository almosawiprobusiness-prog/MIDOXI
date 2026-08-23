-- ============================================================
-- MIDO XI — 0010: video analysis
--
-- Stores what an analysis pass produced about a stretch of film,
-- with the frames it actually looked at and the provider that
-- produced it.
--
-- The provider column matters: MIDO's own frame reader describes
-- what is visible in sampled frames, and that is a different kind
-- of claim from tracking data a computer-vision provider would
-- return. The two must never be presented as the same thing, so
-- the row records which one it was.
--
-- Safe to re-run.
-- ============================================================

create table if not exists clip_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  clip_id uuid references clips(id) on delete set null,

  -- Which analyser produced this, and with what model.
  provider text not null default 'mido-frames',
  model text,
  -- 'frames'  — read from sampled still frames (interpretation)
  -- 'tracking'— positional data from a computer-vision provider (measurement)
  -- 'events'  — event data (passes, shots) from a data provider
  kind text not null default 'frames' check (kind in ('frames','tracking','events')),

  from_seconds numeric not null default 0,
  to_seconds numeric not null default 0,
  frames_sampled int not null default 0,
  fps_sampled numeric,

  summary text,
  -- [{ atSeconds, title, body, kind }]
  observations jsonb not null default '[]'::jsonb,
  -- What the analysis was asked to look for.
  focus text,

  created_at timestamptz not null default now()
);

create index if not exists clip_analyses_video_idx on clip_analyses (video_id, created_at desc);

alter table clip_analyses enable row level security;

drop policy if exists clip_analyses_owner on clip_analyses;
create policy clip_analyses_owner on clip_analyses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A linked coach may read analyses of film belonging to a player who shares at
-- development level or above — the same rule the match log follows.
drop policy if exists clip_analyses_linked_coach on clip_analyses;
create policy clip_analyses_linked_coach on clip_analyses for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.coach_id = auth.uid()
      and cp.player_id = clip_analyses.user_id
      and cp.share_scope in ('development','full')
  ));
