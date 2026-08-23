-- ============================================================
-- MIDO XI — 0022: letting a report leave the building
--
-- Until now nothing could leave except a PDF the player printed
-- themselves. This is the first object in the product that a
-- stranger can open without signing in, and the design follows
-- from that:
--
--   · The TOKEN is the only credential, so it is 24 random bytes
--     and nothing about the player is derivable from it.
--
--   · EVERY link expires. There is no "never" — a recruitment CV
--     that stays live forever is a permanent public record of a
--     fifteen-year-old, and "I'll revoke it later" is not a thing
--     anybody does. Ninety days is the ceiling.
--
--   · The FIELDS are frozen at creation. The link carries the
--     privacy selection that was on screen when it was made, so a
--     later change to the player's defaults cannot widen a link
--     that is already out there.
--
-- ANON CANNOT READ THIS TABLE. The public route looks a token up
-- with the service role after checking it server-side; there is no
-- path where an unauthenticated caller queries `report_shares`
-- directly. That matters because a readable share table is a list
-- of every live token in the system.
--
-- Safe to re-run.
-- ============================================================

create table if not exists report_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- 24 random bytes, base64url. Unguessable, and carries nothing
  -- about the player — a token containing a name or a date would
  -- leak through any log that records a URL.
  token text not null unique,

  kind text not null check (kind in ('monthly','training','film')),
  -- A period ("2026-08") or a video id, depending on kind.
  ref text not null,

  /*
    The privacy selection, frozen. Not a reference to the player's
    current defaults — those can change, and a link already sent
    must not widen because somebody ticked a box a month later.
  */
  fields text[] not null default '{}',

  expires_at timestamptz not null,
  revoked_at timestamptz,

  -- Shown to the player. Somebody who can see a link has been
  -- opened four times knows something worth knowing.
  views int not null default 0,
  last_viewed_at timestamptz,

  created_at timestamptz not null default now()
);

-- The public route's only query.
create index if not exists report_shares_token_idx on report_shares (token);
create index if not exists report_shares_user_idx  on report_shares (user_id, created_at desc);

/*
  A link may not outlive the ceiling. Enforced here as well as in
  the application, because this is the constraint that protects a
  minor and it should not depend on which code path created the
  row.
*/
do $$ begin
  alter table report_shares
    add constraint report_shares_expiry_ceiling
    check (expires_at <= created_at + interval '91 days');
exception when duplicate_object then null;
end $$;

alter table report_shares enable row level security;

-- The player owns their links, and nobody else can see them at all.
drop policy if exists report_shares_owner on report_shares;
create policy report_shares_owner on report_shares
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table report_shares is
  'Expiring, revocable links to a report. Anon has NO access — the public route resolves a token with the service role. A readable share table would be a list of every live token.';

-- Both, then grant back. A grant may come from PUBLIC or from a
-- named role and a revoke removes only the one it names — the
-- trap 0011, 0017 and 0019 each fell into.
revoke all on report_shares from anon;
revoke all on report_shares from public;
grant select, insert, update, delete on report_shares to authenticated;

/*
  Count a view without handing the counter to the reader.

  The public route runs as the service role, so it could simply
  update the row — but doing it here keeps the increment atomic
  under two people opening the link at once, and keeps the route's
  write surface to exactly this one thing.
*/
create or replace function record_share_view(p_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update report_shares
     set views = views + 1,
         last_viewed_at = now()
   where token = p_token
     and revoked_at is null
     and expires_at > now();
end;
$fn$;

-- Nobody but the server calls this. Not anon, not authenticated:
-- a signed-in user incrementing someone else's view count is not a
-- disaster, but there is no reason for it to be possible.
revoke all on function record_share_view(text) from anon;
revoke all on function record_share_view(text) from authenticated;
revoke all on function record_share_view(text) from public;

notify pgrst, 'reload schema';
