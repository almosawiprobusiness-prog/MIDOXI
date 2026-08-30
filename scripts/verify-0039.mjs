#!/usr/bin/env node
/*
  Verify migration 0039 — film analysis jobs — from outside.

    1. The table exists and is selectable with the service role.
    2. The state check constraint holds: a row with a state outside the
       five-value enum must be REJECTED.
    3. anon reads nothing — a job table readable by anon is a map of
       what everyone's film contains.

  Probes insert with the service role against a real user id + video
  id; anything that lands is deleted and re-checked gone.

  Usage: node scripts/verify-0039.mjs
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

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

async function rest(path, opts = {}, headers = service) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...headers, ...(opts.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

// 1. Table exists.
const list = await rest("film_analysis_jobs?select=id&limit=1");
check("table exists (service select)", list.status === 200, `status ${list.status}`);

// A video to satisfy the FK — any existing one, else a probe video
// created against a real profile and deleted afterwards.
const vids = await rest("videos?select=id,user_id&limit=1");
let vid = vids.body?.[0]?.id;
let uid = vids.body?.[0]?.user_id;
let probeVideo = false;
if (!vid) {
  const profs = await rest("profiles?select=id&limit=1");
  uid = profs.body?.[0]?.id;
  if (uid) {
    const made = await rest("videos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: uid,
        title: "verify-0039 probe",
        source: "youtube",
        external_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        status: "ready",
      }),
    });
    vid = made.body?.[0]?.id;
    probeVideo = Boolean(vid);
  }
}

if (!uid || !vid) {
  check("probe rows available", false, "need one user with one video to probe constraints");
} else {
  const base = {
    user_id: uid,
    video_id: vid,
    focus: "",
    windows: [{ from: 0, to: 60, status: "pending", attempts: 0 }],
    idempotency_key: `verify-0039-${Date.now()}`,
  };

  // 2a. A valid row lands.
  const good = await rest("film_analysis_jobs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(base),
  });
  const goodId = good.body?.[0]?.id;
  check("valid job row accepted", good.status === 201 && Boolean(goodId), `status ${good.status}`);

  // 2b. A state outside the enum is rejected.
  const bad = await rest("film_analysis_jobs", {
    method: "POST",
    body: JSON.stringify({ ...base, idempotency_key: `${base.idempotency_key}-bad`, state: "exploded" }),
  });
  check("invalid state rejected (23514)", bad.status === 400, `status ${bad.status}`);

  // 2c. Duplicate idempotency key collapses.
  const dup = await rest("film_analysis_jobs", {
    method: "POST",
    body: JSON.stringify(base),
  });
  check("duplicate plan rejected (unique key)", dup.status === 409, `status ${dup.status}`);

  // Clean up, then confirm gone.
  if (goodId) {
    await rest(`film_analysis_jobs?id=eq.${goodId}`, { method: "DELETE" });
    const gone = await rest(`film_analysis_jobs?select=id&id=eq.${goodId}`);
    check("probe row deleted", gone.status === 200 && gone.body?.length === 0);
  }
  if (probeVideo && vid) {
    await rest(`videos?id=eq.${vid}`, { method: "DELETE" });
    const gone = await rest(`videos?select=id&id=eq.${vid}`);
    check("probe video deleted", gone.status === 200 && gone.body?.length === 0);
  }
}

// 3. anon reads nothing.
const anonRead = await rest("film_analysis_jobs?select=id&limit=1", {}, anon);
check(
  "anon has no surface",
  anonRead.status === 401 || anonRead.status === 403 || anonRead.status === 404 ||
    (anonRead.status === 200 && anonRead.body?.length === 0),
  `status ${anonRead.status}`,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
