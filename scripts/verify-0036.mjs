#!/usr/bin/env node
/*
  Verify migration 0036 — favorite club + watch studies — from outside.

  The migration's own "Success. No rows returned" is not evidence; this
  asks the database from the other side, the same discipline every
  earlier verification followed:

    1. `player_profiles.favorite_club` is selectable (column exists).
    2. `study_sessions.source_kind` ACCEPTS 'watch' — proven by writing
       a real row with the service role and deleting it again.
    3. The check constraint still REJECTS an unknown kind — proven by a
       write that must fail. A constraint that was dropped and never
       restated would pass test 2 and fail this one.
    4. anon cannot read either table directly (the standing grant rule).

  The probe writes one obviously-synthetic study_sessions row against a
  real user id (RLS default `auth.uid()` does not fire under the service
  role, so user_id is stated explicitly) and re-checks it is gone after
  deletion rather than trusting the delete's response.

  Usage: node scripts/verify-0036.mjs
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

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
} = env();
if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase keys in .env.local.");
  process.exit(1);
}

const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const anon = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

async function req(method, path, headers, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

// 1 — the column exists.
{
  const r = await req("GET", "player_profiles?select=favorite_club&limit=1", service);
  check("favorite_club column exists", r.status === 200, r.status === 200 ? "" : `${r.status} ${r.text.slice(0, 120)}`);
}

// A real user id for the probe rows (any profile will do).
const who = await req("GET", "profiles?select=id&limit=1", service);
const userId = who.json?.[0]?.id;
if (!userId) {
  check("a profile row exists to probe with", false, `${who.status}`);
} else {
  // 2 — 'watch' is accepted.
  const ins = await req("POST", "study_sessions", service, {
    user_id: userId,
    title: "VERIFY-0036 probe — delete me",
    source_kind: "watch",
  });
  const probeId = ins.json?.[0]?.id;
  check("source_kind 'watch' accepted", ins.status === 201 && Boolean(probeId), `${ins.status} ${probeId ? "" : ins.text.slice(0, 160)}`);

  // 3 — an unknown kind is still rejected (the constraint was restated, not lost).
  const bad = await req("POST", "study_sessions", service, {
    user_id: userId,
    title: "VERIFY-0036 bad probe — must be rejected",
    source_kind: "carrier_pigeon",
  });
  check(
    "unknown source_kind rejected by the check constraint",
    bad.status !== 201 && /check|constraint|source_kind/i.test(bad.text),
    `${bad.status}`,
  );
  // If the impossible happened and it landed, remove it.
  if (bad.status === 201 && bad.json?.[0]?.id) {
    await req("DELETE", `study_sessions?id=eq.${bad.json[0].id}`, service);
  }

  // Clean up the probe, then RE-CHECK it is gone.
  if (probeId) {
    await req("DELETE", `study_sessions?id=eq.${probeId}`, service);
    const still = await req("GET", `study_sessions?id=eq.${probeId}&select=id`, service);
    check("probe row deleted and confirmed gone", still.status === 200 && still.json?.length === 0);
  }
}

// 4 — anon has no direct read on either table.
{
  const p = await req("GET", "player_profiles?select=favorite_club&limit=1", anon);
  const s = await req("GET", "study_sessions?select=id&limit=1", anon);
  const blocked = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && r.json?.length === 0);
  check("anon cannot read player_profiles rows", blocked(p), `${p.status}`);
  check("anon cannot read study_sessions rows", blocked(s), `${s.status}`);
}

console.log(`\n${pass} ok, ${fail} failing`);
process.exit(fail ? 1 : 0);
