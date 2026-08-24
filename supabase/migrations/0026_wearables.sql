-- ============================================================
-- MIDO XI — 0026: measured recovery, and where it comes from
--
-- `recovery-types.ts` has carried this note since the Recovery
-- screen was rebuilt:
--
--   "The old Recovery screen showed HRV in milliseconds, resting
--    heart rate in bpm, hydration in litres... None of those exist
--    in the schema and none can be entered anywhere in the
--    product. They were invented numbers on a page a player would
--    use to decide whether to train."
--
-- This is the migration that makes those numbers real — for the
-- players who own a device that measures them, and only for them.
-- A player without a wearable sees the same four self-reported
-- scores as before and no physiology at all. What must never
-- happen is the middle case: a number on the page that nothing
-- measured.
--
-- MEASURED AND REPORTED ARE DIFFERENT KINDS OF FACT. They are kept
-- in different tables for the same reason the truth model keeps
-- `observed` apart from `inferred`: a Whoop HRV reading and a
-- player typing "4 out of 5 for sleep" are not the same claim, and
-- averaging them into one "readiness" number would be the same
-- invented physiology in a new costume.
--
-- PROVIDER-AGNOSTIC ON PURPOSE. Whoop is first because it has a
-- real server API. Garmin, Oura and Polar work the same way and
-- drop in as rows in `source` rather than as new tables. Apple
-- Health and Samsung Health have NO server API — they are
-- on-device only — so they arrive as file imports and are labelled
-- as such, never as a live sync.
--
-- Safe to re-run.
-- ============================================================

-- ── 1 · the connection, as the owner sees it ─────────────────

/*
  Everything about a connection EXCEPT the credentials. This table
  is readable by its owner: which provider, whether it is working,
  when it last synced, and what went wrong if it did.
*/
create table if not exists provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  provider text not null
    check (provider in ('whoop','garmin','oura','polar','apple_import','samsung_import')),

  /*
    'active'    working
    'expired'   the refresh token no longer works; the player must reconnect
    'revoked'   disconnected here, or access withdrawn at the provider
  */
  status text not null default 'active'
    check (status in ('active','expired','revoked')),

  -- Who the provider thinks this is. Kept so a reconnect updates the
  -- same row rather than quietly creating a second one.
  external_user_id text,
  scopes text,

  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  -- Written when a sync fails, cleared when one succeeds, and shown
  -- to the player. A wearable that silently stopped syncing is worse
  -- than one that was never connected.
  last_error text,

  -- One connection per provider per person.
  unique (user_id, provider)
);

create index if not exists provider_connections_user_idx on provider_connections (user_id);

-- ── 2 · the credentials, which nobody may read ───────────────

/*
  OAuth tokens live in their own table, and `authenticated` is
  granted NOTHING on it — not select, not anything. Only the
  service role touches this.

  A Whoop refresh token is a long-lived key to a person's
  physiological history. Putting it in a column of a table the
  browser can query means one careless `select *` in an adapter
  ships it to the client, and RLS would not stop that: RLS decides
  WHICH ROWS you see, not which columns. The only reliable way to
  keep a secret out of the browser is for the browser's role to
  have no privilege on it at all.
*/
create table if not exists provider_tokens (
  connection_id uuid primary key references provider_connections(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  -- Refreshed ahead of this; see lib/health/whoop.ts.
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── 3 · what the device measured ─────────────────────────────

/*
  One row per person per day per source.

  Every metric is nullable because no provider returns all of them
  and a device can score a night as UNSCORED — Whoop does this when
  a strap was off or the data was insufficient. A null here means
  "not measured", and the UI must render it as absent rather than
  as zero. A resting heart rate of 0 bpm on a recovery page is the
  kind of number that gets somebody to train when they should not.
*/
create table if not exists recovery_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null
    check (source in ('whoop','garmin','oura','polar','apple_import','samsung_import')),

  -- The day this belongs to, in the player's own terms. Whoop's
  -- "cycle" starts when you wake, so this is derived from the cycle
  -- start rather than from a UTC timestamp.
  day date not null,
  recorded_at timestamptz not null,

  -- Recovery
  recovery_score int check (recovery_score between 0 and 100),
  hrv_ms numeric check (hrv_ms >= 0),
  resting_hr int check (resting_hr between 0 and 300),
  spo2_percent numeric check (spo2_percent between 0 and 100),
  skin_temp_c numeric,

  -- Sleep
  sleep_performance int check (sleep_performance between 0 and 100),
  sleep_duration_min int check (sleep_duration_min >= 0),
  sleep_need_min int check (sleep_need_min >= 0),
  sleep_efficiency numeric check (sleep_efficiency between 0 and 100),

  -- Load
  strain numeric check (strain >= 0),

  /*
    The provider's own record id, so a re-sync updates rather than
    duplicates — and so a row can always be traced back to what was
    actually returned.
  */
  external_id text,
  -- The untouched response. Kept because a derived number nobody can
  -- trace back to a source is the thing this schema exists to avoid.
  raw jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, source, day)
);

