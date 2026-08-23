-- ============================================================
-- MIDO XI — 0018: remove a limit that had no feature behind it
--
-- `weekly_reviews` was in every paid tier's entitlements — 4 on
-- Player, 8 on Touchline, 20 on Club. It was metered on the
-- membership page and sold as a Player perk: "Weekly reviews that
-- name what actually changed."
--
-- Nothing in the codebase ever generated one, checked the limit,
-- or consumed it. It was a number on a page people pay from, with
-- no product behind it. It is gone from `lib/billing/plans.ts`,
-- and this removes the copy that lives in the database.
--
-- COSMETIC, by design. `getMembership()` reads entitlements from
-- `PLANS[planId].entitlements` in the application, never from this
-- table — so nothing behaves differently after running this. The
-- reason to run it is that a stale row here is exactly how the
-- fiction gets reintroduced: the next person to read this table
-- will reasonably assume it is authoritative.
--
-- `subscription_plans` is still load-bearing for a different
-- reason — `subscriptions.plan_id` is a foreign key to it, which
-- is what migration 0013 broke and 0014 repaired. Rows are edited
-- here, never deleted.
--
-- Safe to re-run: removing an absent key from jsonb is a no-op.
-- ============================================================

update subscription_plans
set entitlements = entitlements - 'weekly_reviews'
where entitlements ? 'weekly_reviews';

-- What it should look like afterwards. Every remaining key is one
-- that a real `consumeFeature()` call site spends against:
--
--   ai_interactions     lib/ai/coach-engine.ts, lib/ai/trainer-engine.ts
--   deep_analyses       lib/video/frame-reader.ts, lib/video/native-video.ts
--   study_discoveries   lib/ai/study-engine.ts, app/app/film-room/discover-actions.ts
--
--   select id, entitlements from subscription_plans order by id;

notify pgrst, 'reload schema';
