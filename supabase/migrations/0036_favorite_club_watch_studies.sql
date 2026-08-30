-- ============================================================
-- MIDO XI — 0036: the favorite club, and watch studies
--
-- Two small changes with one purpose: turning the football a player
-- already watches into structured study.
--
--   1. `player_profiles.favorite_club` — the club they support and
--      study. Free text, same reasoning as `club`: no dataset covers
--      every club a person can love, and refusing one because a list
--      is missing it would be the list's failure, not theirs.
--
--   2. `study_sessions.source_kind` learns 'watch' — a study session
--      whose source is a live match the player watched, not a video
--      in the library. Same table, same notes, same completion flow,
--      same insight-evidence path; only the source differs.
--
-- Consumers fail soft until this runs, per the house rule.
-- ============================================================

alter table player_profiles
  add column if not exists favorite_club text;

comment on column player_profiles.favorite_club is
  'The club this player supports and studies. Fixture watching becomes structured study through it. Free text on purpose.';

-- Widen the source_kind vocabulary. The constraint is dropped by name
-- and restated in full — a second constraint with a new name would
-- leave the old one standing and every 'watch' insert failing.
alter table study_sessions
  drop constraint if exists study_sessions_source_kind_check;
alter table study_sessions
  add constraint study_sessions_source_kind_check
  check (source_kind in ('youtube','video','clip','url','watch'));
