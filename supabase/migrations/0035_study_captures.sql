/*
  0035 — Study captures: the MIDO XI Capture extension's one table.

  A capture is a single observed moment in someone else's football — a
  YouTube video, a timestamp, and what the player noticed there. It is
  deliberately NOT a study session: a session is a sitting, planned and
  completed; a capture is a drive-by, made in the five seconds between
  noticing something and pressing play again. Forcing every capture to
  open a session would make the cheap thing expensive, which is the one
  failure mode the extension exists to avoid.

  It still speaks the same language as the rest of the schema:
    · goal_id   — a capture can stand as study evidence on a development
                  goal, the way film and insights already do
    · study_id  — a capture can later be pulled into a real study
                  session; the column exists so that connection is a
                  one-column update, not a copy

  The video's identity is stored denormalised (id, url, title, channel,
  thumbnail) rather than through the `videos` table, because captures
  reference football the player does not own and will never upload. A
  `videos` row implies the film room; a capture implies someone else's
  match. Joining the two would put every passing YouTube video into the
  player's film library.
*/

create table if not exists study_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- Source. YouTube-only in V1; the check constraint is the contract.
  source_type text not null default 'youtube' check (source_type in ('youtube')),
  video_id text not null check (char_length(video_id) = 11),
  source_url text not null check (char_length(source_url) <= 500),
  video_title text not null check (char_length(video_title) between 1 and 300),
  channel_name text check (char_length(channel_name) <= 200),
  thumbnail_url text check (char_length(thumbnail_url) <= 500),

  -- The moment. Stored numerically; formatting is a display concern.
  timestamp_seconds numeric not null check (timestamp_seconds >= 0 and timestamp_seconds <= 43200),

  -- What the player noticed. The point of the whole table.
  observation text not null check (char_length(observation) between 1 and 1000),

  -- Optional football category — the extension's quick taxonomy.
  category text check (category in (
    'movement','finishing','receiving','scanning','passing','creation',
    'pressing','defending','positioning','transitions','set_pieces',
    'goalkeeping','tactical','mentality','other'
  )),

  -- Optional connections into the development loop.
  goal_id uuid references development_goals(id) on delete set null,
  study_id uuid references study_sessions(id) on delete set null,

  origin text not null default 'chrome_extension' check (origin in ('chrome_extension','web')),

  /*
    Client idempotency. The extension generates one key per capture
    attempt; a retry after a timeout or a double-click lands on the
    unique index below and is a no-op instead of a duplicate moment.
  */
  client_key text check (char_length(client_key) <= 64),

  created_at timestamptz not null default now()
);

create index if not exists study_captures_owner_time_idx
  on study_captures (user_id, created_at desc);

create index if not exists study_captures_goal_idx
  on study_captures (goal_id, created_at desc)
  where goal_id is not null;

create unique index if not exists study_captures_client_key_idx
  on study_captures (user_id, client_key)
  where client_key is not null;

alter table study_captures enable row level security;

-- Owner-only, all four verbs: a capture is the player's own study
-- record. Update stays open (unlike the event log) because connecting
-- an old capture to a new goal is an edit, not a falsification.
drop policy if exists study_captures_owner_read on study_captures;
create policy study_captures_owner_read on study_captures for select to authenticated
  using (user_id = auth.uid());

drop policy if exists study_captures_owner_insert on study_captures;
create policy study_captures_owner_insert on study_captures for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists study_captures_owner_update on study_captures;
create policy study_captures_owner_update on study_captures for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists study_captures_owner_delete on study_captures;
create policy study_captures_owner_delete on study_captures for delete to authenticated
  using (user_id = auth.uid());

-- anon, public AND authenticated, then grant back exactly what is
-- needed — the 0011/0017/0019/0003/0024/0027/0030 trap, avoided by
-- naming all three every time.
revoke all on study_captures from anon, public, authenticated;
grant select, insert, update, delete on study_captures to authenticated;

comment on table study_captures is
  'Moments a player noticed while watching football elsewhere (YouTube), captured by the MIDO XI Capture extension: a video, a timestamp, an observation, and optional connections to a development goal or study session. Owner-only.';

notify pgrst, 'reload schema';
