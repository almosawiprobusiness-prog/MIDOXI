-- ============================================================
-- MIDO XI — 0048: break the organizations ⇄ org_memberships
--                 RLS recursion
--
-- THE BUG. Migration 0005 gave both tables a policy that reads
-- the other:
--
--   organizations.organizations_member_read
--     → select 1 from org_memberships …
--   org_memberships.org_memberships_admin
--     → select 1 from organizations …
--
-- Evaluating either policy evaluates the other, forever. Postgres
-- stops it with:
--
--   ERROR 42P17: infinite recursion detected in policy for
--                relation "organizations"
--
-- WHAT IT COST. Every authenticated read of `organizations` has
-- failed since 0005 — so `currentOrgId()` in lib/data/club.ts has
-- always returned null in production, and with it every Club OS
-- surface that hangs off an organization. It went unseen because
-- the failure is silent: the Supabase client returns
-- `{ data: null }`, the callers treat null as "this account has no
-- organization", and the pages render their empty states. Nothing
-- errored; the feature simply never had any data. Demo mode never
-- touches RLS, so it looked fine there.
--
-- THE FIX. A policy may not query a table whose own policies
-- query back. The standard break is a SECURITY DEFINER function:
-- it runs as its owner, so the lookup inside it does not re-enter
-- RLS, and the cycle has nowhere to go.
--
-- WHY THIS DOES NOT WIDEN ACCESS. Both functions answer only
-- about `auth.uid()` — the caller cannot ask about anyone else,
-- because the caller supplies no user id. They are the same
-- questions the old policies asked, answered without recursing.
-- `search_path` is pinned, so a shadowed table cannot be
-- substituted for the real one.
--
-- Safe to re-run.
-- ============================================================

-- ---------- the two questions, asked without recursing --------

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from org_memberships m
     where m.org_id = p_org
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from organizations o
     where o.id = p_org
       and o.owner_id = auth.uid()
  );
$$;

/*
  Only signed-in callers. `anon` has no business asking either
  question, and a SECURITY DEFINER function is exactly the kind of
  thing that should not be reachable without a session.
*/
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;

comment on function public.is_org_member(uuid) is
  'Is the current user an active member of this organization? SECURITY DEFINER so it can be called from a policy on organizations without re-entering org_memberships'' policies — see migration 0048.';

comment on function public.is_org_owner(uuid) is
  'Does the current user own this organization? SECURITY DEFINER so it can be called from a policy on org_memberships without re-entering organizations'' policies — see migration 0048.';

-- ---------- rewrite both policies to use them -----------------

/*
  The owner policy is untouched in meaning and still does not
  recurse — `owner_id = auth.uid()` reads only the row being
  checked. It is re-created here only so this file states the
  whole picture for the table in one place.
*/
drop policy if exists organizations_owner on organizations;
create policy organizations_owner on organizations for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read on organizations for select to authenticated
  using (public.is_org_member(id));

drop policy if exists org_memberships_admin on org_memberships;
create policy org_memberships_admin on org_memberships for all to authenticated
  using (public.is_org_owner(org_id))
  with check (public.is_org_owner(org_id));

/* Unchanged — reads only the row being checked, so it never recursed. */
drop policy if exists org_memberships_self_read on org_memberships;
create policy org_memberships_self_read on org_memberships for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
