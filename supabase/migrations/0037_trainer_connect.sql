-- ============================================================
-- MIDO XI — 0037: Trainer payments (Stripe Connect, Express)
--
-- The Lab becomes a business. Three tables, one rule throughout:
-- MONEY STATE IS ONLY EVER WRITTEN FROM STRIPE'S OWN DATA, with the
-- service role — a signed webhook or a server action that just heard
-- the answer from the API. Authenticated users can READ their own
-- rows; they cannot write any of these tables directly, because a
-- client that can write "charges_enabled = true" or "status = paid"
-- is a client that can lie about money.
--
--   trainer_accounts   mirror of the trainer's Connect account flags
--   trainer_products   what the trainer sells (their rows, editable)
--   trainer_purchases  one row per Checkout session, fee frozen in
--
-- Fee policy (Option B, decided 30 Aug 2026): application fee steps
-- DOWN with roster size — 2% to 5 athletes, 1.5% at 6, 1% at 16.
-- Computed in lib/billing/connect-fee.ts at link creation and FROZEN
-- into the purchase row, so a later roster change never rewrites the
-- terms of a link already sent.
-- ============================================================

-- ---------- the Connect account mirror ----------------------

create table if not exists trainer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table trainer_accounts enable row level security;

drop policy if exists trainer_accounts_read on trainer_accounts;
create policy trainer_accounts_read on trainer_accounts
  for select to authenticated using (user_id = auth.uid());

-- ---------- what the trainer sells --------------------------

create table if not exists trainer_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  amount_cents int not null check (amount_cents between 100 and 500000),
  currency text not null default 'usd' check (currency in ('usd')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table trainer_products enable row level security;

drop policy if exists trainer_products_owner on trainer_products;
create policy trainer_products_owner on trainer_products
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- one row per payment link ------------------------

create table if not exists trainer_purchases (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references trainer_products(id) on delete set null,
  athlete_id uuid references trainer_athletes(id) on delete set null,
  checkout_session_id text unique,
  amount_cents int not null check (amount_cents > 0),
  -- The fee as charged: frozen at link creation, never recomputed.
  fee_cents int not null check (fee_cents >= 0),
  fee_bps int not null check (fee_bps between 0 and 1000),
  status text not null default 'pending'
    check (status in ('pending','paid','expired','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists trainer_purchases_trainer_idx
  on trainer_purchases (trainer_id, created_at desc);

alter table trainer_purchases enable row level security;

drop policy if exists trainer_purchases_read on trainer_purchases;
create policy trainer_purchases_read on trainer_purchases
  for select to authenticated using (trainer_id = auth.uid());

-- ---------- the grant discipline ----------------------------
-- Supabase's default privileges grant anon/authenticated a DIRECT
-- table grant by name on anything new in public, and a PUBLIC grant
-- may exist besides. Revoke BOTH (the trap, hit three times before),
-- then grant back exactly what the policies above are meant to gate.

revoke all on trainer_accounts, trainer_products, trainer_purchases from public;
revoke all on trainer_accounts, trainer_products, trainer_purchases from anon;
revoke all on trainer_accounts, trainer_products, trainer_purchases from authenticated;

grant select on trainer_accounts to authenticated;
grant select, insert, update, delete on trainer_products to authenticated;
grant select on trainer_purchases to authenticated;
