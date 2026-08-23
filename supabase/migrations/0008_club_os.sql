-- ============================================================
-- MIDO XI — 0008: the Club operating system
--
-- The organizational layer on top of organizations / org_memberships (0005):
--
--   teams.org_id, age_group, squad_size
--       teams belong to the organization, with the age group and
--       the squad size the club maintains
--   org_staff
--       coaches, trainers and analysts as club records — linked
--       to a MIDO XI account when they join, working before that
--   club_methodology
--       HOW WE PLAY / HOW WE TRAIN / HOW WE DEVELOP, in sections.
--       This is the differentiator: once written, it becomes the
--       context MIDO answers inside for everyone in the club.
--
-- Owner-administers, members read. Safe to re-run.
-- ============================================================

-- ---------- teams under an organization ----------------------

alter table teams add column if not exists org_id uuid references organizations(id) on delete cascade;
alter table teams add column if not exists age_group text;
alter table teams add column if not exists squad_size int;
-- A team created by a club has no individual coach owner.
alter table teams alter column coach_id drop not null;

create index if not exists teams_org_idx on teams (org_id);

-- ---------- staff --------------------------------------------

create table if not exists org_staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Set when the staff member joins with their own MIDO XI account.
  member_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  staff_role text not null default 'coach' check (staff_role in
    ('admin','head-coach','coach','trainer','analyst','physio','scout','staff')),
  team_id uuid references teams(id) on delete set null,
  status text not null default 'recorded' check (status in ('recorded','invited','active','left')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists org_staff_org_idx on org_staff (org_id);

-- ---------- methodology --------------------------------------

create table if not exists club_methodology (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc text not null check (doc in ('play','train','develop')),
  -- e.g. "Build-up", "Pressing", "U15-U16" — the club's own headings.
  section text not null,
  -- The principles themselves. One per line in the UI, an array here.
  principles text[] not null default '{}',
  detail text,
  -- Age band, when a development framework is age-specific.
  age_group text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_methodology_org_idx on club_methodology (org_id, doc, position);

-- ---------- RLS ----------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['org_staff','club_methodology'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %1$s_owner on %1$s;', t);
    execute format($f$
      create policy %1$s_owner on %1$s
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Anyone active in the organization may read its staff list and its
-- methodology — that is the whole point of writing it down.
drop policy if exists org_staff_member_read on org_staff;
create policy org_staff_member_read on org_staff for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = org_staff.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

drop policy if exists club_methodology_member_read on club_methodology;
create policy club_methodology_member_read on club_methodology for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = club_methodology.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

-- Teams: the organization owner administers; org members read.
drop policy if exists teams_org_owner on teams;
create policy teams_org_owner on teams for all to authenticated
  using (exists (select 1 from organizations o where o.id = teams.org_id and o.owner_id = auth.uid()))
  with check (exists (select 1 from organizations o where o.id = teams.org_id and o.owner_id = auth.uid()));

drop policy if exists teams_org_member_read on teams;
create policy teams_org_member_read on teams for select to authenticated
  using (exists (
    select 1 from org_memberships m
    where m.org_id = teams.org_id and m.user_id = auth.uid() and m.status = 'active'
  ));

-- ---------- updated_at ---------------------------------------

drop trigger if exists set_updated_at_club_methodology on club_methodology;
create trigger set_updated_at_club_methodology before update on club_methodology
  for each row execute function public.set_updated_at();
