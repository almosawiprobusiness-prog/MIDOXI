-- ============================================================
-- MIDO XI — 0009: connections
--
-- The change that turns four working systems into one connected
-- organization: a player links their own account to a coach's
-- squad, a trainer's roster, or a club's staff list.
--
-- Two principles decide the design:
--
-- 1. THE PLAYER DECIDES WHAT IS SHARED. Linking is an invite the
--    player accepts, and they choose the scope at that moment:
--      identity     — name and position only
--      development  — plus goals and match log
--      full         — plus daily check-ins (readiness)
--    They can change it or unlink at any time, from their side.
--
-- 2. THE DATABASE ENFORCES IT. Access is granted by RLS policies
--    keyed on the accepted scope, not by what the interface
--    chooses to show. A revoked link removes the access.
--
-- Acceptance runs through a security-definer function because the
-- accepting user cannot, and should not, be able to write to a
-- coach's own rows directly.
--
-- Safe to re-run.
-- ============================================================

-- ---------- scope on the relationship rows -------------------

alter table coach_players add column if not exists share_scope text not null default 'identity';
alter table coach_players drop constraint if exists coach_players_share_scope_check;
alter table coach_players add constraint coach_players_share_scope_check
  check (share_scope in ('identity','development','full'));

alter table trainer_athletes add column if not exists share_scope text not null default 'identity';
alter table trainer_athletes drop constraint if exists trainer_athletes_share_scope_check;
alter table trainer_athletes add constraint trainer_athletes_share_scope_check
  check (share_scope in ('identity','development','full'));

-- ---------- invites ------------------------------------------

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  -- Short, human-readable, unambiguous: no O/0/I/1.
  code text not null unique,
  kind text not null check (kind in ('coach-player','trainer-athlete','club-staff')),
  issued_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_table text not null check (target_table in ('coach_players','trainer_athletes','org_staff')),
  target_id uuid not null,
  -- Shown to whoever holds the code, so they know what they are joining.
  label text,
  issuer_label text,
  status text not null default 'open' check (status in ('open','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_issuer_idx on invites (issued_by, created_at desc);
create index if not exists invites_target_idx on invites (target_table, target_id);

alter table invites enable row level security;

-- The issuer manages their own invites. Nobody else can read the table —
-- redeeming a code goes through the functions below, which is what keeps a
-- code from being a way to enumerate other people's invitations.
drop policy if exists invites_owner on invites;
create policy invites_owner on invites
  for all to authenticated
  using (issued_by = auth.uid())
  with check (issued_by = auth.uid());

-- ---------- redeeming ----------------------------------------

/*
  What a code refers to, without leaking ids. Returns null for a code that does
  not exist, so a wrong code and a stranger's code look identical.
*/
create or replace function public.preview_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v invites%rowtype;
begin
  select * into v from invites where code = upper(trim(p_code));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'kind', v.kind,
    'label', v.label,
    'issuerLabel', v.issuer_label,
    'status', case when v.status = 'open' and v.expires_at < now() then 'expired' else v.status end,
    'expiresAt', v.expires_at
  );
end;
$$;

/*
  Accept a code. Links the caller's account to the row the invite points at,
  with the scope the caller chose, and closes the invite.
*/
create or replace function public.accept_invite(p_code text, p_scope text default 'development')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v invites%rowtype;
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'development');
  v_org uuid;
  v_role text;
  v_hit int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;
  if v_scope not in ('identity','development','full') then
    v_scope := 'development';
  end if;

  select * into v from invites where code = upper(trim(p_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code does not match an invitation.');
  end if;
  if v.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'That invitation has already been used or was withdrawn.');
  end if;
  if v.expires_at < now() then
    update invites set status = 'expired' where id = v.id;
    return jsonb_build_object('ok', false, 'error', 'That invitation has expired. Ask for a new code.');
  end if;
  if v.issued_by = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'That is your own invitation.');
  end if;

  if v.kind = 'coach-player' then
    update coach_players
       set player_id = auth.uid(), share_scope = v_scope
     where id = v.target_id;
    get diagnostics v_hit = row_count;

  elsif v.kind = 'trainer-athlete' then
    update trainer_athletes
       set athlete_id = auth.uid(), share_scope = v_scope
     where id = v.target_id;
    get diagnostics v_hit = row_count;

  elsif v.kind = 'club-staff' then
    update org_staff
       set member_id = auth.uid(), status = 'active'
     where id = v.target_id
     returning org_id, staff_role into v_org, v_role;
    get diagnostics v_hit = row_count;

    if v_org is not null then
      insert into org_memberships (org_id, user_id, org_role, status)
      values (
        v_org,
        auth.uid(),
        case when v_role in ('admin','coach','trainer','analyst') then v_role else 'staff' end,
        'active'
      )
      on conflict do nothing;
    end if;
  end if;

  if coalesce(v_hit, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'The record this invitation points at no longer exists.');
  end if;

  update invites
     set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'kind', v.kind, 'label', v.label, 'scope', v_scope);
