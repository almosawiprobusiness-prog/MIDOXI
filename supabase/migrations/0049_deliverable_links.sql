-- ============================================================
-- MIDO XI — 0049: a delivered deliverable gets a link
--
-- Until now "delivered" was a status and nothing more: the queue
-- said the work was with the client and nothing had actually
-- reached them. This is the link that makes it true.
--
-- MODELLED ON 0022 (report_shares), DELIBERATELY. That file
-- worked out the rules for letting a document leave the building
-- and they apply here unchanged:
--
--   · Every link expires. There is no "never" — "I'll revoke it
--     later" is not a thing anyone does.
--   · The token is the only credential, so it is unguessable and
--     derived from nothing about the club.
--   · Absent, expired, revoked and not-yet-delivered all look the
--     same to a reader. Telling a stranger a token "has expired"
--     confirms it was once real.
--
-- WHY THE COLUMNS LIVE ON THE DELIVERABLE rather than in a
-- shares table of their own: a deliverable has at most one client
-- link, and the link's whole meaning is "this deliverable
-- reached the client". Splitting them would let the two disagree
-- — a live link on work that was never approved is precisely the
-- state the review gate exists to make impossible.
--
-- Safe to re-run.
-- ============================================================

alter table client_deliverables add column if not exists share_token text;
alter table client_deliverables add column if not exists share_expires_at timestamptz;
alter table client_deliverables add column if not exists share_revoked_at timestamptz;

/*
  Unique so a minted token can never collide, and partial so the many rows
  with no link do not compete for it.
*/
create unique index if not exists client_deliverables_token_idx
  on client_deliverables (share_token)
  where share_token is not null;

/*
  THE INVARIANT THAT MATTERS. A link may only exist on delivered work.

  The application mints the token inside the same move that sets `delivered`,
  and the state machine has no edge to `delivered` except from `approved`. This
  says the same thing in the one layer that cannot be called around: if there
  is a token, the row is delivered, and it has an expiry. Unreviewed work
  cannot acquire a live link by any path.
*/
alter table client_deliverables
  drop constraint if exists client_deliverables_link_only_when_delivered;

alter table client_deliverables
  add constraint client_deliverables_link_only_when_delivered
  check (
    share_token is null
    or (status = 'delivered' and share_expires_at is not null)
  );

comment on column client_deliverables.share_token is
  'The client''s only credential for reading this deliverable, at /d/<token>. Null until delivered. Unguessable and derived from nothing about the club — it must be safe to appear in any log that records URLs.';

comment on column client_deliverables.share_expires_at is
  'Every link expires; there is no never. Enforced together with the token by client_deliverables_link_only_when_delivered.';

comment on column client_deliverables.share_revoked_at is
  'Set to withdraw a link early. A revoked link reads exactly like one that never existed.';

/*
  The reader is not signed in, so resolution happens through the service role
  in `lib/data/deliverable-links.ts` — one boring lookup by token, exactly as
  0022 does it. Nothing here is readable by anon, and the existing owner
  policy from 0047 continues to cover the authenticated side.
*/
revoke all on client_deliverables from anon;
revoke all on client_deliverables from public;

notify pgrst, 'reload schema';
