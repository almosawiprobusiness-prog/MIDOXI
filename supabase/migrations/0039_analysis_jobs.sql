-- MIDO XI — 0039: film analysis jobs
--
-- The Vision pipeline's missing piece: video analysis used to live and
-- die inside one server request, which meant a refresh, a navigation
-- or a provider timeout lost the work and the player stared at a
-- spinner that owed them nothing. A job row is the truth the UI
-- renders: which windows of the video are read, which are pending,
-- which failed and how many times. Each advance of a job runs ONE
-- window (the measured sweet spot is 45-90s of film per read), safely
-- inside a function's time budget; the client polls and can leave.
--
-- `windows` carries the whole plan and its progress in one column:
--   [{ "from": 0, "to": 60, "status": "pending|done|failed",
--      "analysisId": "...", "attempts": 0, "error": "..." }]
-- Six windows maximum by product rule, so the jsonb stays a note, not
-- a database inside a column.

create table if not exists film_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  focus text not null default '',
  windows jsonb not null,
  state text not null default 'queued'
    check (state in ('queued','running','partial','complete','failed')),
  -- One creation per (user, plan). A double-tap or a retried request
  -- lands on the same row instead of paying twice.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists film_analysis_jobs_video_idx
  on film_analysis_jobs (video_id, created_at desc);

alter table film_analysis_jobs enable row level security;

create policy film_analysis_jobs_owner on film_analysis_jobs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The same lesson as 0022: a job table readable by anon is a map of
-- what everyone's film contains.
revoke all on film_analysis_jobs from anon;
revoke all on film_analysis_jobs from public;
grant select, insert, update, delete on film_analysis_jobs to authenticated;
