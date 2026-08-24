-- ============================================================
-- MIDO XI — 0025: the grants 0024 thought it had
--
-- 0024 says the meeting history is append-only and claims a grant
-- enforces it: "No update, no delete: the history is append-only,
-- and a grant is a more honest way to say that than a comment."
--
-- It was a comment.
--
-- 0024 revoked from `anon` and `public` and then granted
-- `select, insert` to `authenticated` — but it never revoked
-- anything FROM `authenticated`. Supabase's default privileges
-- already grant ALL on public-schema tables to that role, so the
-- grant line added nothing that was not there, and a signed-in
-- account has held UPDATE and DELETE on meeting_events since the
-- migration ran.
--
-- Caught by probing it: an UPDATE against meeting_events as a real
-- signed-in participant returned HTTP 200 with zero rows affected.
-- Had the privilege genuinely been absent, Postgres would have
-- raised permission denied and PostgREST would have answered 403.
-- 200 means the privilege check PASSED and only RLS — which has no
-- update or delete policy — stopped the write.
--
-- That is still a real defence, and nothing was ever rewritable in
-- practice. But it rests on the continued absence of a policy
-- rather than on the absence of a privilege, which means one
-- careless `for all` policy turns an append-only audit log into an
-- editable one with nothing to stop it. The privilege is the floor;
-- RLS is meant to be the wall on top of it.
--
-- THE RULE, RESTATED FOR THE FIFTH TIME IN THIS SCHEMA: a revoke
-- removes only the grant it names. `anon`, `public` AND
-- `authenticated` all have to be named, and only then is what is
-- granted back the whole of what the role holds.
--
-- Safe to re-run.
-- ============================================================

-- Take everything back from every role that could hold it, then
-- hand back exactly what each table needs and nothing else.

revoke all on meetings          from anon, public, authenticated;
revoke all on meeting_proposals from anon, public, authenticated;
revoke all on meeting_agenda    from anon, public, authenticated;
revoke all on meeting_events    from anon, public, authenticated;

-- Both parties read, create, and edit a meeting; the organiser alone
-- may delete one, and only while it is still unanswered — that part
-- is RLS, because it depends on the row.
grant select, insert, update, delete on meetings to authenticated;

-- A proposal is answered by moving its status, never removed. Keeping
-- the declined and superseded rows is what makes the history of a
-- rescheduling readable at all.
grant select, insert, update on meeting_proposals to authenticated;

-- The agenda is shared, so both parties may write and reorder; the
-- author-only rule on deleting is RLS, for the same reason.
grant select, insert, update, delete on meeting_agenda to authenticated;

/*
  And the one this migration exists for.

  No UPDATE. No DELETE. Not for anybody, including the person who
  wrote the row. An audit trail that its subject can edit is not an
  audit trail, and from here that is enforced by the privilege — so
  a future policy cannot loosen it by accident.
*/
grant select, insert on meeting_events to authenticated;

comment on table meeting_events is
  'Append-only, enforced by the ABSENCE of an update/delete privilege — not by policy, and not by comment. 0024 claimed this and did not have it: it revoked from anon and public but never from authenticated, which holds ALL by Supabase default.';

notify pgrst, 'reload schema';
