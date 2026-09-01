-- ============================================================
-- MIDO XI — 0045: a board can be assigned to the person it is for
--
-- Migration 0044 left `tactical_boards` and `board_links`
-- owner-only, and said why: a cross-account read policy on a table
-- holding team tactics is not something to improvise, and
-- `visibility` recorded the intent without anything honouring it.
--
-- This is the policy that honours it, written narrowly.
--
-- WITHOUT IT, PLAYER OS CANNOT WORK. The whole point of the shared
-- board is that a coach draws the pressing trigger once and the
-- player opens the same object — not a screenshot, not a copy. With
-- owner-only RLS a player can see only boards they drew themselves,
-- which is a notebook, not a development system.
--
-- WHAT IS EXPOSED, EXACTLY. A board becomes readable by one other
-- account only when ALL of these hold:
--
--   · a `board_links` row points at it, AND
--   · that row's role is 'assigned' — not 'illustrates', so a board
--     attached to a session block or an opposition report is never
--     caught by this, AND
--   · its entity is a `coach_players` row whose player_id is the
--     reader, or a `trainer_athletes` row whose athlete_id is the
--     reader.
--
-- So the coach decides, per board, per person, by an explicit act.
-- Nothing is shared by being in a squad, and nothing a coach merely
-- drew becomes visible to anybody.
--
-- READ ONLY. These are `for select` policies. The assignee can open
-- the board and cannot change it; edits belong to the owner, which
-- is what keeps one board one truth.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the link itself ----------------------------------

/*
  The assignee must be able to read the row that assigns the board,
  or the board query below has nothing to join through.

  Restricted to the two bridge types AND role='assigned' for the same
  reason as the board policy: a link is metadata about a coach's
  planning, and only the assignment half is anyone else's business.
*/
drop policy if exists board_links_assigned_read on board_links;
create policy board_links_assigned_read on board_links
  for select to authenticated
  using (
    role = 'assigned'
    and (
      (
        entity_type = 'squad_player'
        and exists (
          select 1 from coach_players cp
          where cp.id = board_links.entity_id
            and cp.player_id = auth.uid()
        )
      )
      or (
        entity_type = 'athlete'
        and exists (
          select 1 from trainer_athletes ta
          where ta.id = board_links.entity_id
            and ta.athlete_id = auth.uid()
        )
      )
    )
  );

-- ---------- the board ----------------------------------------

/*
  Permissive policies are ORed, so this sits alongside the owner
  policy from 0006 rather than replacing it: you can still read
  everything you own, and now also anything explicitly assigned to
  you.

  The `role = 'assigned'` test is repeated here rather than trusted
  from the policy above. Policies are not a chain — a future change
  to one must not silently widen the other.
*/
drop policy if exists tactical_boards_assigned_read on tactical_boards;
create policy tactical_boards_assigned_read on tactical_boards
  for select to authenticated
  using (
    exists (
      select 1 from board_links bl
      where bl.board_id = tactical_boards.id
        and bl.role = 'assigned'
        and (
          (
            bl.entity_type = 'squad_player'
            and exists (
              select 1 from coach_players cp
              where cp.id = bl.entity_id
                and cp.player_id = auth.uid()
            )
          )
          or (
            bl.entity_type = 'athlete'
            and exists (
              select 1 from trainer_athletes ta
              where ta.id = bl.entity_id
                and ta.athlete_id = auth.uid()
            )
          )
        )
    )
  );

/*
  Supporting index. Both policies filter links by role before joining,
  and without this every assigned-board read scans board_links.
*/
create index if not exists board_links_assigned_idx
  on board_links (role, entity_type, entity_id)
  where role = 'assigned';

comment on policy tactical_boards_assigned_read on tactical_boards is
  'Read-only access for the one person a board was explicitly assigned to, via a board_links row with role=assigned pointing at their coach_players or trainer_athletes record. Nothing is shared by squad membership; a board attached to a session or an opposition report is not covered.';

notify pgrst, 'reload schema';
