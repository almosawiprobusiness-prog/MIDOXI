-- ============================================================
-- MIDO XI — 0042: the referral programme's two broken halves
--
-- Two faults, found together, both of them promises the product
-- makes in writing and does not keep.
--
-- 1. THE JOINER'S MONTH WAS NEVER DELIVERED.
--    `REWARD.monthsForJoiner` is 1, and the signup page says so to
--    the person's face — "Your first paid month comes with 1 free
--    month" — as does the referrals page: "The person who joins
--    gets 1 free month too, this is not a one-way deal."
--    `ripen_referral_rewards` mints a `referral_rewards` row for
--    `referrer_id` and for nobody else. Nothing anywhere grants the
--    joiner anything. A unit test asserts the constant is above
--    zero, which is why it survived: it pins the promise, not the
--    delivery.
--
--    It is not fixed by minting them a comped month either. Comped
--    access and a Stripe subscription are read side by side by
--    `getMembership()`, which takes the better of the two — but
--    Stripe carries on charging regardless, so a comped month
--    handed to somebody actively paying is worth nothing at all.
--    The only form of "a free month" that is true for a paying
--    customer is money: a credit on their Stripe balance, which
--    Stripe applies to the next invoice. That happens in the
--    webhook; this migration gives it the ledger column and the
--    claim it needs to happen exactly once.
--
-- 2. AN EXISTING FREE ACCOUNT COULD NOT BE REFERRED AT ALL.
--    `attribute_referral` refused any account older than seven
--    days: "Referral codes apply to new accounts only." The stated
--    reason was self-farming — "a month-old account claiming a code
--    is someone farming their own referrals".
--
--    But a reward only exists once Stripe says money moved and the
--    subscription survives the hold. To farm a month out of this
--    you must first pay for a month, from a second card, on a
--    second email: break-even at best, before the effort. The age
--    gate guards a door the money gate already locked — and it
--    charges a real price for it, because MIDO XI's free tier is
--    permanent and complete by design. The population that matters
--    most is long-lived free accounts, and "get a free user to
--    start paying" was the exact conversion the rule paid zero for.
--
--    Replaced with the guard that actually describes the abuse: a
--    code applies any time BEFORE the account's first subscription.
--    Someone who has already paid is a returning customer, not a
--    referral.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the joiner-credit ledger --------------------------

/*
  When the joiner's free month was paid, as money, into Stripe.
  Null means owed-or-not-yet-converted; the claim below is what
  turns it into "paid", once, under concurrency.
*/
alter table referrals add column if not exists joiner_credited_at timestamptz;

comment on column referrals.joiner_credited_at is
  'When the joiner''s REWARD.monthsForJoiner was credited to their Stripe customer balance. Claimed atomically by claim_joiner_credit() so Stripe retries and the created+updated pair cannot double-credit; released by release_joiner_credit() if the Stripe call then fails.';

-- ---------- attribution: age gate out, payment gate in --------

create or replace function public.attribute_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_referrer uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'error', 'You must be signed in.');
  end if;

  select user_id into v_referrer from referral_codes where code = v_code;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code', 'error', 'That referral code is not recognised.');
  end if;

  if v_referrer = auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'own_code', 'error', 'That is your own referral code.');
  end if;

  if exists (select 1 from referrals where referred_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'already_credited', 'error', 'This account is already credited to someone.');
  end if;

  /*
    The gate that replaced the seven-day rule. Any row here means this
    account has been through checkout at least once — including a
    cancelled one, because somebody coming back is a returning customer
    rather than a new referral. Before that first subscription, an
    account's age is nobody's business: a player who has been on the
    free OS for a year and is finally pushed into paying by a team-mate
    is the most valuable conversion the programme can produce.
  */
  if exists (select 1 from subscriptions where user_id = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'already_subscribed', 'error', 'Referral codes apply before your first subscription.');
  end if;

  insert into referrals (code, referrer_id, referred_id, status)
  values (v_code, v_referrer, auth.uid(), 'pending');

  return jsonb_build_object('ok', true, 'reason', 'applied');
end;
$$;

-- ---------- the joiner credit: claim, and give back -----------

/*
  Claim the right to credit this joiner, once.

  The UPDATE's own WHERE is the lock: `joiner_credited_at is null` can
  be true for exactly one statement, so two webhook deliveries racing —
  and they do race, because `customer.subscription.created` and
  `.updated` arrive together and Stripe retries both — cannot each come
  away believing they owe the money. The caller pays only on `claimed`.
*/
create or replace function public.claim_joiner_credit(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update referrals
     set joiner_credited_at = now()
   where referred_id = p_user
     and status = 'converted'
     and joiner_credited_at is null
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'claimed', false);
  end if;
  return jsonb_build_object('ok', true, 'claimed', true, 'referral', v_id);
end;
$$;

/*
  Hand the claim back when the Stripe write fails. Without this, a
  transient Stripe error would mark the month paid and the joiner would
  never receive it — the failure mode the whole feature exists to stop.
  Same shape as releaseFeature() in lib/billing/meter.ts.
*/
create or replace function public.release_joiner_credit(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update referrals
     set joiner_credited_at = null
   where referred_id = p_user
     and joiner_credited_at is not null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- grants -------------------------------------------

/*
  CREATE OR REPLACE resets a function's grants to the PUBLIC default —
  the trap migration 0012 existed to close, and it applies to every
  function this file rewrites.
*/
revoke execute on function public.attribute_referral(text) from anon, public;
grant  execute on function public.attribute_referral(text) to authenticated;

/*
  The two credit functions are the money path, so they follow
  convert_referral exactly: no client role may call them. "This person
  is owed a month" is settled off a signed Stripe webhook holding the
  service key, or it is not settled at all.
*/
revoke execute on function public.claim_joiner_credit(uuid)   from anon, public, authenticated;
revoke execute on function public.release_joiner_credit(uuid) from anon, public, authenticated;

notify pgrst, 'reload schema';