create index if not exists recovery_samples_user_day_idx on recovery_samples (user_id, day desc);

-- ── 4 · RLS ──────────────────────────────────────────────────

alter table provider_connections enable row level security;
alter table provider_tokens      enable row level security;
alter table recovery_samples     enable row level security;

/*
  A connection is the owner's to see and to remove. It is NOT the
  owner's to create or edit by hand: a row here asserts that an
  OAuth handshake happened, and only the server that performed it
  can honestly make that claim.
*/
drop policy if exists provider_connections_read on provider_connections;
create policy provider_connections_read on provider_connections for select to authenticated
  using (user_id = auth.uid());

drop policy if exists provider_connections_delete on provider_connections;
create policy provider_connections_delete on provider_connections for delete to authenticated
  using (user_id = auth.uid());

/*
  No policy at all on provider_tokens. Combined with the absent
  grant below, a signed-in account cannot read one row of it.
*/

/*
  Physiological readings are read-only to their owner. They are a
  record of what a device measured; a player who could edit them
  could make their own recovery history say anything, which is the
  one thing a coach reading it must be able to rely on.
*/
drop policy if exists recovery_samples_read on recovery_samples;
create policy recovery_samples_read on recovery_samples for select to authenticated
  using (user_id = auth.uid());

drop policy if exists recovery_samples_delete on recovery_samples;
create policy recovery_samples_delete on recovery_samples for delete to authenticated
  using (user_id = auth.uid());

-- ── 5 · grants ───────────────────────────────────────────────
-- anon, public AND authenticated. 0024 named only the first two and
-- silently kept Supabase's default grant of ALL to authenticated —
-- the fifth time this schema has been caught by it.

revoke all on provider_connections from anon, public, authenticated;
revoke all on provider_tokens      from anon, public, authenticated;
revoke all on recovery_samples     from anon, public, authenticated;

-- Read your connections and disconnect them. No insert, no update:
-- both are the server's job.
grant select, delete on provider_connections to authenticated;

-- Read your readings and delete them. Deliberately no insert and no
-- update — a player cannot write their own physiology.
grant select, delete on recovery_samples to authenticated;

/*
  provider_tokens gets NOTHING.

  Not a reduced grant — no grant. The service role reaches it
  because the service role bypasses both grants and RLS; every
  other role is refused at the privilege, which is the only
  guarantee that does not depend on somebody later writing a
  careless policy.
*/

comment on table provider_connections is
  'A connection minus its credentials. Owner-readable so the player can see whether their wearable is actually syncing.';
comment on table provider_tokens is
  'OAuth credentials. `authenticated` holds NO privilege here — RLS filters rows, not columns, so the only way to keep a refresh token out of the browser is to grant the browser''s role nothing.';
comment on table recovery_samples is
  'What a device measured. Read-only to its owner: self-reported check-ins live in daily_checkins and are a different kind of fact, never averaged together.';

notify pgrst, 'reload schema';
