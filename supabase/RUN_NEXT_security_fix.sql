-- ============================================================
-- MIDO XI — RUN THIS NEXT (security fix)
--
-- Migration 0012 only. It closes a hole left by 0011:
-- `convert_referral` and `void_referral` were callable by
-- anyone holding the anon key, because revoking from
-- `anon, authenticated` does not remove Postgres's default
-- grant to PUBLIC.
--
-- Paste into the Supabase SQL editor and run. Safe to re-run.
-- Afterwards: node scripts/verify-security.mjs
-- ============================================================

-- ============================================================
-- MIDO XI — 0012: actually lock the referral money-claim functions
--
-- SECURITY FIX. Migration 0011 ended with:
--
--   revoke execute on function public.convert_referral(...)
--     from anon, authenticated;
--
-- which does nothing. Postgres grants EXECUTE on a new function
-- to PUBLIC by default, and both `anon` and `authenticated`
-- inherit it through PUBLIC — so revoking from those two roles
-- leaves the PUBLIC grant standing.
--
-- The effect: `convert_referral` and `void_referral` were
-- callable by anyone holding the anon key, which ships in the
-- browser. With a user's uuid, an attacker could mark that
-- account converted and mint referral rewards, or void someone
-- else's referrals. Verified against the live database — both
-- answered an anonymous caller with 200.
--
-- These two are SECURITY DEFINER on purpose: "this person
-- started paying" is a claim only Stripe gets to make, and it is
-- made by the webhook holding the service key. Nobody else.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the two that write money claims ------------------

revoke all on function public.convert_referral(uuid, text, int) from public;
revoke all on function public.convert_referral(uuid, text, int) from anon;
revoke all on function public.convert_referral(uuid, text, int) from authenticated;

revoke all on function public.void_referral(uuid, text) from public;
revoke all on function public.void_referral(uuid, text) from anon;
revoke all on function public.void_referral(uuid, text) from authenticated;

-- The Stripe webhook uses the service key; be explicit rather than relying on
-- whatever the role happens to inherit.
grant execute on function public.convert_referral(uuid, text, int) to service_role;
grant execute on function public.void_referral(uuid, text) to service_role;

-- ---------- ripening ------------------------------------------

/*
  `ripen_referral_rewards` is idempotent and only turns conversions that have
  already survived their hold into rewards, so an anonymous call could not
  fabricate anything. But it is still a write, and a write with no caller
  identity has no business being on the anonymous surface: a signed-in user
  triggering it opportunistically is the whole design.
*/
revoke all on function public.ripen_referral_rewards() from public;
revoke all on function public.ripen_referral_rewards() from anon;
grant execute on function public.ripen_referral_rewards() to authenticated, service_role;

-- ---------- everything else, made explicit ---------------------

/*
  These are safe for an anonymous caller to reach — each either returns null
  without `auth.uid()`, or is deliberately public — but 0011 relied on the
  default PUBLIC grant to make that true, which is the same mistake in the
  other direction. State the intent instead of inheriting it.

  `record_referral_visit` genuinely must stay open to `anon`: the click on a
  referral link happens before anybody has an account.
*/
revoke all on function public.record_referral_visit(text) from public;
grant execute on function public.record_referral_visit(text) to anon, authenticated, service_role;

revoke all on function public.my_referral_code() from public;
grant execute on function public.my_referral_code() to authenticated, service_role;

revoke all on function public.attribute_referral(text) from public;
grant execute on function public.attribute_referral(text) to authenticated, service_role;

revoke all on function public.apply_referral_reward(int) from public;
grant execute on function public.apply_referral_reward(int) to authenticated, service_role;

revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated, service_role;

-- ---------- the same audit, applied to 0009 --------------------

/*
  0009's functions were never revoked from anything, so they carry the default
  PUBLIC grant too. Each one checks `auth.uid()` and refuses without it, so
  none of them was exploitable — but `accept_invite` and `set_link_scope` write
  to other people's rows, and a function like that should say who may call it
  rather than leaving it to a default.

  `preview_invite` stays open to `anon`: someone can be handed a code before
  they have an account, and it returns null for anything it does not recognise,
  so it cannot be used to enumerate invitations.
*/
revoke all on function public.preview_invite(text) from public;
grant execute on function public.preview_invite(text) to anon, authenticated, service_role;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated, service_role;

revoke all on function public.set_link_scope(text, uuid, text) from public;
grant execute on function public.set_link_scope(text, uuid, text) to authenticated, service_role;
