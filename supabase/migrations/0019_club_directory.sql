-- ============================================================
-- MIDO XI — 0019: a link out, and a club list that fills itself
--
-- Renamed from 0019_avatars_and_clubs. Two corrections behind
-- that, both worth knowing.
--
-- 1. THE TABLE NAME COLLIDED. This originally created a table
--    called `clubs` — and `clubs` has existed since 0001, where
--    it is a coach's own club record (owner_id, name).
--
--    `create table if not exists` did exactly what it says: it
--    found a `clubs`, did nothing, and reported success. The next
--    statement then failed on `create index ... on clubs (slug)`,
--    because the table it silently did not create was the only
--    one with a `slug` column.
--
--    That is the same shape as every other bug this codebase has
--    had — an operation reporting success without anyone checking
--    WHAT succeeded. `if not exists` guards the name, not the
--    shape.
--
--    So these are `club_directory` and `league_directory`, which
--    also happen to say what they are: a directory of names people
--    have typed, not a record of a club.
--
-- 2. THE AVATAR HALF IS GONE. It created a storage bucket and
--    four RLS policies on `storage.objects`, which is owned by
--    `supabase_storage_admin` — so `create policy` on it fails
--    from the SQL editor. Neither turned out to be needed: the
--    bucket is made through the storage API, and avatar writes go
--    through the server at a path built from the session's user
--    id, which no caller input can reach.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · the profile gains a link out ─────────────────────────

-- For the minority of players who have one. There is no public
-- Transfermarkt API and their terms forbid scraping, so this is a
-- link a reader can follow — never an import, and never treated
-- as a source of facts about the player.
alter table player_profiles add column if not exists transfermarkt_url text;

comment on column player_profiles.transfermarkt_url is
  'A link the reader of a report can follow. NOT a data source — Transfermarkt has no public API and scraping it is against their terms. Nothing in MIDO reads football facts from this.';

-- ── 2 · clubs and leagues, learned rather than imported ──────
--
-- There is no free list of the world's football clubs, and the
-- paid ones cover professional football only — which misses
-- precisely the Sunday-league and academy players this product is
-- for. Sarisbury Spartans is in no database anywhere.
--
-- So these start empty and fill from use. The first player to type
-- a name creates the row; everyone after them is offered it.

create table if not exists club_directory (
  id uuid primary key default gen_random_uuid(),
  -- As the first player typed it, kept for display.
  name text not null,
  -- Case- and punctuation-folded, for matching. See lib/data/clubs-types.ts.
  slug text not null unique,
  country text,
  -- Free text: "Hampshire Sunday League Div 3" is as valid as
  -- "National League North", and neither belongs in an enum.
  league text,
  /*
    How many profiles name this club. The ranking signal for the
    typeahead — the club forty players share should be offered
    before a one-off typo of it — and the cheapest possible spam
    signal.
  */
  uses int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists league_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text,
  uses int not null default 1,
  created_at timestamptz not null default now()
);

-- Prefix search is what a typeahead does, and `text_pattern_ops`
-- makes `slug like 'sarisb%'` an index scan.
create index if not exists club_directory_slug_idx   on club_directory (slug text_pattern_ops);
create index if not exists club_directory_uses_idx   on club_directory (uses desc);
create index if not exists league_directory_slug_idx on league_directory (slug text_pattern_ops);
create index if not exists league_directory_uses_idx on league_directory (uses desc);

/*
  Readable by every signed-in user, writable by none of them.

  A shared list anyone can edit is a shared list anyone can
  vandalise, and these rows appear in other people's dropdowns.
  Rows are created only through the security-definer functions
  below, which take the name from the player's own profile save.
*/
alter table club_directory   enable row level security;
alter table league_directory enable row level security;

drop policy if exists club_directory_read on club_directory;
create policy club_directory_read on club_directory for select to authenticated using (true);

drop policy if exists league_directory_read on league_directory;
create policy league_directory_read on league_directory for select to authenticated using (true);

revoke insert, update, delete on club_directory   from anon, authenticated, public;
revoke insert, update, delete on league_directory from anon, authenticated, public;

/*
  Record that somebody plays for this club.

  Security definer because the tables are read-only to users — this
  is the only door in, and it only ever inserts a name or bumps a
  counter. `search_path` is pinned: a security-definer function
  without it can be hijacked by a caller-controlled search_path.
*/
create or replace function remember_club(p_name text, p_league text default null, p_country text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_slug text;
  v_id   uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  v_slug := lower(regexp_replace(trim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' or length(v_slug) < 2 then
    return null;
  end if;

  insert into club_directory (name, slug, league, country)
  values (trim(p_name), v_slug, nullif(trim(coalesce(p_league, '')), ''), p_country)
  on conflict (slug) do update
    set uses    = club_directory.uses + 1,
        -- Fill a blank from a later save, but never overwrite what
        -- is already there with someone else's guess.
        league  = coalesce(club_directory.league, excluded.league),
        country = coalesce(club_directory.country, excluded.country)
  returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function remember_league(p_name text, p_country text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_slug text;
  v_id   uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  v_slug := lower(regexp_replace(trim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' or length(v_slug) < 2 then
    return null;
  end if;

  insert into league_directory (name, slug, country)
  values (trim(p_name), v_slug, p_country)
  on conflict (slug) do update
    set uses    = league_directory.uses + 1,
        country = coalesce(league_directory.country, excluded.country)
  returning id into v_id;

  return v_id;
end;
$fn$;

/*
  Postgres grants EXECUTE on a new function to PUBLIC by default,
  and both anon and authenticated inherit through it. Revoking from
  the named roles alone leaves that PUBLIC grant in place — the
  mistake 0011 made, and 0017 made in mirror image. Revoke from
  PUBLIC first, then grant what is intended.
*/
-- BOTH, not one. Supabase grants EXECUTE to `anon` and
-- `authenticated` by name as well, and a revoke only removes the
-- grant it names. This file originally revoked PUBLIC alone and
-- anon kept execute — see 0021, which is the fix and the third
-- time this trap has been sprung.
revoke all on function remember_club(text, text, text)   from anon;
revoke all on function remember_club(text, text, text)   from public;
revoke all on function remember_league(text, text)       from anon;
revoke all on function remember_league(text, text)       from public;
grant execute on function remember_club(text, text, text) to authenticated;
grant execute on function remember_league(text, text)     to authenticated;

notify pgrst, 'reload schema';
