-- ============================================================
-- MIDO XI — 0043: split Touchline into Coach and Trainer
--
-- Touchline was one $29 tier granting Player + Coach + Trainer
-- together. In practice a coach paid for programme-writing tools
-- they never opened, and a trainer paid for opposition planning
-- they never used. It becomes two tiers at the SAME $29:
--
--   touchline_coach     Player + Coach
--   touchline_trainer   Player + Trainer
--
-- Nobody who needs both is left without an answer: that is Club.
--
-- WHAT THIS FILE HAS TO DO, AND WHY IT IS NOT OPTIONAL.
--
-- `subscriptions.plan_id` is a FOREIGN KEY onto subscription_plans.
-- Migration 0014 exists entirely because 0013 forgot that and every
-- paid subscription started failing on a foreign-key violation the
-- webhook was not reading. Adding plan ids in TypeScript without
-- adding the rows here would reproduce that bug exactly: the first
-- person to buy Touchline Coach would pay Stripe and stay on free,
-- and the only trace would be a 23503 in the logs.
--
-- THE GRANDFATHERED BUNDLE STAYS. One account is on
-- `touchline_monthly` and bought all three systems. Its rows are
-- left untouched and `lib/billing/plans.ts` still grants all three
-- for that plan id, so nobody loses what they paid for. It is
-- simply no longer sold — there is no tier card and
-- `cheapestPlanFor` skips it.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the referenced side of the foreign key ------------

/*
  `weekly_reviews` is absent on purpose. Migration 0018 dropped it as a
  limit that was advertised, metered, and produced by nothing; the seeds
  in 0014 still carry it, and repeating that here would re-introduce the
  fiction into the two newest rows.
*/
insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('touchline_coach_monthly', 'MIDO XI Touchline Coach', 2900, 'month',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb),
  ('touchline_coach_annual', 'MIDO XI Touchline Coach', 27900, 'year',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb),

  ('touchline_trainer_monthly', 'MIDO XI Touchline Trainer', 2900, 'month',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb),
  ('touchline_trainer_annual', 'MIDO XI Touchline Trainer', 27900, 'year',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb)
on conflict (id) do update set
  name         = excluded.name,
  price_cents  = excluded.price_cents,
  interval     = excluded.interval,
  entitlements = excluded.entitlements;

/*
  Rename the retired bundle so anyone reading the table knows what it is.
  The row itself must stay: `subscriptions.plan_id` still points at it.
*/
update subscription_plans
   set name = 'MIDO XI Touchline (retired — split into Coach and Trainer)'
 where id in ('touchline_monthly', 'touchline_annual');

-- ---------- comped_access may now grant either half -----------

/*
  0013 set this constraint to ('player','touchline','club'). The two new
  tiers have to be grantable — the whole point of `scripts/comp.mjs` is
  handing someone exactly the system they need — and 'touchline' stays
  valid because comps written before the split still mean all three, and
  shrinking one retroactively would take away access already given.
*/
alter table comped_access drop constraint if exists comped_access_tier_check;

alter table comped_access
  add constraint comped_access_tier_check
  check (tier in ('player', 'touchline', 'touchline_coach', 'touchline_trainer', 'club'));

comment on column comped_access.tier is
  'Which tier this grant opens. ''touchline'' is the retired Player+Coach+Trainer bundle, kept for grants written before migration 0043 split it; new grants use touchline_coach or touchline_trainer.';

notify pgrst, 'reload schema';
