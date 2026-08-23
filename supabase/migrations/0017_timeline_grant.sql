-- ============================================================
-- MIDO XI — 0017: take the timeline away from anon
--
-- 0015 ended with:
--
--     revoke all on player_timeline from public;
--     grant select on player_timeline to authenticated;
--
-- and its comment claimed "`anon` is not given select". Verified
-- from outside with the anon key, that claim was false: anon can
-- query the view.
--
-- Why. Supabase configures ALTER DEFAULT PRIVILEGES so that
-- anything new in the public schema is granted to `anon` and
-- `authenticated` directly, by name. `revoke ... from public`
-- removes the PUBLIC grant and does nothing at all to a direct
-- grant held by a named role. So the revoke ran without error
-- and changed nothing.
--
-- This is the same mistake as migration 0011, in mirror image.
-- There, a revoke named the roles and missed PUBLIC; here it
-- named PUBLIC and missed the roles. Both ran clean. Both were
-- found only by asking from the other side.
--
-- WHAT WAS NOT WRONG: nothing leaked. `security_invoker = true`
-- did land, so RLS applies through the view — anon saw zero of
-- six rows, and so did a freshly created account that owns
-- nothing. This is defence in depth being restored, not a hole
-- being closed. A timeline is the most identifying object in the
-- product and the anon role has no business being able to name
-- it at all.
--
-- Safe to re-run. Verify with: npm run verify:timeline
-- ============================================================

revoke all on player_timeline from anon;
revoke all on player_timeline from public;

-- Re-stated rather than assumed: the revokes above must not be
-- able to leave the app without the one grant it needs.
grant select on player_timeline to authenticated;

comment on view player_timeline is
  'Chronological spine of one player''s football record. A view over existing tables — never written to. security_invoker=true so RLS on the underlying tables applies to whoever selects. Granted to authenticated only; anon is revoked explicitly, because Supabase default privileges grant it by name and a revoke from PUBLIC does not remove that.';

notify pgrst, 'reload schema';

/*
  Worth knowing, deliberately not done here: every other table in this schema
  carries the same direct `anon` grant, for the same reason. They are all
  protected by RLS, so this is not an outstanding hole — and changing the
  project's default privileges is a schema-wide decision that does not belong
  inside a migration about the timeline.
*/
