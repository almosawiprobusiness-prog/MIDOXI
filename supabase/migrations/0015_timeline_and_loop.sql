-- ============================================================
-- MIDO XI — 0015: the player timeline, and closing the loop
--
-- Two things, and they belong together.
--
-- 1. `player_timeline` — one chronological spine over the tables
--    that already exist. It is a VIEW, not a table: there is no
--    write path, no sync job, and therefore no way for it to
--    disagree with the data it reads. If it gets slow at volume,
--    materialise it then.
--
-- 2. Two columns on `development_evidence` so a piece of film
--    evidence remembers WHICH moment and WHICH concept it came
--    from. That is the whole of the closed loop: an observation
--    on a clip becomes evidence against a goal, and the next
--    analysis can be told what was already seen.
--
-- SECURITY: the view is created with `security_invoker = true`.
-- Without it a Postgres view runs as its owner and would hand
-- every row of every table to anyone who selected from it. RLS
-- on the underlying tables is what protects this, and
-- security_invoker is what keeps RLS in play.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · Evidence remembers where it came from ────────────────

-- Which curated concept this evidence is about. Nullable: most
-- evidence is written by hand and maps to nothing in the graph.
alter table development_evidence add column if not exists concept text;

-- The second in the film this came from, for film evidence.
alter table development_evidence add column if not exists at_seconds numeric;

-- What produced the row. 'self' is a player writing it; 'mido' is
-- a suggestion the player CONFIRMED — never one MIDO made alone.
-- An unconfirmed suggestion is not evidence and is not stored here.
alter table development_evidence add column if not exists source text
  not null default 'self';

do $$ begin
  alter table development_evidence
    add constraint development_evidence_source_check
    check (source in ('self','mido'));
exception when duplicate_object then null;
end $$;

comment on column development_evidence.source is
  'self = the player wrote it. mido = MIDO proposed it and the player confirmed. Never set to mido without confirmation.';

create index if not exists development_evidence_concept_idx
  on development_evidence (user_id, concept)
  where concept is not null;

-- ── 2 · Indexes the timeline reads through ───────────────────
-- Every contributing table gets (user_id, <time>) so the union
-- below is a set of index scans rather than a set of seq scans.

create index if not exists matches_user_played_idx        on matches (user_id, played_at desc);
create index if not exists training_user_time_idx         on training_sessions (user_id, (coalesce(scheduled_at, created_at)) desc);
create index if not exists checkins_user_date_idx         on daily_checkins (user_id, checkin_date desc);
create index if not exists clips_user_created_idx         on clips (user_id, created_at desc);
create index if not exists clip_analyses_user_created_idx on clip_analyses (user_id, created_at desc);
create index if not exists studies_user_created_idx       on studies (user_id, created_at desc);
create index if not exists study_sessions_user_created_idx on study_sessions (user_id, created_at desc);
create index if not exists dev_goals_user_created_idx     on development_goals (user_id, created_at desc);
create index if not exists dev_evidence_user_created_idx  on development_evidence (user_id, created_at desc);
create index if not exists coach_feedback_player_idx      on coach_feedback (player_id, created_at desc);

-- ── 3 · The timeline ─────────────────────────────────────────
--
-- Columns are deliberately uniform so the UI renders one row type:
--
--   occurred_at  when it happened — NOT when it was typed
--   kind         what sort of thing it was
--   ref_id       the row it came from, for linking
--   title        the headline
--   summary      one line under it, or null
--   meta         everything else, as jsonb, read only by the
--                renderer for that kind
--
-- A note on `occurred_at`: a match uses `played_at`, a training
-- session uses its scheduled time, a check-in uses its date. Rows
-- entered late therefore land where they belong in the record
-- rather than on the day someone got round to typing them.

drop view if exists player_timeline;

create view player_timeline
with (security_invoker = true)
as

-- Matches
select
  m.user_id,
  m.played_at                                     as occurred_at,
  'match'::text                                   as kind,
  m.id                                            as ref_id,
  (case when m.home then 'vs ' else 'away to ' end || m.opponent) as title,
  nullif(concat_ws(' · ',
    nullif(m.competition, ''),
    case when m.goals_for is not null and m.goals_against is not null
         then m.goals_for || '–' || m.goals_against end,
    case when m.minutes is not null then m.minutes || ' min' end
  ), '')                                          as summary,
  jsonb_strip_nulls(jsonb_build_object(
    'minutes', m.minutes, 'goals', m.goals, 'assists', m.assists,
    'rating', m.rating, 'position', m.position, 'started', m.started,
    'competition', m.competition, 'reviewed', m.reviewed
  ))                                              as meta
from matches m

union all

-- Training
select
  t.user_id,
  coalesce(t.scheduled_at, t.created_at),
  'training',
  t.id,
  t.title,
  nullif(concat_ws(' · ',
    t.kind,
    case when t.duration_min is not null then t.duration_min || ' min' end,
    nullif(t.objective, '')
  ), ''),
  jsonb_strip_nulls(jsonb_build_object(
    'sessionKind', t.kind, 'durationMin', t.duration_min, 'objective', t.objective
  ))
from training_sessions t

union all

