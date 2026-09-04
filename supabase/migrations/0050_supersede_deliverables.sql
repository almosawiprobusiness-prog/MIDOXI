-- ============================================================
-- MIDO XI — 0050: superseding delivered work
--
-- The product already tells people to do this. `transitionIssue`
-- in lib/data/deliverable-types.ts answers any attempt to edit
-- delivered work with:
--
--   "This is already with the client. Supersede it with a new
--    version rather than editing it."
--
-- and then gives them no way to. So the honest options were to
-- build it or stop saying it, and the instruction is right.
--
-- WHY IT IS A CORRECTNESS PROBLEM AND NOT A CONVENIENCE. Without
-- this, correcting delivered work means preparing the same board
-- or session again — which creates an unrelated deliverable and
-- leaves the first one's link LIVE. The client then holds two
-- links, one of them showing work we have already decided was
-- wrong, and nothing on either says which is current. Superseding
-- ties the two together and withdraws the old link in the same
-- act.
--
-- Safe to re-run.
-- ============================================================

alter table client_deliverables
  add column if not exists superseded_by uuid references client_deliverables(id) on delete set null;

create index if not exists client_deliverables_superseded_idx
  on client_deliverables (superseded_by)
  where superseded_by is not null;

/*
  Only delivered work can be superseded.

  Anything earlier can simply be edited — the state machine already allows a
  draft to be rewritten and an approval to be pulled back. Superseding is the
  answer to the one state that cannot be walked back, because somebody outside
  the building has already read it.
*/
alter table client_deliverables
  drop constraint if exists client_deliverables_supersede_only_delivered;

alter table client_deliverables
  add constraint client_deliverables_supersede_only_delivered
  check (superseded_by is null or status = 'delivered');

/*
  A document cannot supersede itself. Cheap to write, and the alternative is a
  row that reports itself as both current and replaced.
*/
alter table client_deliverables
  drop constraint if exists client_deliverables_supersede_not_self;

alter table client_deliverables
  add constraint client_deliverables_supersede_not_self
  check (superseded_by is null or superseded_by <> id);

comment on column client_deliverables.superseded_by is
  'The deliverable that replaced this one. Set only on delivered work — anything earlier can just be edited. Superseding also withdraws this row''s client link, so a reader cannot be left holding a live link to work we have replaced.';

notify pgrst, 'reload schema';