end;
$$;

/*
  Change what a link shares, or end it. Only the linked person may call this
  about themselves — a coach cannot widen their own access.
*/
create or replace function public.set_link_scope(p_kind text, p_id uuid, p_scope text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := p_scope;
  v_hit int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  if v_scope = 'none' then
    -- Unlink entirely.
    if p_kind = 'coach-player' then
      update coach_players set player_id = null, share_scope = 'identity'
       where id = p_id and player_id = auth.uid();
    elsif p_kind = 'trainer-athlete' then
      update trainer_athletes set athlete_id = null, share_scope = 'identity'
       where id = p_id and athlete_id = auth.uid();
    elsif p_kind = 'club-staff' then
      update org_staff set member_id = null, status = 'recorded'
       where id = p_id and member_id = auth.uid();
    end if;
    get diagnostics v_hit = row_count;
    return jsonb_build_object('ok', v_hit > 0, 'unlinked', true);
  end if;

  if v_scope not in ('identity','development','full') then
    return jsonb_build_object('ok', false, 'error', 'Unknown sharing level.');
  end if;

  if p_kind = 'coach-player' then
    update coach_players set share_scope = v_scope where id = p_id and player_id = auth.uid();
  elsif p_kind = 'trainer-athlete' then
    update trainer_athletes set share_scope = v_scope where id = p_id and athlete_id = auth.uid();
  else
    return jsonb_build_object('ok', false, 'error', 'That link has no sharing settings.');
  end if;

  get diagnostics v_hit = row_count;
  return jsonb_build_object('ok', v_hit > 0, 'scope', v_scope);
end;
$$;

revoke all on function public.preview_invite(text) from public;
revoke all on function public.accept_invite(text, text) from public;
revoke all on function public.set_link_scope(text, uuid, text) from public;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.set_link_scope(text, uuid, text) to authenticated;

-- ---------- what a link actually opens ------------------------

-- A linked coach may read the player's own profile row (identity and above).
drop policy if exists player_profiles_linked_coach on player_profiles;
create policy player_profiles_linked_coach on player_profiles for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.coach_id = auth.uid() and cp.player_id = player_profiles.user_id
  ));

drop policy if exists player_profiles_linked_trainer on player_profiles;
create policy player_profiles_linked_trainer on player_profiles for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.trainer_id = auth.uid() and ta.athlete_id = player_profiles.user_id
  ));

-- Development scope: goals and the match log.
drop policy if exists development_goals_linked_coach on development_goals;
create policy development_goals_linked_coach on development_goals for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.coach_id = auth.uid()
      and cp.player_id = development_goals.user_id
      and cp.share_scope in ('development','full')
  ));

drop policy if exists matches_linked_coach on matches;
create policy matches_linked_coach on matches for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.coach_id = auth.uid()
      and cp.player_id = matches.user_id
      and cp.share_scope in ('development','full')
  ));

drop policy if exists development_goals_linked_trainer on development_goals;
create policy development_goals_linked_trainer on development_goals for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.trainer_id = auth.uid()
      and ta.athlete_id = development_goals.user_id
      and ta.share_scope in ('development','full')
  ));

-- Full scope only: daily check-ins are the most personal thing in the product,
-- and they are what makes a trainer's readiness real instead of typed.
drop policy if exists daily_checkins_linked_trainer on daily_checkins;
create policy daily_checkins_linked_trainer on daily_checkins for select to authenticated
  using (exists (
    select 1 from trainer_athletes ta
    where ta.trainer_id = auth.uid()
      and ta.athlete_id = daily_checkins.user_id
      and ta.share_scope = 'full'
  ));

drop policy if exists daily_checkins_linked_coach on daily_checkins;
create policy daily_checkins_linked_coach on daily_checkins for select to authenticated
  using (exists (
    select 1 from coach_players cp
    where cp.coach_id = auth.uid()
      and cp.player_id = daily_checkins.user_id
      and cp.share_scope = 'full'
  ));

-- A staff member may see the organization they belong to, and its roster row.
drop policy if exists org_staff_self_read on org_staff;
create policy org_staff_self_read on org_staff for select to authenticated
  using (member_id = auth.uid());