-- Daily check-ins. Readiness is computed in one place — lib/data/
-- recovery-types.ts — so the view carries the four scores and lets
-- the app do the arithmetic rather than having two definitions.
--
-- Midday, not midnight. A check-in has a DATE and no time, and
-- casting the date to a timestamp puts it at 00:00 — which lands
-- on the previous day for any reader west of the database's
-- timezone, so a Thursday check-in appears under Wednesday.
-- Midday is far enough from both boundaries that no real offset
-- moves it. The UI does not print a time for these rows, because
-- this one is manufactured and a player never chose it.
select
  c.user_id,
  (c.checkin_date + interval '12 hours')::timestamptz,
  'checkin',
  c.id,
  'Check-in',
  nullif(c.note, ''),
  jsonb_strip_nulls(jsonb_build_object(
    'energy', c.energy, 'soreness', c.soreness,
    'sleep', c.sleep, 'mental', c.mental
  ))
from daily_checkins c

union all

-- Clips kept
select
  cl.user_id,
  cl.created_at,
  'clip',
  cl.id,
  cl.title,
  nullif(cl.note, ''),
  jsonb_strip_nulls(jsonb_build_object(
    'videoId', cl.video_id, 'matchId', cl.match_id, 'goalId', cl.goal_id,
    'startSeconds', cl.start_seconds, 'sentiment', cl.sentiment,
    'favorite', cl.favorite
  ))
from clips cl

union all

-- Film analyses. One row per analysis, not per observation: a
-- reading is one event, and the observations are its contents.
select
  a.user_id,
  a.created_at,
  'analysis',
  a.id,
  coalesce(nullif(a.focus, ''), 'Film read'),
  nullif(a.summary, ''),
  jsonb_strip_nulls(jsonb_build_object(
    'videoId', a.video_id, 'provider', a.provider, 'analysisKind', a.kind,
    'fromSeconds', a.from_seconds, 'toSeconds', a.to_seconds,
    'observationCount', jsonb_array_length(coalesce(a.observations, '[]'::jsonb))
  ))
from clip_analyses a

union all

-- Studies started
select
  s.user_id,
  s.created_at,
  'study',
  s.id,
  s.subject_name,
  nullif(s.headline, ''),
  jsonb_strip_nulls(jsonb_build_object(
    'subjectSlug', s.subject_slug, 'subjectKind', s.subject_kind,
    'status', s.status, 'source', s.source,
    'modulesDone', coalesce(array_length(s.completed_modules, 1), 0)
  ))
from studies s

union all

-- Study sessions logged against film
select
  ss.user_id,
  ss.created_at,
  'study_session',
  ss.id,
  ss.title,
  nullif(ss.summary, ''),
  jsonb_strip_nulls(jsonb_build_object(
    'sourceKind', ss.source_kind, 'completed', ss.completed, 'goalId', ss.goal_id
  ))
from study_sessions ss

union all

-- Goals set
select
  g.user_id,
  g.created_at,
  'goal_set',
  g.id,
  g.title,
  nullif(g.why, ''),
  jsonb_build_object('category', g.category, 'progress', g.progress)
from development_goals g

union all

-- Goals reached. `updated_at` is the best available answer for
-- when it was achieved; the schema does not record the moment
-- separately, and inventing one would be worse than approximating.
select
  g.user_id,
  g.updated_at,
  'goal_reached',
  g.id,
  g.title,
  'Marked achieved',
  jsonb_build_object('category', g.category, 'approximate', true)
from development_goals g
where g.status = 'achieved'

union all

-- Evidence attached to a goal
select
  e.user_id,
  e.created_at,
  'evidence',
  e.id,
  coalesce(nullif(e.note, ''), 'Evidence added'),
  null,
  jsonb_strip_nulls(jsonb_build_object(
    'goalId', e.goal_id, 'evidenceKind', e.kind, 'concept', e.concept,
    'atSeconds', e.at_seconds, 'source', e.source, 'refId', e.ref_id
  ))
from development_evidence e

union all

-- Coach feedback received. Note the user_id: this row belongs to
-- the PLAYER's timeline, so it is keyed on player_id, and the
-- coach's own RLS is irrelevant to whether the player sees it.
select
  f.player_id,
  f.created_at,
  'feedback',
  f.id,
  'Coach feedback',
  f.body,
  jsonb_strip_nulls(jsonb_build_object('matchId', f.match_id, 'clipId', f.clip_id))
from coach_feedback f;

comment on view player_timeline is
  'Chronological spine of one player''s football record. A view over existing tables — never written to. security_invoker=true so RLS on the underlying tables applies to whoever selects.';

-- The view inherits RLS from its tables, but the grant still has
-- to be explicit.
--
-- NOTE: the revoke below is NOT sufficient on Supabase, and 0017
-- is the fix. Supabase's default privileges grant `anon` a direct
-- SELECT by name, and revoking from PUBLIC does not remove a
-- named-role grant. Left here as written so the two files read in
-- order; run 0017 as well.
revoke all on player_timeline from public;
grant select on player_timeline to authenticated;

/*
  If /app/timeline reports that the view does not exist immediately after
  running this, PostgREST is still holding the old schema. It normally reloads
  itself on DDL; this asks it to, and is harmless if it already has.
*/
notify pgrst, 'reload schema';
