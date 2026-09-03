-- ============================================================
-- MIDO XI — 0046: four paid tiers become two
--
-- The ladder was shaped by who you are — Player, Touchline Coach,
-- Touchline Trainer, Club. It becomes shaped by who does the work:
--
--   xi        $29 / $279. Player + Coach + Trainer, one seat.
--             Deliberately the old Touchline bundle, so the accounts
--             already on `touchline_*` are already on the right
--             product and lose nothing.
--
--   managed   Quoted. All four systems, staff seats, delivered in
--             the club's own identity. Sold through the quote system,
--             never through checkout — which is why it has no price
--             here and no Stripe price anywhere.
--
-- Player folds into Free (which is the whole deterministic product
-- and says so) and Club folds into Managed.
--
-- WHAT THIS FILE HAS TO DO, AND WHY IT IS NOT OPTIONAL.
--
-- `subscriptions.plan_id` is a FOREIGN KEY onto subscription_plans.
-- Migration 0014 exists entirely because 0013 forgot that and every
-- paid subscription started failing on a foreign-key violation the
-- webhook was not reading. Adding plan ids in TypeScript without
-- adding the rows here would reproduce that bug exactly: the first
-- person to buy MIDO XI would pay Stripe and stay on free, and the
-- only trace would be a 23503 in the logs.
--
-- NOTHING IS DELETED. Every retired plan row stays exactly where it
-- is, because live subscriptions still point at it and
-- `lib/billing/plans.ts` still grants each one precisely what it
-- sold. Retirement here means "no longer offered", never "taken
-- away".
--
-- Safe to re-run.
-- ============================================================

-- ---------- the referenced side of the foreign key ------------

/*
  `weekly_reviews` is absent on purpose. Migration 0018 dropped it as a
  limit that was advertised, metered, and produced by nothing; the seeds
  in 0014 still carry it, and repeating that here would re-introduce the
  fiction into the newest rows.

  `managed` carries price_cents 0 and a null interval. That is not a free
  plan — it is a plan whose price lives in an accepted quote. The name
  says so out loud so nobody reading this table alone concludes we are
  giving away the top tier.
*/
insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('xi_monthly', 'MIDO XI', 2900, 'month',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb),
  ('xi_annual', 'MIDO XI', 27900, 'year',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80}'::jsonb),

  ('managed', 'MIDO XI Managed (quoted — price lives in the accepted quote)', 0, null,
    '{"ai_interactions":1500,"deep_analyses":200,"study_discoveries":250}'::jsonb)
on conflict (id) do update set
  name         = excluded.name,
  price_cents  = excluded.price_cents,
  interval     = excluded.interval,
  entitlements = excluded.entitlements;

/*
  Mark the retired rows so anyone reading the table knows what they are.
  The rows themselves must stay: `subscriptions.plan_id` still points at
  them, and 0043 already learned this lesson for the Touchline bundle.

  touchline_coach / touchline_trainer never had a Stripe price created,
  so nobody was ever able to buy them — they are retired without ever
  having been sold.
*/
update subscription_plans
   set name = 'MIDO XI Player (retired — Free below, MIDO XI above)'
 where id in ('player_monthly', 'player_annual');

update subscription_plans
   set name = 'MIDO XI Touchline (retired — became MIDO XI)'
 where id in ('touchline_monthly', 'touchline_annual');

update subscription_plans
   set name = 'MIDO XI Touchline Coach (retired — never sold)'
 where id in ('touchline_coach_monthly', 'touchline_coach_annual');

update subscription_plans
   set name = 'MIDO XI Touchline Trainer (retired — never sold)'
 where id in ('touchline_trainer_monthly', 'touchline_trainer_annual');

update subscription_plans
   set name = 'MIDO XI Club (retired — became MIDO XI Managed)'
 where id in ('club_monthly', 'club_annual');

-- ---------- comped_access may now grant either new tier -------

/*
  0043 set this to ('player','touchline','touchline_coach','touchline_trainer','club').
  The two new tiers have to be grantable — comping someone the tier they
  need is the whole point of `scripts/comp.mjs` — and every old value
  stays valid, because a comp written before today still means what it
  meant when it was given and shrinking one retroactively would take away
  access somebody already has.
*/
alter table comped_access drop constraint if exists comped_access_tier_check;

alter table comped_access
  add constraint comped_access_tier_check
  check (tier in ('xi', 'managed', 'player', 'touchline', 'touchline_coach', 'touchline_trainer', 'club'));

comment on column comped_access.tier is
  'Which tier this grant opens. New grants use ''xi'' (Player+Coach+Trainer, one seat) or ''managed'' (all four, staff seats). The rest are retired tiers, kept valid so grants written before migration 0046 still mean what they meant when they were given.';

notify pgrst, 'reload schema';
