-- ============================================================
-- MIDO XI — Community + richer public profiles (opt-in)
-- Run after 0001_init.sql. Everything here is opt-in: only content
-- a user explicitly posts is public. Private data (checkins, notes,
-- coach feedback, unshared clips) is untouched and stays private.
-- ============================================================

-- ---- expand the public profile ----
alter table player_profiles
  add column if not exists handle text unique,
  add column if not exists play_style text,
  add column if not exists favorite_players text[],
  add column if not exists strengths text[],
  add column if not exists achievements text,
  add column if not exists socials jsonb not null default '{}'::jsonb;

-- ---- posts (shared analysis, optionally attaching a clip) ----
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  author_handle text,
  author_position text,
  author_avatar text,
  title text not null,
  body text not null,
  clip_id uuid references clips(id) on delete set null,
  -- denormalized clip snapshot: shared clips render without exposing private tables
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

-- ---- RLS ----
-- Each policy is dropped first so this file can be replayed; the
-- first version could only ever be run once.
alter table community_posts enable row level security;
alter table post_comments enable row level security;
alter table post_reactions enable row level security;

-- The community is visible to any signed-in user; only owners write.
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
