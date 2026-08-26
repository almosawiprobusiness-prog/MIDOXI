-- ============================================================
-- MIDO XI — 0033: product analytics + beta feedback
--
-- Two small tables for the Founding XI beta, and a boundary
-- worth stating in the schema itself:
--
-- THIS IS NOT THE FOOTBALL EVENT LOG. `mido_events` records what
-- a player DID in their football life, feeds recommendations,
-- and belongs to the player. These tables record how the PRODUCT
-- is doing — did onboarding complete, was a study started, did
-- an AI answer get a thumbs-down — and they belong to us. Mixing
-- them would poison both: telemetry rows would start influencing
-- recommendations, and football history would acquire the
-- retention rules of analytics.
--
-- Privacy posture, deliberately:
--   · named product actions only — no page views, no clicks,
--     no durations, no device fingerprints
--   · props carry identifiers and small enums, never free text
--     from the player's football record
--   · players can INSERT their own rows and read NOTHING —
--     there is nothing here for a player to see, and a select
--     policy would only invite building player-facing features
--     on top of ops data
--   · both tables cascade on account deletion, same as
--     everything else
--
-- Safe to re-run.
-- ============================================================

create table if not exists product_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- The vocabulary lives in lib/analytics/track.ts, which is the
  -- authority. Text, not an enum, for the usual reason: a new
  -- event must not need a migration and a deploy in lockstep.
  event text not null,

  -- Small, structured context: { kind: 'study' }, { slug: 'harry-kane' }.
  -- NEVER free text a player wrote. The check constraint cannot
  -- enforce intent, but the size cap keeps a mistake small.
  props jsonb not null default '{}'::jsonb
    constraint product_analytics_props_size check (pg_column_size(props) < 2048),

  created_at timestamptz not null default now()
);

create index if not exists product_analytics_event_time_idx
  on product_analytics (event, created_at desc);

create index if not exists product_analytics_user_time_idx
  on product_analytics (user_id, created_at desc);

alter table product_analytics enable row level security;

-- Insert-only for players; reads happen with the service role in
-- admin tooling. No update, no delete: telemetry that can be
-- edited from the client is not telemetry.
drop policy if exists product_analytics_owner_insert on product_analytics;
create policy product_analytics_owner_insert on product_analytics
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on product_analytics from anon, public, authenticated;
grant insert on product_analytics to authenticated;

comment on table product_analytics is
  'Product usage, not football history. Named actions only, no page views, insert-only from the client, read with the service role. Kept apart from mido_events on purpose: telemetry must never influence a recommendation, and football history must never inherit analytics retention.';

-- ------------------------------------------------------------

create table if not exists beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- 'problem' | 'feedback' | 'ai_rating'
  kind text not null check (kind in ('problem', 'feedback', 'ai_rating')),

  -- What it is about: 'study:harry-kane', 'nba', 'film:analysis',
  -- or null for general feedback.
  subject text,

  -- For ai_rating: 1 = useful, -1 = not useful. Null otherwise.
  rating smallint check (rating in (1, -1)),

  -- The player's words, and the one place free text is welcome —
  -- they are addressing us directly and know it.
  body text check (char_length(body) <= 2000),

  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_time_idx
  on beta_feedback (created_at desc);

create index if not exists beta_feedback_kind_idx
  on beta_feedback (kind, created_at desc);

alter table beta_feedback enable row level security;

drop policy if exists beta_feedback_owner_insert on beta_feedback;
create policy beta_feedback_owner_insert on beta_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

revoke all on beta_feedback from anon, public, authenticated;
grant insert on beta_feedback to authenticated;

comment on table beta_feedback is
  'What the Founding XI tell us: problems, feedback and thumb ratings on AI output. Insert-only from the client, read with the service role. More valuable than a month of speculative development.';

notify pgrst, 'reload schema';
