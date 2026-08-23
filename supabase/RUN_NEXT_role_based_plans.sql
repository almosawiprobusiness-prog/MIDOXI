/*
  MIDO XI — migration 0013: role-based plans.

  Pricing moved from feature tiers (free/pro/elite) to tiers shaped by who you
  are (free/player/touchline/club). This migrates the comped_access.tier
  constraint and the literal that apply_referral_reward inserts.

  Paste into the Supabase SQL editor and run. Safe to re-run.
  Afterwards: npm run verify:db
*/

-- MIDO XI — 0013: role-based plans
-- Pricing moved from feature tiers (free / pro / elite) to tiers
-- shaped by who you are:
--   free       one system, the user's choice, no AI
--   player     Player OS + AI
--   touchline  Player + Coach + Trainer + AI
--   club       all four + 10 staff seats
-- Two things in the database still name the old tiers and have to
-- move with it: the `comped_access.tier` constraint, and the
-- literal `'pro'` that `apply_referral_reward` inserts when a
-- referral reward is spent.
-- A free month earned by referring someone now grants `player`,
-- which is what "a free month of MIDO XI" means for an individual.
-- Safe to re-run.
-- ---------- comped_access.tier -------------------------------
/*
  Widen before narrowing: existing rows say 'pro' or 'elite', so the new
  constraint has to allow them until they are migrated, or the ALTER fails on
  data that is already there.
*/
alter table comped_access drop constraint if exists comped_access_tier_check;
update comped_access set tier = 'player'    where tier = 'pro';
update comped_access set tier = 'touchline' where tier = 'elite';
alter table comped_access
  add constraint comped_access_tier_check
  check (tier in ('player', 'touchline', 'club'));
alter table comped_access alter column tier set default 'player';
-- ---------- subscription_plans, if the catalogue is mirrored --
/*
  Older installs seeded a `subscription_plans` table. It is presentation-only —
  `lib/billing/plans.ts` is authoritative at runtime — but leaving stale rows
  named "Pro" and "Elite" in the database is the kind of thing that misleads
  whoever opens the table next.
*/
do $$
begin
  if to_regclass('public.subscription_plans') is not null then
    delete from subscription_plans where id in ('pro_monthly','pro_annual','elite_monthly','elite_annual');
  end if;
end $$;
-- ---------- the reward grants `player` -----------------------
create or replace function public.apply_referral_reward(p_months int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_months int;
  v_want int := greatest(coalesce(p_months, 999), 1);
  v_end timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;
  select array_agg(id), coalesce(sum(months), 0)
    into v_ids, v_months
  from (
    select id, months
    from referral_rewards
    where user_id = auth.uid() and status = 'earned'
    order by earned_at
    limit v_want
    for update
  ) picked;
  if coalesce(v_months, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'You have no unspent months.');
  end if;
  -- Stack on top of any comped time still running, rather than overwriting it.
  select max(ends_at) into v_end
    from comped_access
   where user_id = auth.uid() and ends_at > now();
  insert into comped_access (user_id, tier, source, starts_at, ends_at)
  values (
    auth.uid(),
    'player',                          -- was 'pro'
    'referral',
    coalesce(v_end, now()),
    coalesce(v_end, now()) + (v_months || ' months')::interval
  );
  update referral_rewards
     set status = 'applied', applied_at = now()
   where id = any (v_ids);
  return jsonb_build_object('ok', true, 'months', v_months);
end;
$$;
-- Grants are re-asserted because CREATE OR REPLACE resets them to the
-- PUBLIC default — the exact trap that migration 0012 existed to close.
revoke all on function public.apply_referral_reward(int) from public;
revoke all on function public.apply_referral_reward(int) from anon;
grant execute on function public.apply_referral_reward(int) to authenticated, service_role;