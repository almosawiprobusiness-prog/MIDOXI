-- ============================================================
-- MIDO XI — 0028: the grants user_preferences never got
--
-- Email is about to become a real write path against this table —
-- `updateEmailOptIn` needs it, and `notify()` reads it before every
-- send. Worth closing the same gap the last several tables were
-- caught with before building on top of it rather than after.
--
-- 0001 never issued a single revoke on `user_preferences`, so
-- `anon` and `authenticated` have held Supabase's default
-- privileges on it since the first migration. It happened to be
-- safe — the `user_preferences_self` policy filters on
-- `auth.uid()`, which is null for an anonymous request — but
-- "happened to be safe" is exactly what 0011, 0017, 0019, 0003,
-- 0024 and 0027 each got wrong before somebody looked.
--
-- No delete: every account gets exactly one row from the signup
-- trigger in 0001, and there is no honest reason to remove it
-- rather than update it.
--
-- Safe to re-run.
-- ============================================================

revoke all on user_preferences from anon, public, authenticated;
grant select, insert, update on user_preferences to authenticated;

comment on table user_preferences is
  'One row per account, created by the signup trigger in 0001. email_opt_in gates lib/notifications/notify.ts — read before every send, never assumed.';

notify pgrst, 'reload schema';
