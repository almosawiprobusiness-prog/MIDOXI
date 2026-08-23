-- ============================================================
-- MIDO XI — 0016: reading the clip, not stills of it
--
-- Three changes, all additive.
--
-- 1. `clip_analyses.kind` gains 'video'. A read of the passage
--    itself is a different claim from a read of twelve stills:
--    it can see movement between moments, which stills by
--    definition cannot. It is still interpretation, and it is
--    still not tracking — the existing 'tracking' and 'events'
--    values keep that line where it was.
--
-- 2. `videos` remembers that a file has already been handed to
--    the video model, with an expiry. Without this a player
--    reading five passages from one match uploads it five times.
--
-- 3. `player_profiles.pitch_identity` — how to find this player
--    on the pitch, in their own words.
--
--    This is the single most important column in the migration
--    and it looks like the least. No model reliably identifies a
--    specific player in amateur footage: numbers are unreadable
--    at that resolution and re-identification across a possession
--    is unreliable. The player answering "number 9, blue, left
--    footed" is worth more than any amount of model capability,
--    and when it is absent the read is marked uncertain rather
--    than guessed.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · a fourth kind of analysis ────────────────────────────

alter table clip_analyses drop constraint if exists clip_analyses_kind_check;
alter table clip_analyses add constraint clip_analyses_kind_check
  check (kind in ('frames','video','tracking','events'));

comment on column clip_analyses.kind is
  'frames = sampled stills (interpretation, with gaps). video = the passage itself (interpretation, motion visible). tracking / events = measurement from a vendor. Never present one as another.';

-- Observations gained a `confidence` marker inside the jsonb —
-- observed / inferred / uncertain. It lives in the document
-- rather than in a column because it is per-observation, and
-- rows written before it existed are read as 'observed', which
-- is what they were.

-- ── 2 · the uploaded-file handle ─────────────────────────────

alter table videos add column if not exists ai_file_uri text;
alter table videos add column if not exists ai_file_mime text;
alter table videos add column if not exists ai_file_expires_at timestamptz;

comment on column videos.ai_file_expires_at is
  'When the provider drops the uploaded file. Anything at or past this is treated as absent and re-uploaded — a stale handle is a re-upload, not an error to recover from.';

-- ── 3 · who you are on the pitch ─────────────────────────────

alter table player_profiles add column if not exists pitch_identity text;

comment on column player_profiles.pitch_identity is
  'How to find this player in their own footage — kit colour, squad number, anything distinguishing. Written by the player. Passed to video reading; without it, identity-dependent observations come back marked uncertain rather than guessed.';
