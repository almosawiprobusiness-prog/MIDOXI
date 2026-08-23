#!/usr/bin/env node
/*
  Verify the migrations are actually applied.

  Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local and
  asks PostgREST for one row from every table the app expects. A table that is
  missing answers 404 with PGRST205; anything else means it exists and is
  reachable. Read-only — this never writes.

  Usage: node scripts/verify-schema.mjs
*/
import { readFileSync } from "node:fs";

const TABLES = {
  "0001 core": [
    "profiles", "player_profiles", "coach_profiles", "matches", "match_stats",
    "development_goals", "training_sessions", "clips", "videos", "daily_checkins",
  ],
  "0005 roles + study": [
    "trainer_profiles", "club_profiles", "organizations", "org_memberships",
    "coach_players", "trainer_athletes", "studies", "study_modules", "study_takeaways",
  ],
  "0006 coach": [
    "session_plans", "session_blocks", "tactical_boards", "opposition_reports",
    "coach_player_notes",
  ],
  "0007 trainer": [
    "programs", "program_sessions", "program_exercises", "assessments", "athlete_notes",
  ],
  "0008 club": ["org_staff", "club_methodology"],
  "0009 connections": ["invites"],
  "0010 video analysis": ["clip_analyses"],
  "0011 referrals": [
    "referral_codes", "referral_visits", "referrals", "referral_rewards", "comped_access",
  ],
};

/*
  Functions matter as much as tables here: connections and referrals both put
  the rules in security-definer functions, so a migration that created the
  tables but not the functions would look fine above and fail in use.

  Each is called in a way that is safe to run against a live database — no
  arguments that match anything, and never the service-role-only ones.
*/
const FUNCTIONS = [
  ["preview_invite", { p_code: "ZZZZ-ZZZZ" }],
  ["record_referral_visit", { p_code: "ZZZZZZ" }],
  ["ripen_referral_rewards", {}],
];

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
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function check(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (res.ok) return { ok: true };
  const body = await res.text();
  return { ok: false, status: res.status, body: body.slice(0, 140) };
}

let missing = 0;
for (const [group, tables] of Object.entries(TABLES)) {
  console.log(`\n${group}`);
  for (const t of tables) {
    const r = await check(t);
    if (r.ok) {
      console.log(`  ok       ${t}`);
    } else {
      missing++;
      console.log(`  MISSING  ${t}  (${r.status}) ${r.body}`);
    }
  }
}

// The columns added to existing tables by 0005 and 0008.
const COLUMNS = [
  ["teams", "org_id"],
  ["teams", "age_group"],
  ["teams", "squad_size"],
];
console.log("\naltered columns");
for (const [table, column] of COLUMNS) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (res.ok) console.log(`  ok       ${table}.${column}`);
  else {
    missing++;
    console.log(`  MISSING  ${table}.${column}  (${res.status})`);
  }
}

console.log("\nfunctions");
for (const [fn, body] of FUNCTIONS) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // 404 means PostgREST cannot find the function; anything else means it ran.
  if (res.status === 404) {
    missing++;
    console.log(`  MISSING  ${fn}()  (${(await res.text()).slice(0, 100)})`);
  } else {
    console.log(`  ok       ${fn}()`);
  }
}

console.log(
  missing === 0
    ? "\nAll expected tables and columns are present."
    : `\n${missing} object(s) missing — the migration did not fully apply.`,
);
process.exit(missing === 0 ? 0 : 1);
