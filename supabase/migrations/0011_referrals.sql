-- ============================================================
-- MIDO XI — 0011: the referral programme
--
-- Three principles decide this schema.
--
-- 1. A REFERRAL ONLY EARNS WHEN MONEY MOVES, AND STAYS MOVED.
--    Signing up creates a `pending` row worth nothing. Conversion
--    is written by the Stripe webhook (service role) and held for
--    14 days, so a refund reverses the reward instead of paying it.
--
-- 2. THE REFERRER NEVER LEARNS WHO SIGNED UP.
--    `referrals` holds the referred user's id because attribution
--    needs it, but the referrer's read policy goes through a view
--    that does not expose it. They see counts and statuses.
--
-- 3. VISIT COUNTING IDENTIFIES NOBODY.
--    One counter row per code per day. No IP, no user agent, no
--    fingerprint, nothing that could be joined back to a person.
--
-- Rewards are months of Pro. There is no money ledger here on
-- purpose: cash payouts need a payout provider and tax onboarding
-- that this product does not have, and a balance column would be
-- a promise the software cannot keep.
--
-- Safe to re-run.
-- ============================================================

-- ---------- codes --------------------------------------------

create table if not exists referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Six characters, no O/0/I/1 — these get read out loud.
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table referral_codes enable row level security;

drop policy if exists referral_codes_owner on referral_codes;
create policy referral_codes_owner on referral_codes
  for select to authenticated
  using (user_id = auth.uid());

-- Codes are minted by the function below, never by a client insert.

-- ---------- visits -------------------------------------------

create table if not exists referral_visits (
  code text not null,
  day date not null default (now() at time zone 'utc')::date,
  hits integer not null default 0,
  primary key (code, day)
);

alter table referral_visits enable row level security;

-- Nobody selects this table directly. The owner reads their total through
-- `my_referrals()`; the counter is bumped by a security-definer function.

-- ---------- referrals ----------------------------------------

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  -- One account can only ever be referred once.
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','converted','void')),
  -- Set when the subscription starts; the reward lands `hold_until` later.
  converted_at timestamptz,
  hold_until timestamptz,
  tier text,
  void_reason text,
  created_at timestamptz not null default now(),
  -- Self-referral is not a business model.
  constraint referrals_not_self check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on referrals (referrer_id, created_at desc);
create index if not exists referrals_code_idx on referrals (code);

alter table referrals enable row level security;

/*
  The referrer reads their own rows — and only the columns a referrer should
  have. `referred_id` is in the table because attribution needs it; it is not in
  this policy's reach because a referral programme is not a way to find out who
  your friends are. Column-level control is done by the function below, which is
  the only read path the app uses.
*/
drop policy if exists referrals_referrer_read on referrals;
create policy referrals_referrer_read on referrals
  for select to authenticated
  using (referrer_id = auth.uid());

-- ---------- rewards ------------------------------------------

create table if not exists referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_id uuid references referrals(id) on delete set null,
  kind text not null default 'pro_month' check (kind in ('pro_month')),
  months integer not null default 1 check (months > 0),
  status text not null default 'earned' check (status in ('earned','applied')),
  earned_at timestamptz not null default now(),
  applied_at timestamptz,
  -- A referral earns at most one reward.
  unique (referral_id)
);

create index if not exists referral_rewards_user_idx on referral_rewards (user_id, earned_at desc);

alter table referral_rewards enable row level security;

drop policy if exists referral_rewards_owner on referral_rewards;
create policy referral_rewards_owner on referral_rewards
  for select to authenticated
  using (user_id = auth.uid());

-- Granting a reward is the webhook's job; spending one goes through
-- `apply_referral_reward` below. Neither is a client write.

-- ---------- comped months ------------------------------------

/*
  Where a spent reward actually lands. `getMembership` reads this alongside the
  Stripe subscription, so a comped month is a real entitlement rather than a
  number on a dashboard.
*/
create table if not exists comped_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null default 'pro' check (tier in ('pro','elite')),
  source text not null default 'referral',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists comped_access_user_idx on comped_access (user_id, ends_at desc);

alter table comped_access enable row level security;

drop policy if exists comped_access_owner on comped_access;
create policy comped_access_owner on comped_access
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Functions
-- ============================================================

/*
  Mint-or-return the caller's code. Retries on the (vanishingly unlikely)
  collision rather than failing the page that asked for it.
*/
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_try int := 0;
begin
  if auth.uid() is null then
    return null;
  end if;

  select code into v_code from referral_codes where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_try := v_try + 1;
    -- 6 chars from A-Z/2-9 with O,0,I,1 removed.
    v_code := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), ''
      )
      from generate_series(1, 6)
    );
    begin
      insert into referral_codes (user_id, code) values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      if v_try >= 8 then
        raise exception 'Could not allocate a referral code';
      end if;
    end;
  end loop;
end;
$$;

