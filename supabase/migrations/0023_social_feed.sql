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
--
-- ── WHY THIS MIGRATION CREATES TABLES 0003 ALREADY DECLARES ──
--
-- The first version of this file opened with `alter table
-- community_posts` and failed: relation does not exist. 0003 was
-- never run against this database. The community section has only
-- ever worked in demo mode, which is why nobody noticed — demo
-- mode serves an in-memory store and never touches Postgres, so
-- every route rendered fine and every test passed while the three
-- tables underneath them did not exist.
--
-- An audit of all 77 relations the migration history declares
-- found 0003 to be the only gap; the rest of the history is
-- present. So section 0 creates exactly what 0003 creates, in the
-- shape 0003 creates it. On a database where 0003 DID run, every
-- statement in section 0 is a no-op and the shape is unchanged.
--
-- The three things 0003 got wrong are fixed here rather than left
-- for whoever sets up the next environment: its policies used a
-- bare `create policy` and so could not be re-run, it never
-- revoked anon (Supabase grants the public schema to anon by
-- default, so the grant was open and only RLS stood in the way),
-- and it never granted `authenticated` explicitly.
-- ============================================================

-- ── 0 · what 0003 should have left behind ────────────────────

-- The public half of a profile. `handle` is the one the feed
-- cannot work without: it is how /app/community/[handle] resolves.
alter table player_profiles
  add column if not exists handle text unique,
  add column if not exists play_style text,
  add column if not exists favorite_players text[],
  add column if not exists strengths text[],
  add column if not exists achievements text,
  add column if not exists socials jsonb not null default '{}'::jsonb;

/*
  Posts.

  Created NULLABLE in `title` and `body` where 0003 had them NOT
  NULL, because section 1 drops those constraints two dozen lines
  below and creating them only to drop them reads like a mistake.
  On a database where 0003 ran, the drop below does the same job.

  The denormalised author and clip columns are 0003's and are kept:
  the feed still selects them, and a shared clip renders from them
  without exposing the private tables it came from.
*/
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  author_handle text,
  author_position text,
  author_avatar text,
  title text,
  body text,
  clip_id uuid references clips(id) on delete set null,
  clip_title text,
  clip_start numeric,
  clip_tags text[],
  clip_sentiment text,
  video_source text,        -- 'youtube' | 'url' | 'upload'
  video_external_id text,   -- youtube id, for public embed
  tags text[],
  created_at timestamptz not null default now()
);
create index if not exists community_posts_recent on community_posts (created_at desc);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  author_handle text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_thread on post_comments (post_id, created_at);

create table if not exists post_reactions (
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table community_posts enable row level security;
alter table post_comments  enable row level security;
alter table post_reactions enable row level security;

-- Visible to any signed-in user; only owners write. Dropped first
-- so this file can be run twice, which 0003 could not be.
drop policy if exists posts_read on community_posts;
create policy posts_read on community_posts for select to authenticated using (true);
drop policy if exists posts_owner on community_posts;
create policy posts_owner on community_posts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists comments_read on post_comments;
create policy comments_read on post_comments for select to authenticated using (true);
drop policy if exists comments_owner on post_comments;
create policy comments_owner on post_comments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reactions_read on post_reactions;
create policy reactions_read on post_reactions for select to authenticated using (true);
drop policy if exists reactions_owner on post_reactions;
create policy reactions_owner on post_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

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

/*
  And 0003's three tables, which it never granted or revoked at all.

  Supabase grants the public schema to `anon` by default, so these
  have been sitting open to the anon key since the day 0003 was
  written — reachable, and held back only by RLS having no policy
  that matches an anonymous request. That is one policy edit away
  from being a leak, and it is not the guarantee the rest of this
  schema is built on. Closed properly now: anon is refused at the
  grant, and `authenticated` is named explicitly rather than
  relying on a default privilege nobody wrote down.
*/
revoke all on community_posts from anon; revoke all on community_posts from public;
revoke all on post_comments   from anon; revoke all on post_comments   from public;
revoke all on post_reactions  from anon; revoke all on post_reactions  from public;

grant select, insert, update, delete on community_posts to authenticated;
grant select, insert, update, delete on post_comments   to authenticated;
grant select, insert,         delete on post_reactions  to authenticated;

comment on table follows is
  'Who follows whom. Public to read (a follower count needs that), writable only by the follower.';
comment on table user_blocks is
  'Enforced in BOTH directions by the feed query — a block that only hides one side is not a block. Not readable by the blocked person.';
comment on table post_reports is
  'A person asking a person to look. Nothing automated acts on these; review happens through the service role.';

notify pgrst, 'reload schema';
