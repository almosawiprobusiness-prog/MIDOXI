-- ============================================================
-- MIDO XI — 0029: the grants nine billing tables never got
--
-- Audited alongside Stripe. Nine tables — `referral_codes`,
-- `referral_visits`, `referrals`, `referral_rewards`,
-- `comped_access`, `subscriptions`, `billing_customers`,
-- `usage_periods`, `ai_usage_events` — were created across 0001
-- and 0011 with RLS enabled and exactly one `for select` policy
-- each, owner-scoped, and never had a single table-level revoke
-- or grant issued. `anon` and `authenticated` have held Supabase's
-- default privileges on every one of them since the day each was
-- created.
--
-- VERIFIED, NOT ASSUMED. A real signed-in account attempted six
-- direct writes: minting itself Club-tier comped access, minting
-- 999 months of referral reward, marking its own referral
-- converted, self-granting an active Club subscription, pointing
-- billing_customers at a fabricated Stripe customer id, and
-- zeroing its own AI usage counters. All six came back
-- `42501 — new row violates row-level security policy` — RLS
-- correctly refusing an operation with no matching policy, not a
-- granted privilege sitting unused. Nobody has ever been able to
-- write themselves a subscription, a referral reward, or free AI
-- usage this way.
--
-- But every one of these tables is written some other way that
-- needs none of `authenticated`'s privilege at all:
--
--   · the five referral tables are written exclusively by
--     SECURITY DEFINER functions (my_referral_code,
--     record_referral_visit, attribute_referral,
--     apply_referral_reward, convert_referral, void_referral),
--     which run with the function owner's privileges regardless
--     of what the calling role can do to the table directly;
--   · subscriptions and billing_customers are written only by the
--     Stripe webhook, holding the service key;
--   · usage_periods and ai_usage_events are written only by
--     `lib/billing/meter.ts`, which says so in its own comment —
--     "Entitlement writes bypass RLS ... so they run through the
--     service-role client" — and always has, via
--     `createAdminClient()`, never the caller's session.
--
-- So the "RLS has no permissive policy yet" protection was never
-- load-bearing for anything the product actually does. Leaving
-- the default grant standing anyway means the only thing between
-- here and a free-money bug is nobody ever adding one permissive
-- write policy for an unrelated reason — which is precisely the
-- shape of every other gap this schema has been caught with. The
-- privilege should be the floor; on these nine tables it was never
-- poured.
--
-- Safe to re-run.
-- ============================================================

revoke all on referral_codes   from anon, public, authenticated;
revoke all on referral_visits  from anon, public, authenticated;
revoke all on referrals        from anon, public, authenticated;
revoke all on referral_rewards from anon, public, authenticated;
revoke all on comped_access    from anon, public, authenticated;
revoke all on subscriptions      from anon, public, authenticated;
revoke all on billing_customers  from anon, public, authenticated;
revoke all on usage_periods      from anon, public, authenticated;
revoke all on ai_usage_events    from anon, public, authenticated;

-- Read-only, matching the one policy each of these actually has.
grant select on referral_codes    to authenticated;
grant select on referrals         to authenticated;
grant select on referral_rewards  to authenticated;
grant select on comped_access     to authenticated;
grant select on subscriptions     to authenticated;
grant select on billing_customers to authenticated;
grant select on usage_periods     to authenticated;
grant select on ai_usage_events   to authenticated;

-- Nothing, for anybody. `referral_visits` has no select policy either
-- — reads go through `my_referrals()`, which sums it server-side —
-- so there is no privilege a client role legitimately needs here.

comment on table subscriptions is
  'Stripe is the source of truth; written only by app/api/stripe/webhook, holding the service key. authenticated holds select only — a client-writable row here is a client-writable subscription.';
comment on table billing_customers is
  'Written only by ensureCustomer() in lib/billing/stripe.ts, via the service role. authenticated holds select only.';
comment on table usage_periods is
  'Written only by lib/billing/meter.ts via the admin client — never the caller''s own session, so this table needed no client-facing write privilege from the day it was built.';
comment on table ai_usage_events is
  'Telemetry, written only by logAiUsage() in lib/billing/meter.ts via the admin client. authenticated holds select only.';
comment on table referral_codes is
  'Minted by my_referral_code() (SECURITY DEFINER). authenticated holds select only.';
comment on table referral_visits is
  'Written only by record_referral_visit() (SECURITY DEFINER). No client role holds any privilege — reads go through my_referrals(), never this table directly.';
comment on table referrals is
  'Written only by attribute_referral(), convert_referral() and void_referral() (SECURITY DEFINER, the last two also revoked from every client role in 0012). authenticated holds select only.';
comment on table referral_rewards is
  'Earned by ripen_referral_rewards(), spent by apply_referral_reward() — both SECURITY DEFINER. authenticated holds select only: a reward a client could insert is free money.';
comment on table comped_access is
  'Written only by apply_referral_reward() (SECURITY DEFINER) and the service role, for founder/manual grants. authenticated holds select only — getMembership() reads this as a real entitlement, so a client-writable row here is a client-writable subscription.';

notify pgrst, 'reload schema';
