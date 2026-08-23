-- ============================================================
-- MIDO XI — 0023: the community becomes a feed
--
-- What was here was a forum: title, body, tags, and a clip
-- mentioned in passing. This makes the media the post and the
-- words the caption, adds a follow graph and profile grids, and
-- brings the two things a public feed with young people on it
-- must have from the first day rather than the second — blocking
-- and reporting.
--
-- A NOTE ON VISIBILITY. Posts default to every signed-in user,
-- which is the owner's decision and is what `visibility` defaults
-- to below. The COLUMN exists anyway, and the followers-only value
-- is already accepted, so tightening that default later is a
-- one-line change in the application rather than another
-- migration against a table full of live posts. Building the
-- mechanism costs nothing today; retrofitting it would cost a lot.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · posts become media-first ─────────────────────────────

-- The old shape survives: `title` and `body` stay, because rows
-- already exist and a forum post is still a legitimate thing to
-- write. New posts use `caption` and hang media off it.
alter table community_posts add column if not exists caption text;
alter table community_posts add column if not exists media_url text;
alter table community_posts add column if not exists media_kind text;
alter table community_posts add column if not exists media_width int;
alter table community_posts add column if not exists media_height int;

do $$ begin
  alter table community_posts
    add constraint community_posts_media_kind_check
    check (media_kind is null or media_kind in ('photo','video','youtube'));
exception when duplicate_object then null;
end $$;

/*
  Who may see it.

  'public'    every signed-in user. The current behaviour and the
              default, deliberately chosen.
  'followers' only accounts that follow the author.

  The check accepts both from today even though only one is used,
  so the product can change its mind without a migration.
*/
alter table community_posts add column if not exists visibility text not null default 'public';

do $$ begin
  alter table community_posts
    add constraint community_posts_visibility_check
    check (visibility in ('public','followers'));
exception when duplicate_object then null;
end $$;

-- `title` was NOT NULL, which a caption-only post cannot satisfy.
alter table community_posts alter column title drop not null;
alter table community_posts alter column body  drop not null;

-- A post has to be SOMETHING: media, or words. An empty row in a
-- feed is a gap nobody can explain.
do $$ begin
  alter table community_posts
    add constraint community_posts_not_empty
    check (
      media_url is not null
      or nullif(trim(coalesce(caption, '')), '') is not null
      or nullif(trim(coalesce(body, '')), '') is not null
    );
exception when duplicate_object then null;
end $$;

create index if not exists community_posts_author_idx on community_posts (user_id, created_at desc);
create index if not exists community_posts_feed_idx   on community_posts (created_at desc);

-- ── 2 · the follow graph ─────────────────────────────────────

create table if not exists follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Following yourself makes your own feed a hall of mirrors and
  -- inflates every count by one.
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on follows (following_id, created_at desc);
create index if not exists follows_follower_idx  on follows (follower_id, created_at desc);

alter table follows enable row level security;

/*
  Follows are public information — that is what makes a follower
  count possible — but only you can create or remove your own.
*/
drop policy if exists follows_read on follows;
create policy follows_read on follows for select to authenticated using (true);

drop policy if exists follows_write on follows;
create policy follows_write on follows for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists follows_delete on follows;
create policy follows_delete on follows for delete to authenticated
  using (follower_id = auth.uid());

-- ── 3 · blocking ─────────────────────────────────────────────

/*
  One person deciding they do not want to see, or be seen by,
  another. Enforced in the feed query in both directions: a block
  hides their posts from you AND yours from them, because a block
  that only works one way is a block that does not work.
*/
create table if not exists user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on user_blocks (blocked_id);

alter table user_blocks enable row level security;

/*
  Only you can see who YOU have blocked, and only you can change
  it. Deliberately not readable by the blocked person: a list of
  who has blocked you is an invitation to go and find out why.
*/
drop policy if exists user_blocks_owner on user_blocks;
create policy user_blocks_owner on user_blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ── 4 · reporting ────────────────────────────────────────────

create table if not exists post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('inappropriate','harassment','spam','not-football','safeguarding','other')),
  detail text,
  -- Reviewed by an admin. Nothing automated acts on this: a report
  -- is a person asking another person to look, not a vote that
  -- deletes a post.
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- One report per person per post. A report is a signal, not a
  -- score to be run up.
  unique (post_id, reporter_id)
);

create index if not exists post_reports_open_idx on post_reports (created_at desc) where reviewed_at is null;

alter table post_reports enable row level security;

/*
  You may file one and see your own. You may not read anybody
  else's — a reporting queue readable by the reported is not a
  reporting queue. Admin review happens through the service role.
*/
drop policy if exists post_reports_own on post_reports;
create policy post_reports_own on post_reports for select to authenticated
  using (reporter_id = auth.uid());

drop policy if exists post_reports_file on post_reports;
create policy post_reports_file on post_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ── 5 · grants ───────────────────────────────────────────────
-- Both PUBLIC and the named roles, then grant back. A grant may
-- come from either and a revoke removes only the one it names —
-- the trap 0011, 0017 and 0019 each fell into.

revoke all on follows      from anon; revoke all on follows      from public;
revoke all on user_blocks  from anon; revoke all on user_blocks  from public;
revoke all on post_reports from anon; revoke all on post_reports from public;

grant select, insert, delete on follows      to authenticated;
grant select, insert, delete on user_blocks  to authenticated;
grant select, insert         on post_reports to authenticated;

comment on table follows is
  'Who follows whom. Public to read (a follower count needs that), writable only by the follower.';
comment on table user_blocks is
  'Enforced in BOTH directions by the feed query — a block that only hides one side is not a block. Not readable by the blocked person.';
comment on table post_reports is
  'A person asking a person to look. Nothing automated acts on these; review happens through the service role.';

notify pgrst, 'reload schema';
