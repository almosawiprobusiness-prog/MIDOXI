-- ============================================================
-- MIDO XI — 0040: saving posts, and posts that know their kind
--
-- Two additions the social refinement pass needs.
--
-- SAVES. The most development-shaped social verb: a player sees a
-- film breakdown or a training focus and keeps it to come back to.
-- Saves are PRIVATE — who saved what is nobody's business but the
-- saver's, and a save count is deliberately not surfaced anywhere,
-- because the moment it is a number it becomes a scoreboard.
--
-- KIND. Posts now carry what they are about — training, match,
-- film, study, development, milestone — so the feed can offer the
-- quiet filter row without guessing from tags. Nullable: an
-- ordinary thought needs no category, and old rows stay honest
-- rather than being backfilled with a guess.
--
-- Follows 0023's conventions exactly: create-if-not-exists,
-- drop-policy-then-create so the file can run twice, and revoke
-- from BOTH anon and public before granting authenticated.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · saves ────────────────────────────────────────────────

create table if not exists post_saves (
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- "My saved posts, newest first" is the only query this table gets.
create index if not exists post_saves_mine_idx on post_saves (user_id, created_at desc);

alter table post_saves enable row level security;

/*
  Owner-only in every direction. Unlike reactions (public, they are
  the post's count) a save is a private bookmark: readable, writable
  and deletable only by the person who made it.
*/
drop policy if exists post_saves_owner on post_saves;
create policy post_saves_owner on post_saves for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on post_saves from anon; revoke all on post_saves from public;
grant select, insert, delete on post_saves to authenticated;

comment on table post_saves is
  'Private bookmarks. No save counts anywhere — a number would turn keeping an idea into a scoreboard.';

-- ── 2 · post kind ────────────────────────────────────────────

alter table community_posts add column if not exists kind text;

do $$ begin
  alter table community_posts
    add constraint community_posts_kind_check
    check (kind is null or kind in ('training','match','film','study','development','milestone'));
exception when duplicate_object then null;
end $$;

comment on column community_posts.kind is
  'What the post is about, set by the composer. Null = a general post; old rows are never backfilled with a guess.';

notify pgrst, 'reload schema';
