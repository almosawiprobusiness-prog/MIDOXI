# Applying migrations 0031 · 0032 · 0033

**Who runs this:** you, in the Supabase SQL editor. I don't handle the
keys, so the applying is yours; everything else — the SQL itself, the
verification, and what to do if something fails — is prepared here.

**Order matters only in that 0031 and 0032 unlock the intelligence loop
and 0033 unlocks analytics/feedback. All three are independent and each
is safe to re-run** (`create ... if not exists`, `drop policy if
exists` throughout).

**Staging first if you have one.** If the project only has the one
Supabase instance, that instance is both — the tables are new, so the
risk to existing data is nil; the verification below is what stands in
for a staging pass.

---

## Step 1 — apply

In the Supabase dashboard → SQL editor, paste and run, one file at a
time, in order:

1. `supabase/migrations/0031_mido_events.sql`
2. `supabase/migrations/0032_mido_recommendations.sql`
3. `supabase/migrations/0033_beta_telemetry.sql`

Each should end with `Success. No rows returned`.

## Step 2 — verify the catalog

Paste this after all three. Every row of the output should say `ok`.

```sql
with checks(name, pass) as (
  values
  ('0031 table exists',
    (select count(*) from pg_tables where tablename = 'mido_events') = 1),
  ('0031 RLS enabled',
    (select relrowsecurity from pg_class where relname = 'mido_events')),
  ('0031 has exactly 2 policies (select, insert — no update: append-only)',
    (select count(*) from pg_policies where tablename = 'mido_events') = 2),
  ('0031 idempotency unique index',
    (select count(*) from pg_indexes where indexname = 'mido_events_idempotency_idx') = 1),
  ('0031 actor+time index',
    (select count(*) from pg_indexes where indexname = 'mido_events_actor_time_idx') = 1),

  ('0032 table exists',
    (select count(*) from pg_tables where tablename = 'mido_recommendations') = 1),
  ('0032 RLS enabled',
    (select relrowsecurity from pg_class where relname = 'mido_recommendations')),
  ('0032 one-active-per-kind partial unique index',
    (select count(*) from pg_indexes where indexname = 'mido_recommendations_one_active_idx') = 1),
  ('0032 owner policy present',
    (select count(*) from pg_policies where tablename = 'mido_recommendations') >= 1),

  ('0033 analytics table exists',
    (select count(*) from pg_tables where tablename = 'product_analytics') = 1),
  ('0033 analytics RLS enabled',
    (select relrowsecurity from pg_class where relname = 'product_analytics')),
  ('0033 analytics is insert-only for users (1 policy)',
    (select count(*) from pg_policies where tablename = 'product_analytics') = 1),
  ('0033 feedback table exists',
    (select count(*) from pg_tables where tablename = 'beta_feedback') = 1),
  ('0033 feedback RLS enabled',
    (select relrowsecurity from pg_class where relname = 'beta_feedback'))
)
select name, case when pass then 'ok' else '*** FAIL ***' end as result
from checks;
```

## Step 3 — behavioral verification (in the app, not SQL)

The SQL editor runs as `postgres` and bypasses RLS, so policy *behavior*
can only be proven through the app:

1. **Sign in to your real account** and load the Locker. If migration
   0032 landed, the Next panel's **Done** and **Not now** now survive a
   refresh — press Not now, refresh, and the same card must not lead
   again.
2. **Log anything** (a check-in is fastest). Then in the SQL editor:
   ```sql
   select type, subject_type, occurred_at
   from mido_events order by occurred_at desc limit 10;
   ```
   Your action should be there. This proves the emitter stopped
   falling back.
3. **Cross-account isolation** is proven in the two-account test in
   `REAL_ACCOUNT_TEST.md` — the SQL editor cannot prove it for you.

## If a check fails

Nothing before 0031 depends on these tables, so the rollback is simply:

```sql
drop table if exists mido_events;
drop table if exists mido_recommendations;
drop table if exists product_analytics;
drop table if exists beta_feedback;
```

— then tell me what the error was and I'll fix the migration before you
re-run it. The app keeps working either way: every consumer of these
tables fails soft by design.
