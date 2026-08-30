-- ============================================================
-- MIDO XI — 0038: captures from any streaming site
--
-- 0035 said it plainly: "YouTube-only in V1; the check constraint is
-- the contract." This is V2 of that contract. The extension can now
-- capture from any page with an HTML5 player — sport.video, Veo,
-- Hudl, a club stream — and those captures carry:
--
--   source_type 'web'
--   video_id    'web-' + 16 hex, the FNV-1a hash of the page URL,
--               recomputed server-side so id and URL must agree
--               (the same binding YouTube captures already have)
--
-- Constraints are dropped by name and restated in full, as always.
-- ============================================================

alter table study_captures
  drop constraint if exists study_captures_source_type_check;
alter table study_captures
  add constraint study_captures_source_type_check
  check (source_type in ('youtube','web'));

-- 11 chars exactly was the YouTube id; 'web-'+16 hex is 20. The check
-- names both shapes rather than a loose length, so a third shape still
-- has to arrive through a migration and not through drift.
alter table study_captures
  drop constraint if exists study_captures_video_id_check;
alter table study_captures
  add constraint study_captures_video_id_check
  check (char_length(video_id) = 11 or video_id ~ '^web-[0-9a-f]{16}$');
