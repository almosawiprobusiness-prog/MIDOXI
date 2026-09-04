-- ============================================================
-- MIDO XI — 0051: a session remembers why it exists
--
-- Closing the loop's last edge exposed two things the record
-- was throwing away.
--
-- 1. WHY A BLOCK IS THERE. The session engine produces a `why`
--    for every block and the draft dialog shows it. Nothing
--    persisted it, so the reasoning survived exactly as long as
--    the modal was open. A player opening the session on
--    Thursday saw the work and not the argument for it.
--
-- 2. WHAT THE SESSION WAS BUILT FROM. A session drafted around a
--    development priority had no memory of that priority. The
--    per-block `source` label is close, but it is a label on a
--    block, not the session's own provenance, and it cannot
--    answer "why am I doing this at all".
--
-- WHY REAL COLUMNS. `training_blocks` already carries plan text
-- on columns meant for physical work — notes→detail, rest→work,
-- distance→source (see toPlanBlock in lib/data/training.ts).
-- That reuse is old and works, but adding a fourth semantic to a
-- physical-metrics column would make the table actively
-- misleading. These are named for what they hold.
--
-- Nothing is required. Sessions written before today simply have
-- no provenance, and the UI says nothing rather than inventing
-- a reason after the fact.
--
-- Safe to re-run.
-- ============================================================

/*
  The argument for a block, as the engine wrote it. Kept beside the block
  rather than derived later: it is what the model actually said at the time,
  and regenerating it afterwards would be a different claim wearing the same
  words.
*/
alter table training_blocks add column if not exists why text;

comment on column training_blocks.why is
  'Why this block is in the session, as the session engine wrote it at draft time. Shown to the player when they run the session — the work without the reason is a drill list.';

/*
  The session's own provenance: the focus it was built around.

  `built_from_key` is the engine's source key (goal:<id>, film:<concept>,
  study:<subject>, capture:<id>) and `built_from_label` is the human sentence
  resolved at draft time. Both, because the key can go stale — a goal may be
  achieved or deleted — and a session that can no longer name its origin
  should still be able to say what it was for.
*/
alter table training_sessions add column if not exists built_from_key text;
alter table training_sessions add column if not exists built_from_label text;

comment on column training_sessions.built_from_key is
  'The session engine focus this session was built around: goal:<id>, film:<concept>, study:<subject> or capture:<id>. Null for sessions a player wrote themselves.';

comment on column training_sessions.built_from_label is
  'The human label for built_from_key, resolved when the session was drafted. Stored rather than looked up so a session can still say what it was for after the goal behind it is achieved or deleted.';

/*
  A label without a key would be a claim about provenance with nothing behind
  it; a key without a label is fine — the UI can fall back to the raw key.
*/
alter table training_sessions
  drop constraint if exists training_sessions_provenance_pair;

alter table training_sessions
  add constraint training_sessions_provenance_pair
  check (built_from_label is null or built_from_key is not null);

/* Answering "what work came out of this priority" without a scan. */
create index if not exists training_sessions_built_from_idx
  on training_sessions (built_from_key)
  where built_from_key is not null;

notify pgrst, 'reload schema';
