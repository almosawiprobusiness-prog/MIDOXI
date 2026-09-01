/*
  Verify the columns the adapters actually ask for.

  `verify-schema.mjs` proves a table exists; that says nothing about whether the
  app is asking it for the right columns. This is the check that would have
  caught `match_date` vs `played_at` and `age_group` vs `level` — both real bugs
  in this codebase, both of which built and linted cleanly and failed only at
  runtime, in real mode, where nobody was looking.

  PostgREST answers a select for a column that does not exist with 400 and
  PGRST204, so each entry below is one cheap request. Read-only: every query is
  `limit 0`.

  Usage: node scripts/verify-columns.mjs
*/
import { readFileSync } from "node:fs";

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env();

/** table -> the exact column list some adapter selects, and who selects it. */
const QUERIES = [
  ["comped_access", "tier, source, ends_at", "billing/membership.ts · compedMembership"],
  ["comped_access", "user_id, tier, source, starts_at, ends_at", "0011 apply_referral_reward"],
  ["referrals", "id, code, referrer_id, referred_id, status, converted_at, hold_until, tier, joiner_credited_at", "0011 my_referrals, 0042 joiner credit"],
  ["referral_rewards", "id, user_id, referral_id, kind, months, status, earned_at, applied_at", "0011 my_referrals"],
  ["referral_codes", "user_id, code, created_at", "0011 my_referral_code"],
  ["referral_visits", "code, day, hits", "0011 record_referral_visit"],
  ["invites", "id, code, kind, issued_by, target_table, target_id, label, issuer_label, status, expires_at", "data/connections.ts"],
  ["coach_players", "id, display_name, position, share_scope, created_at", "data/connections.ts · listMyConnections"],
  ["trainer_athletes", "id, display_name, position, share_scope, created_at", "data/connections.ts · listMyConnections"],
  ["org_staff", "id, display_name, staff_role, created_at", "data/connections.ts · listMyConnections"],
  ["clip_analyses", "id, clip_id, video_id, provider, kind, model, from_seconds, to_seconds", "data/analyses.ts"],
  ["subscriptions", "plan_id, status, current_period_end, cancel_at_period_end", "billing/membership.ts"],
  ["usage_periods", "user_id, period_start, period_end, counters", "billing/membership.ts"],
  ["ai_usage_events", "user_id, feature, model, input_tokens, output_tokens, estimated_cost_usd, latency_ms, status, cached", "billing/meter.ts · logAiUsage"],
  // The two that were wrong once before. Worth keeping pinned.
  ["matches", "id, opponent, competition, played_at, home, goals_for, goals_against, position, started, minutes, rating, goals, assists", "data/performance.ts"],
  ["match_stats", "match_id, shots, shots_on_target, chances_created, key_passes, dribbles, duels_won, recoveries, tackles, interceptions, aerials_won", "data/performance.ts · per90"],
  ["daily_checkins", "checkin_date, energy, soreness, sleep, mental, note", "data/recovery.ts"],
  ["training_sessions", "id, scheduled_at, duration_min", "data/performance.ts · workload"],
  ["player_profiles", "date_of_birth, nationality, foot, primary_position, secondary_position, height_cm, weight_kg, club, league, squad_number, season, level, is_public", "data/profile.ts"],
  ["teams", "id, name, org_id, age_group, level, season, squad_size", "data/club.ts"],
];

let bad = 0;
for (const [table, columns, who] of QUERIES) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=0`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  if (res.ok) {
    console.log(`  ok       ${table} (${who})`);
  } else {
    bad++;
    const body = await res.text();
    // PostgREST names the offending column in the message.
    console.log(`  BAD      ${table} (${who})\n           ${body.slice(0, 180)}`);
  }
}

console.log(
  bad === 0
    ? `\nEvery column ${QUERIES.length} adapter queries ask for exists.`
    : `\n${bad} query/queries reference a column that does not exist.`,
);
process.exit(bad === 0 ? 0 : 1);
