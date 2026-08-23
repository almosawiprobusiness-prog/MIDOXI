-- ============================================================
-- MIDO XI — read-only grant audit
--
-- Prints who may execute each security-definer function. Reads
-- the catalog and writes nothing, so it is safe to run any time.
--
-- WHAT YOU SHOULD SEE
--
--   convert_referral        service_role                 ← and nothing else
--   void_referral           service_role                 ← and nothing else
--   ripen_referral_rewards  authenticated, service_role
--   record_referral_visit   anon, authenticated, service_role
--   preview_invite          anon, authenticated, service_role
--   everything else         authenticated, service_role
--
-- If `PUBLIC`, `anon` or `authenticated` appears on either of the
-- first two rows, migration 0012 did not take and the referral
-- ledger is writable by anyone holding the anon key.
-- ============================================================

select
  p.proname                                   as function,
  coalesce(
    string_agg(
      distinct case
        when a.grantee = 0 then 'PUBLIC'      -- oid 0 is the PUBLIC pseudo-role
        else pg_get_userbyid(a.grantee)
      end,
      ', ' order by case
        when a.grantee = 0 then 'PUBLIC'
        else pg_get_userbyid(a.grantee)
      end
    ),
    '(nobody)'
  )                                           as may_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) a on a.privilege_type = 'EXECUTE'
where n.nspname = 'public'
  and p.proname in (
    'convert_referral',
    'void_referral',
    'ripen_referral_rewards',
    'record_referral_visit',
    'attribute_referral',
    'apply_referral_reward',
    'my_referral_code',
    'my_referrals',
    'preview_invite',
    'accept_invite',
    'set_link_scope'
  )
group by p.proname
order by
  -- The two that matter most, first.
  case p.proname
    when 'convert_referral' then 0
    when 'void_referral' then 1
    else 2
  end,
  p.proname;
