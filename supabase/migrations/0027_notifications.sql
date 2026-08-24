-- ============================================================
-- MIDO XI — 0027: notifications, made real
--
-- `notifications` has existed since 0001 and nothing has ever
-- written to it. A coach proposes a new time, a player follows you,
-- somebody comments on your post — none of it reached anybody
-- unless they happened to be looking at the right page. This is
-- the migration that makes the table worth having.
--
-- WHO MAY WRITE ONE. 0001 gave the table an owner-only `for all`
-- policy, which means a signed-in account could write a
-- notification INTO THEIR OWN inbox but never into anybody else's —
-- and a notification is only useful when somebody ELSE'S action
-- puts it there. So the real write path is the service role, from
-- `lib/notifications/notify.ts`, and this migration closes the
-- privilege rather than relying on the 0001 policy to keep working
-- by accident. `authenticated` keeps select, update (to mark read)
-- and delete; insert is removed entirely.
--
-- THE FIFTH — no, SIXTH — time this schema has been caught granting
-- more than it revoked. 0001 never issued a single revoke on this
-- table, so `anon` and `authenticated` have held Supabase's default
-- privileges on it since the very first migration. It happened to
-- be safe in practice, because the RLS policy filters on
-- `auth.uid()` and an anonymous request has none — but "happened to
-- be safe" is exactly the gap 0011, 0017, 0019, 0003 and 0024 each
-- left open before somebody actually looked.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · who caused it, and room for detail ───────────────────

/*
  `actor_id` is who did the thing, kept apart from `user_id` (who is
  being told). Without it, showing an avatar next to a notification
  means parsing one back out of `href`, and blocking cannot be
  enforced at write time at all — `notify()` needs to know who the
  actor is to check whether the recipient has blocked them.
*/
alter table notifications add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table notifications add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists notifications_actor_idx on notifications (actor_id);

/*
  What this product actually emits. The table has held zero rows
  since 0001, so adding the constraint now costs nothing and it is
  worth having: an unrecognised `kind` typed once in a producer and
  never caught is a notification that silently cannot be labelled or
  routed by the reader.
*/
do $$ begin
  alter table notifications
    add constraint notifications_kind_check
    check (kind in (
      'meeting_proposed', 'meeting_accepted', 'meeting_declined', 'meeting_cancelled',
      'meeting_time_proposed', 'meeting_time_accepted', 'meeting_time_declined',
      'follow', 'like', 'comment'
    ));
exception when duplicate_object then null;
end $$;

-- ── 2 · grants ───────────────────────────────────────────────
-- anon, public AND authenticated, every time, because a revoke
-- removes only the role it names.

revoke all on notifications from anon, public, authenticated;

-- Read your own, mark them read, clear them. Never insert: a
-- notification is a claim that something happened, and only the
-- server that saw it happen may write one.
grant select, update, delete on notifications to authenticated;

comment on table notifications is
  'Written only by the service role via lib/notifications/notify.ts. authenticated may read, mark read and delete its own — never insert. actor_id is who caused it; notify() refuses to write across a block in either direction.';

notify pgrst, 'reload schema';
