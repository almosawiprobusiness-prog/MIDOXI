-- ============================================================
-- MIDO XI — 0021: take the directory functions away from anon
--
-- Third time. Same trap.
--
-- 0019 ended with:
--
--     revoke all on function remember_club(...)  from public;
--     grant execute on function remember_club(...) to authenticated;
--
-- and a comment above it explaining the PUBLIC-grant trap in
-- detail. It then fell into the OTHER half of the same trap:
-- Supabase's default privileges grant EXECUTE to `anon` and
-- `authenticated` BY NAME, and revoking from PUBLIC does not
-- touch a named grant.
--
-- Verified from outside with the anon key: `anon` reached the
-- function body and was stopped by its own `auth.uid() is null`
-- guard, returning "must be signed in" rather than a permission
-- error.
--
-- SEVERITY: not a hole. The guard is real, `anon` has no
-- `auth.uid()`, and no row can be written by an unauthenticated
-- caller. This is defence in depth being restored — and a comment
-- in 0019 being made true, which matters more than it sounds,
-- because the next person to read it would believe it.
--
-- The lesson, written down properly this time:
--
--     A grant may come from PUBLIC *or* from a named role, and a
--     revoke only removes the one it names. Revoke from BOTH, then
--     grant back, then check from outside with the anon key.
--     0011 revoked the roles and missed PUBLIC. 0017 revoked
--     PUBLIC and missed the roles. 0019 did it again.
--
-- Safe to re-run.
-- ============================================================

revoke all on function remember_club(text, text, text)   from anon;
revoke all on function remember_club(text, text, text)   from public;
revoke all on function remember_league(text, text)       from anon;
revoke all on function remember_league(text, text)       from public;

-- Re-stated rather than assumed: the revokes above must not be
-- able to leave the app without the grant it needs.
grant execute on function remember_club(text, text, text) to authenticated;
grant execute on function remember_league(text, text)     to authenticated;

notify pgrst, 'reload schema';
