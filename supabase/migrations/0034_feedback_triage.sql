-- ============================================================
-- MIDO XI — 0034: feedback taxonomy, context and triage
--
-- 0033 shipped feedback with three kinds. The beta needs five,
-- because "I didn't understand this" is a DIFFERENT signal from
-- "this is broken" and collapsing them loses the more valuable
-- one: a bug is a defect, confusion is a design failure, and a
-- product that cannot tell them apart fixes the wrong thing.
--
-- Also adds the context that makes a report actionable without
-- interrogating the player, and the two fields that turn a pile
-- of reports into a queue.
--
-- ADDITIVE AND IDEMPOTENT. Written so it is correct whether or
-- not 0033 has already been applied, and whether or not rows
-- already exist: the old kind values stay legal, so nothing
-- already written can be orphaned by this.
--
-- Safe to re-run.
-- ============================================================

/*
  Context captured automatically, so the player can say "my video
  never finished uploading" and submit.

  DELIBERATELY NARROW. Route says WHERE, device_class says roughly
  WHAT ON, app_version says WHICH BUILD. There is no user agent
  string, no screen size, no IP, no session id — none of which
  would help us fix a football product, and all of which would
  make this a fingerprint. The rule is the same one the football
  event log follows: if it would not change what we do, it does
  not get stored.
*/
alter table beta_feedback add column if not exists route text;
alter table beta_feedback add column if not exists device_class text;
alter table beta_feedback add column if not exists app_version text;

-- The thing being talked about: a video id, a study slug, a
-- recommendation id. Lets a report be opened next to its subject.
alter table beta_feedback add column if not exists object_id text;

/*
  Triage. Set by an admin, never by the player — a player choosing
  their own severity is a product asking them to do our job, and
  every report would arrive critical.
*/
alter table beta_feedback add column if not exists status text
  not null default 'new';
alter table beta_feedback add column if not exists severity text;
alter table beta_feedback add column if not exists triaged_at timestamptz;
alter table beta_feedback add column if not exists internal_note text;

/*
  The vocabulary, widened.

  Old values remain legal on purpose. A constraint that invalidates
  rows already written is a migration that can fail at 3am on real
  data — and 'problem'/'feedback' map cleanly onto 'bug'/'idea'
  when read, so nothing is lost by letting them stand.
*/
alter table beta_feedback drop constraint if exists beta_feedback_kind_check;
alter table beta_feedback add constraint beta_feedback_kind_check
  check (kind in (
    'bug',          -- something did not work
    'confusing',    -- I did not understand something
    'idea',         -- something I would like MIDO to do
    'ai_feedback',  -- MIDO gave me a bad or unhelpful answer
    'other',
    -- 0033 vocabulary, still legal so existing rows stay valid
    'problem', 'feedback', 'ai_rating'
  ));

alter table beta_feedback drop constraint if exists beta_feedback_status_check;
alter table beta_feedback add constraint beta_feedback_status_check
  check (status in ('new', 'investigating', 'planned', 'fixed', 'not_planned'));

alter table beta_feedback drop constraint if exists beta_feedback_severity_check;
alter table beta_feedback add constraint beta_feedback_severity_check
  check (severity is null or severity in ('critical', 'high', 'medium', 'low'));

-- The queue's own read pattern: what is still open, oldest first,
-- because a report that has waited longest is the one being failed.
create index if not exists beta_feedback_open_idx
  on beta_feedback (status, created_at)
  where status in ('new', 'investigating');

/*
  Still insert-only for players. Triage happens through the service
  role in the admin dashboard, which means a player cannot change
  the status of their own report — and, more to the point, cannot
  read anyone else's.
*/

comment on column beta_feedback.route is
  'Where the player was when they reported. Captured automatically so nobody has to describe a screen. Not a browsing history: one route, at one moment, attached to one report.';

comment on column beta_feedback.status is
  'Triage state, set by an admin. Players never see or set this — a product that asks players to rate their own severity receives nothing but criticals.';

notify pgrst, 'reload schema';
