-- 0004 — Three-tier pricing: reprice Pro, add Elite.
-- Entitlements are code-authoritative (lib/billing/plans.ts); this keeps the
-- subscription_plans catalogue consistent for reference/reporting.

update subscription_plans set price_cents = 1199,
  entitlements = '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb
  where id = 'pro_monthly';
update subscription_plans set price_cents = 11900,
  entitlements = '{"ai_interactions":150,"deep_analyses":20,"study_discoveries":30,"weekly_reviews":4}'::jsonb
  where id = 'pro_annual';

insert into subscription_plans (id, name, price_cents, interval, entitlements) values
  ('elite_monthly', 'MIDO XI Elite', 2499, 'month',
    '{"ai_interactions":1000,"deep_analyses":120,"study_discoveries":180,"weekly_reviews":8}'::jsonb),
  ('elite_annual', 'MIDO XI Elite', 24900, 'year',
    '{"ai_interactions":1000,"deep_analyses":120,"study_discoveries":180,"weekly_reviews":8}'::jsonb)
on conflict (id) do update set
  price_cents = excluded.price_cents,
  entitlements = excluded.entitlements;
