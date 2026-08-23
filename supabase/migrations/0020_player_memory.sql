-- ============================================================
-- MIDO XI — 0020: what MIDO remembers about you
--
-- Today MIDO does not remember anything. It re-reads SQL on every
-- call and reassembles context from scratch, which means a player
-- who explained their ankle in March is asked about it again in
-- April, and a drill that did not work gets recommended twice.
--
-- This is the table that fixes it. Deliberately NOT a vector
-- store:
--
--   · At this size, semantic search over a few dozen sentences
--     solves a problem nobody has. A player has ten to thirty
--     facts, not ten thousand.
--
--   · Typed rows can be shown to the player, edited by them and
--     deleted by them. An embedding cannot be read, corrected or
--     argued with — and a memory the subject cannot inspect is a
--     file kept on somebody, which is not what this is.
--
--   · They can be reasoned about in code. "Has this been tried
--     before" is a query, not a similarity score.
--
-- The whole table is injected into the system prompt, which is
-- already cached for an hour — so remembering costs approximately
-- nothing per call.
--
-- Safe to re-run.
-- ============================================================

create table if not exists player_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  /*
    What kind of thing this is. The kinds are the ones that change
    what MIDO should SAY, which is the only reason to store them:

      weakness    something to keep working on
      strength    something to build around, and not to "fix"
      constraint  what they can actually do — facilities, time, body
      tried       something attempted, and how it went. The one that
                  stops MIDO recommending the same drill twice.
      context     a fact about their situation: a position change,
                  a new club, a step up in level
      coach       what someone else has told them
  */
  kind text not null check (kind in ('weakness','strength','constraint','tried','context','coach')),

  -- One sentence. A memory that needs a paragraph is a note, and
  -- notes belong on a goal.
  body text not null check (length(trim(body)) between 3 and 400),

  -- Ties it to the curated graph when it maps, so a film read
  -- about the same concept can be told what is already known.
  concept text,

  /*
    'self' — the player wrote it.
    'mido' — MIDO proposed it FROM THE RECORD and the player
             confirmed. Never written without confirmation, and
             never inferred by a model: proposals are derived
             deterministically from evidence that already exists,
             so a memory can always be traced to something real.
  */
  source text not null default 'self' check (source in ('self','mido')),

  -- What the proposal was based on, in the player's own data.
  because text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_memory_user_idx on player_memory (user_id, updated_at desc);
create index if not exists player_memory_concept_idx
  on player_memory (user_id, concept) where concept is not null;

/*
  One of each thing, per player. Re-confirming a proposal updates
  the row it already made rather than stacking duplicates that
  would then all be injected into the same prompt.
*/
/*
  Plain columns, not an expression.

  This was `(user_id, kind, lower(trim(body)))`, which reads better and does
  not work: `addMemory` upserts with `onConflict: "user_id,kind,body"`, and
  PostgREST can only target a constraint over those exact columns — an
  expression index is not addressable that way, so every confirm would have
  failed at runtime.

  The adapter trims before writing, so the only case this misses is the same
  sentence saved in different capitalisation. That produces a duplicate the
  player can see and delete, which is a far better failure than an upsert that
  cannot find its conflict target.
*/
-- Dropped first, because the first run of this migration created it over
-- `lower(trim(body))` and `if not exists` would leave that in place — the same
-- trap that broke 0019: the guard is on the name, not the shape.
drop index if exists player_memory_unique;
create unique index player_memory_unique
  on player_memory (user_id, kind, body);

alter table player_memory enable row level security;

drop policy if exists player_memory_owner on player_memory;
create policy player_memory_owner on player_memory
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/*
  No coach policy, on purpose.

  Everything else a coach can see about a linked player is
  something the player entered as football: matches, clips, goals.
  Memory is different in kind — it holds "cannot get to a gym",
  "tried this and it did not help", "was moved to six and hates
  it". Making that readable by a coach turns a tool the player
  keeps for themselves into a file kept about them, and they would
  stop writing honestly in it within a week.

  If sharing is ever wanted it should be per-memory and opt-in,
  which is a different feature and a different table.
*/

comment on table player_memory is
  'What MIDO remembers about one player. Owner-only by design — no coach or staff policy. Every row is visible and editable by the player it is about.';

-- Supabase default privileges grant `anon` a direct SELECT by name
-- on anything new here, and revoking from PUBLIC does not remove
-- that. Both, then grant back what is intended. (0011, 0017.)
revoke all on player_memory from anon;
revoke all on player_memory from public;
grant select, insert, update, delete on player_memory to authenticated;

notify pgrst, 'reload schema';
