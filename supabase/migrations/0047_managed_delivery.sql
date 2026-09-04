-- ============================================================
-- MIDO XI — 0047: the Managed tier's branding and review gate
--
-- Two things the `managed` tier needs that the self-serve one
-- does not:
--
--   1. The client's identity, so a deliverable goes out in their
--      colours. `organizations` already carries name, short_name
--      and crest_url; this adds the colour.
--
--   2. A review gate. Managed is sold as work we did. If model
--      output reaches a paying club unread, the tier is selling
--      unreviewed generation at ten times the self-serve price,
--      and the first bad session plan is the client's to find.
--
-- WHY THE GATE IS IN THE DATABASE AND NOT ONLY IN TYPESCRIPT.
-- `lib/data/deliverable-types.ts` holds the state machine and
-- `lib/data/deliverables.ts` refuses illegal moves. Both are
-- callable-around. The CHECK below is not: whatever writes to
-- this table, a row cannot hold a status that is not one of the
-- five, and `delivered_at` cannot be set on a row that is not
-- delivered. The database is the layer that cannot be forgotten.
--
-- Safe to re-run.
-- ============================================================

-- ---------- 1. the client's colour ----------------------------

/*
  Nullable on purpose, and null is a real answer meaning "they have not
  chosen one" — `lib/brand/identity.ts` falls back to MIDO's accent, which
  renders, rather than to an empty string, which does not.

  No CHECK on the format. The application normalises hex before writing and
  stores null for anything unparseable; a constraint here would turn a
  cosmetic mistake into a failed save of the whole organization row.
*/
alter table organizations add column if not exists brand_primary text;

comment on column organizations.brand_primary is
  'The club''s colour as hex (#rrggbb), for Managed deliverables. Null means unset — documents fall back to MIDO''s own accent. A legible variant is derived at render time by lib/brand/identity.ts readableOn(), because plenty of real club colours are unreadable on the product''s ink ground.';

-- ---------- 2. the review gate --------------------------------

/*
  A deliverable REFERENCES the work rather than copying it —
  (entity_type, entity_id) points at a session plan, a board, a report — the
  same shape `board_links` uses. Copying would let a delivered document drift
  away from the thing it claims to deliver.

  There is deliberately no foreign key on entity_id: it addresses several
  different tables, and 0044 made the same call for board links. The
  application is the integrity boundary there.
*/
create table if not exists client_deliverables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  title text not null,
  kind text not null default 'report'
    check (kind in ('session_plan', 'tactical_board', 'report', 'analysis')),

  entity_type text,
  entity_id text,

  /*
    The gate, as data. `draft` is the only default there can be: a row that
    could be created already-approved would be a way in around the reviewer,
    which is the one thing this table exists to prevent.
  */
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'changes_requested', 'approved', 'delivered')),

  review_note text not null default '',

  /* Whether MIDO's AI drafted it. Kept because "who wrote this" is a
     question a client is entitled to ask about work they paid for. */
  ai_drafted boolean not null default false,

  created_at   timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  delivered_at timestamptz,

  /*
    The invariant that makes the timestamp trustworthy: delivered_at is set
    if and only if the row is delivered. Without this a row could carry a
    delivery date it never had, and the audit trail would be decoration.
  */
  constraint client_deliverables_delivered_consistent
    check ((status = 'delivered') = (delivered_at is not null))
);

create index if not exists client_deliverables_org_idx
  on client_deliverables (org_id, created_at desc);

/* The queue's own question — "what is waiting on a person" — asked often. */
create index if not exists client_deliverables_open_idx
  on client_deliverables (org_id, status)
  where status <> 'delivered';

comment on table client_deliverables is
  'Work MIDO drafted for a Managed client, and its passage through review. Nothing reaches the client below status ''delivered'', and ''delivered'' is only reachable from ''approved'' — see lib/data/deliverable-types.ts for the state machine this table stores.';

-- ---------- 3. RLS -------------------------------------------

alter table client_deliverables enable row level security;

/*
  Owner-scoped through the organization, exactly as Club OS tables are.

  NOTE FOR WHEN MANAGED HAS A SECOND CLIENT. Today the operator and the org
  owner are the same person, so one policy covers both. The moment MIDO
  operates an org it does not own, this needs a second policy for the operator
  and the client's own read must be narrowed to `status = 'delivered'` — the
  application already routes client-facing reads through `listForClient()` so
  that the narrowing has one place to land.
*/
drop policy if exists "own deliverables" on client_deliverables;
create policy "own deliverables" on client_deliverables
  for all to authenticated
  using (org_id in (select id from organizations where owner_id = auth.uid()))
  with check (org_id in (select id from organizations where owner_id = auth.uid()));

revoke all on client_deliverables from anon;

notify pgrst, 'reload schema';