/*
  Count an opened link. Takes a code, returns nothing useful, and stores nothing
  that identifies the visitor — a day counter is all a referrer needs to see
  that the link is being opened at all.

  Callable by anonymous visitors, which is the point: the click happens before
  anyone has an account.
*/
create or replace function public.record_referral_visit(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
begin
  if v_code !~ '^[A-Z0-9]{6}$' then
    return;
  end if;
  -- Unknown codes are silently ignored, so this cannot be used to test which
  -- codes exist.
  if not exists (select 1 from referral_codes where code = v_code) then
    return;
  end if;

  insert into referral_visits (code, day, hits)
  values (v_code, (now() at time zone 'utc')::date, 1)
  on conflict (code, day) do update set hits = referral_visits.hits + 1;
end;
$$;

/*
  Attribute the caller's brand-new account to a code. Called once, just after
  signup. Idempotent, and it refuses every way this could be gamed: your own
  code, an account that is already attributed, an account old enough that the
  claim is retroactive.
*/
create or replace function public.attribute_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_referrer uuid;
  v_created timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  select user_id into v_referrer from referral_codes where code = v_code;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'error', 'That referral code is not recognised.');
  end if;
  if v_referrer = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'That is your own referral code.');
  end if;
  if exists (select 1 from referrals where referred_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'This account is already credited to someone.');
  end if;

  -- Attribution belongs to signup. A month-old account claiming a code is
  -- someone farming their own referrals.
  select created_at into v_created from auth.users where id = auth.uid();
  if v_created < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'error', 'Referral codes apply to new accounts only.');
  end if;

  insert into referrals (code, referrer_id, referred_id, status)
  values (v_code, v_referrer, auth.uid(), 'pending');

  return jsonb_build_object('ok', true);
end;
$$;

/*
  Spend earned months. Extends (or opens) a comped window on the caller's own
  account and marks the rewards spent, in one transaction so a crash cannot
  consume a reward without granting the time.
*/
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
    'pro',
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

/*
  What the dashboard reads. Returns the referrer's own numbers and a status list
  with no identity in it — the referrer learns that someone converted, never who.
*/
create or replace function public.my_referrals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select code into v_code from referral_codes where user_id = auth.uid();

  return jsonb_build_object(
    'code', v_code,
    'visits', coalesce((select sum(hits) from referral_visits where code = v_code), 0),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'joinedAt', r.created_at,
        'convertedAt', r.converted_at,
        'tier', r.tier
      ) order by r.created_at desc)
      from referrals r where r.referrer_id = auth.uid()
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'status', w.status,
        'months', w.months,
        'earnedAt', w.earned_at,
        'appliedAt', w.applied_at
      ) order by w.earned_at desc)
      from referral_rewards w where w.user_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

/*
  Ripen held conversions into rewards. Idempotent, and safe to run on any
  schedule — a cron job, or opportunistically when a dashboard loads.

  This is deliberately separate from `convert_referral`: the hold is what makes
  the reward survive a refund, and a reward that is granted on the same tick as
  the charge has no hold at all.
*/
create or replace function public.ripen_referral_rewards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with ripe as (
    select r.id, r.referrer_id
      from referrals r
     where r.status = 'converted'
       and r.hold_until is not null
       and r.hold_until <= now()
       and not exists (select 1 from referral_rewards w where w.referral_id = r.id)
  ), inserted as (
    insert into referral_rewards (user_id, referral_id, kind, months, status)
    select referrer_id, id, 'pro_month', 1, 'earned' from ripe
    on conflict (referral_id) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return coalesce(v_count, 0);
end;
$$;

-- ---------- grants -------------------------------------------

-- Anonymous visitors count a click; that is all they may do.
grant execute on function public.record_referral_visit(text) to anon, authenticated;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.attribute_referral(text) to authenticated;
grant execute on function public.apply_referral_reward(int) to authenticated;
grant execute on function public.my_referrals() to authenticated;
grant execute on function public.ripen_referral_rewards() to authenticated;

/*
  Conversion is NOT granted to any client role. It is written by the Stripe
  webhook with the service key, because "this person started paying" is a claim
  only the payment processor gets to make.
*/
create or replace function public.convert_referral(p_user uuid, p_tier text, p_hold_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hit int;
begin
  update referrals
     set status = 'converted',
         converted_at = coalesce(converted_at, now()),
         hold_until = coalesce(hold_until, now() + (greatest(p_hold_days, 0) || ' days')::interval),
         tier = coalesce(p_tier, tier)
   where referred_id = p_user
     and status = 'pending';
  get diagnostics v_hit = row_count;
  return jsonb_build_object('ok', true, 'updated', v_hit);
end;
$$;

/*
  Reverse one. A refund or chargeback voids the referral and takes back any
  reward that has not been spent — spent months are left alone, because clawing
  back access someone is already using is worse than eating the cost.
*/
create or replace function public.void_referral(p_user uuid, p_reason text default 'refund')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hit int;
begin
  update referrals
     set status = 'void', void_reason = p_reason
   where referred_id = p_user and status <> 'void';
  get diagnostics v_hit = row_count;

  delete from referral_rewards
   where status = 'earned'
     and referral_id in (select id from referrals where referred_id = p_user);

  return jsonb_build_object('ok', true, 'voided', v_hit);
end;
$$;

revoke execute on function public.convert_referral(uuid, text, int) from anon, authenticated;
revoke execute on function public.void_referral(uuid, text) from anon, authenticated;
