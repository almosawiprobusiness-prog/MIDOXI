-- ============================================================
-- MIDO XI — 0041: vision accuracy
--
-- Three families of additions, all serving the same rule: MIDO
-- must identify the player before attributing actions, and every
-- read must be auditable later.
--
-- 1 · clip_analyses learns what produced it (model was already
--     there; depth, prompt version and source kind were not) and
--     what the identification audit found — which used to be
--     computed, used for the confidence ceiling, and thrown away.
--     Plus the correction: a player can mark a read as following
--     the wrong player, and that verdict outranks the model's.
--
-- 2 · videos can carry a per-match identity override — kits
--     change between fixtures and a global profile string cannot
--     know that.
--
-- 3 · player_profiles grows the structured half of pitch
--     identity: kit colours and team side, alongside the free
--     "how to spot you" note that already existed (0016). The
--     prompt string is composed from the parts in code.
--
-- Follows 0023's conventions. Safe to re-run.
-- ============================================================

-- ── 1 · the read's provenance and identification ─────────────

alter table clip_analyses add column if not exists depth text;
alter table clip_analyses add column if not exists prompt_version int;
alter table clip_analyses add column if not exists source_kind text;
alter table clip_analyses add column if not exists identity_level text;
alter table clip_analyses add column if not exists identity_basis text;
alter table clip_analyses add column if not exists identity_could_match int;
alter table clip_analyses add column if not exists squad_number_legible boolean;
alter table clip_analyses add column if not exists identity_rejected boolean not null default false;

do $$ begin
  alter table clip_analyses
    add constraint clip_analyses_depth_check
    check (depth is null or depth in ('quick','deep'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table clip_analyses
    add constraint clip_analyses_identity_level_check
    check (identity_level is null or identity_level in ('high','moderate','low','none'));
exception when duplicate_object then null;
end $$;

comment on column clip_analyses.identity_rejected is
  'The player said this read followed the wrong player. Their verdict outranks the model''s: a rejected read is excluded from prior-observation context and shown as corrected.';
comment on column clip_analyses.identity_level is
  'Computed in code from the model''s identification audit (basis / couldMatchOthers / squadNumberLegible) — never taken from model confidence.';

-- ── 2 · per-match identity ───────────────────────────────────

alter table videos add column if not exists pitch_identity_override text;

comment on column videos.pitch_identity_override is
  'This match''s "how to spot you", when it differs from the profile — a different kit, a borrowed number. Null means the profile identity applies.';

-- ── 3 · structured pitch identity ────────────────────────────

alter table player_profiles add column if not exists kit_primary text;
alter table player_profiles add column if not exists kit_secondary text;
alter table player_profiles add column if not exists team_side text;

do $$ begin
  alter table player_profiles
    add constraint player_profiles_team_side_check
    check (team_side is null or team_side in ('home','away'));
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
