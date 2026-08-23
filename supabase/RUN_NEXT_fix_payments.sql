/*
  MIDO XI — RUN THIS NEXT (fixes payments not reaching the app)

  Migration 0014. `subscriptions.plan_id` is a foreign key into
  `subscription_plans`, and migration 0013 emptied that table of everything but
  'free'. Every paid subscription therefore failed to record.

  Paste into the Supabase SQL editor and run. Safe to re-run.
  Afterwards: npm run verify:db
*/

/*
  MIDO XI — migration 0014: seed subscription_plans for the role-based tiers.

  SEVERITY: this is why a successful payment never reached the app.

  `subscriptions.plan_id` is a FOREIGN KEY:

      plan_id text not null references subscription_plans(id)

  Migration 0013 called `subscription_plans` "presentation-only" and deleted the
  pro/elite rows. It is not presentation-only — it is the referenced side of
  that key. So after 0013 the table held only 'free', and the Stripe webhook's
  attempt to write plan_id = 'player_monthly' failed with a foreign-key
  violation on every paid subscription.

  It failed silently because the webhook never checked the upsert's error. Both
  halves are fixed: the rows are seeded here, and the webhook now logs and
  rethrows so Stripe retries instead of reporting a false success.

  Safe to re-run.
*/

insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('free', 'MIDO XI', 0, null, '{}'::jsonb),

  ('player_monthly', 'MIDO XI Player', 999, 'month',
    '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb),
  ('player_annual', 'MIDO XI Player', 8900, 'year',
    '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb),

  ('touchline_monthly', 'MIDO XI Touchline', 2900, 'month',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80,"weekly_reviews":8}'::jsonb),
  ('touchline_annual', 'MIDO XI Touchline', 27900, 'year',
    '{"ai_interactions":400,"deep_analyses":60,"study_discoveries":80,"weekly_reviews":8}'::jsonb),

  ('club_monthly', 'MIDO XI Club', 14900, 'month',
    '{"ai_interactions":1500,"deep_analyses":200,"study_discoveries":250,"weekly_reviews":20}'::jsonb),
  ('club_annual', 'MIDO XI Club', 149000, 'year',
    '{"ai_interactions":1500,"deep_analyses":200,"study_discoveries":250,"weekly_reviews":20}'::jsonb)
on conflict (id) do update set
  name         = excluded.name,
  price_cents  = excluded.price_cents,
  interval     = excluded.interval,
  entitlements = excluded.entitlements;

/*
  The old rows are left alone deliberately.

  0013 deleted them, which is what broke this. Any historical `subscriptions`
  row still pointing at 'pro_monthly' needs its referenced row to exist, or the
  delete fails and — worse — that customer's plan becomes unreadable. They cost
  nothing to keep, and `lib/billing/plans.ts` is what the app actually reads.

  If they are genuinely unreferenced they can be removed later, checked:

    select plan_id, count(*) from subscriptions group by plan_id;
*/
insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('pro_monthly',   'MIDO XI Pro (retired)',   1199, 'month', '{}'::jsonb),
  ('pro_annual',    'MIDO XI Pro (retired)',   11900, 'year', '{}'::jsonb),
  ('elite_monthly', 'MIDO XI Elite (retired)', 2499, 'month', '{}'::jsonb),
  ('elite_annual',  'MIDO XI Elite (retired)', 24900, 'year', '{}'::jsonb)
on conflict (id) do nothing;
