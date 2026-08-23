#!/usr/bin/env node
/*
  Verify migrations 0015 and 0016 landed — and, more importantly, that the one
  setting protecting every user's record from every other user is actually on.

  `player_timeline` is a view over ten tables holding a player's entire football
  history. A Postgres view runs with its OWNER's privileges unless it is created
  `with (security_invoker = true)`, and the owner is `postgres`, which bypasses
  RLS. Get that wrong and any signed-in account reads everybody's timeline.

  The migration says it is set. That is not evidence. Three separate bugs in
  this codebase have had the same shape — an operation reporting success
  without anyone checking the result from the other side — so this checks from
  the other side:

    · the anon key must be refused outright (the grant)
    · a freshly created account, which owns nothing, must see ZERO rows
      (security_invoker — with it off, that account sees the whole database)
    · the view's contents must match the tables it reads

  The account probe writes. It creates one obviously-synthetic user, reads once,
  deletes it, and then RE-LISTS to confirm the deletion actually happened rather
  than trusting the delete's own response. Pass --no-probe to skip it, at the
  cost of not proving the thing most worth proving.

  Usage: node scripts/verify-timeline.mjs [--no-probe]
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
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and");
  console.error("SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.");
  process.exit(1);
}

const PROBE = !process.argv.includes("--no-probe");
const PROBE_EMAIL = "midoxi-rls-probe@example.invalid";

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, detail = "") {
  pass++;
  console.log(`  ok    ${label}${detail ? `  ${detail}` : ""}`);
}
function bad(label, detail = "") {
  fail++;
  failures.push(label);
  console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ""}`);
}

/*
  One PostgREST request.

  `apikey` and `authorization` are not the same thing and cannot be collapsed.
  The apikey identifies the PROJECT and must always be a project key; the bearer
  token identifies the CALLER. A user's access token is a valid bearer and an
  invalid apikey, so sending it as both is answered with "Invalid API key" —
  which reads exactly like a permissions failure and is not one.
*/
async function rest(path, { token = serviceKey, apikey, method = "GET", body, prefer } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: apikey ?? (token === serviceKey ? serviceKey : anonKey),
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(prefer ? { prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* PostgREST always speaks JSON; a parse failure is itself the answer. */
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** Row count without transferring the rows. */
async function count(path, token = serviceKey) {
  const res = await rest(`${path}${path.includes("?") ? "&" : "?"}select=*&limit=1`, {
    token,
    prefer: "count=exact",
  });
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return { status: res.status, total: Number.isFinite(total) ? total : null, json: res.json };
}

console.log(`\nproject: ${url}`);
console.log(`probe:   ${PROBE ? "on — one throwaway account will be created and deleted" : "SKIPPED (--no-probe)"}\n`);

// ── 1 · the view exists and has the shape the app selects ────────────────────
console.log("the view");
{
  const cols = "user_id,occurred_at,kind,ref_id,title,summary,meta";
  const res = await rest(`player_timeline?select=${cols}&limit=1`);
  if (res.status === 404 || res.json?.code === "PGRST205") {
    bad("player_timeline exists", "not found — migration 0015 did not run");
  } else if (res.status === 400) {
    bad("player_timeline has the expected columns", res.json?.message ?? res.text.slice(0, 120));
  } else if (res.status === 200) {
    ok("player_timeline exists, with every column the adapter selects");
  } else {
    bad("player_timeline is readable", `${res.status} ${res.text.slice(0, 120)}`);
  }
}

// ── 2 · it is a VIEW, not something writable ─────────────────────────────────
{
  // A timeline that can be written to is a timeline that can disagree with the
  // tables underneath it. Non-updatable is the guarantee, not the intent.
  const res = await rest("player_timeline", {
    method: "POST",
    body: { kind: "match", title: "probe" },
  });
  if (res.status >= 400) ok("nothing can be written into it", `insert refused (${res.status})`);
  else bad("nothing can be written into it", `insert returned ${res.status} — it is writable`);
}

// ── 3 · new columns ──────────────────────────────────────────────────────────
console.log("\ncolumns");
const COLUMNS = [
  ["development_evidence", "id,concept,at_seconds,source", "the loop records which concept and which moment"],
  ["videos", "id,ai_file_uri,ai_file_mime,ai_file_expires_at", "the uploaded-file handle is cached"],
  ["player_profiles", "user_id,pitch_identity", "a player can say how to spot themselves on film"],
];
for (const [table, select, why] of COLUMNS) {
  const res = await rest(`${table}?select=${select}&limit=0`);
  if (res.status === 200) ok(`${table} — ${why}`);
  else bad(`${table} — ${why}`, res.json?.message ?? `${res.status}`);
}

// ── 4 · the fourth kind of analysis ──────────────────────────────────────────
/*
  Postgres evaluates CHECK constraints while building the tuple and fires
  foreign-key triggers afterwards. So an insert with deliberately bogus uuids
  tells us which one rejected it, and nothing is ever written either way:

    23514  the CHECK refused the value
    23503  the CHECK accepted it and the FK refused the row

  'bogus' is the control. Without it, a 23503 for every value would look like a
  pass while proving nothing.
*/
console.log("\nclip_analyses.kind");
async function kindAccepted(kind) {
  const res = await rest("clip_analyses", {
    method: "POST",
    body: {
      user_id: "00000000-0000-0000-0000-000000000001",
      video_id: "00000000-0000-0000-0000-000000000002",
      kind,
    },
  });
  return { code: res.json?.code ?? String(res.status), message: res.json?.message ?? res.text.slice(0, 100) };
}
{
  const control = await kindAccepted("bogus-kind");
  const video = await kindAccepted("video");
  const frames = await kindAccepted("frames");

  if (control.code !== "23514") {
    bad("the probe can tell a rejected value from an accepted one", `control gave ${control.code}, expected 23514`);
  } else {
    ok("the probe discriminates", "an invalid kind is refused by the check");
    if (video.code === "23503") ok("'video' is an accepted kind", "migration 0016 widened the constraint");
    else bad("'video' is an accepted kind", `${video.code} ${video.message}`);
    if (frames.code === "23503") ok("'frames' still works", "no existing analysis was broken");
    else bad("'frames' still works", `${frames.code} ${frames.message}`);
  }
}

// ── 5 · the view agrees with the tables it reads ─────────────────────────────
console.log("\ncontents");
const SOURCES = [
  ["match", "matches"],
  ["training", "training_sessions"],
  ["checkin", "daily_checkins"],
  ["clip", "clips"],
  ["analysis", "clip_analyses"],
  ["study", "studies"],
  ["study_session", "study_sessions"],
  ["goal_set", "development_goals"],
  ["evidence", "development_evidence"],
  ["feedback", "coach_feedback"],
];
let viewTotal = 0;
for (const [kind, table] of SOURCES) {
  const [inView, inTable] = await Promise.all([
    count(`player_timeline?kind=eq.${kind}`),
    count(table),
  ]);
  viewTotal += inView.total ?? 0;
  if (inView.total === null || inTable.total === null) {
    bad(`${kind} ← ${table}`, "could not be counted");
  } else if (inView.total === inTable.total) {
    ok(`${kind} ← ${table}`, `${inView.total}`);
  } else {
    bad(`${kind} ← ${table}`, `view has ${inView.total}, table has ${inTable.total}`);
  }
}
{
  // goal_reached is a second row off development_goals, so it is not a 1:1.
  const [reached, achieved] = await Promise.all([
    count("player_timeline?kind=eq.goal_reached"),
    count("development_goals?status=eq.achieved"),
  ]);
  viewTotal += reached.total ?? 0;
  if (reached.total === achieved.total) ok("goal_reached ← achieved goals", `${reached.total}`);
  else bad("goal_reached ← achieved goals", `view ${reached.total}, table ${achieved.total}`);
}
{
  const all = await count("player_timeline");
  if (all.total === viewTotal) ok("every row belongs to a known kind", `${all.total} total`);
  else bad("every row belongs to a known kind", `${all.total} total, ${viewTotal} accounted for`);
}

// ── 6 · the anon key gets nothing ────────────────────────────────────────────
console.log("\naccess");
/*
  Two separate questions, and conflating them hides whichever one is broken.

  ISOLATION is the one that matters. The anon role is not authenticated and owns
  nothing, so under RLS it must see zero rows. If `security_invoker` were NOT
  set, the view would execute as its owner — `postgres`, which bypasses RLS —
  and anon would come back holding the entire database. So a 200 with zero rows,
  against a view the service role can see rows in, is direct proof that RLS is
  being applied through the view.

  THE GRANT is defence in depth. Supabase's default privileges hand `anon` a
  direct SELECT on anything new in the public schema, and `revoke ... from
  public` does not touch a direct grant to a named role — the same shape of
  mistake as migration 0011's revoke, which did nothing.
*/
{
  const [anonRows, serviceRows] = await Promise.all([
    rest("player_timeline?select=user_id&limit=5", { token: anonKey }),
    count("player_timeline"),
  ]);
  const rows = Array.isArray(anonRows.json) ? anonRows.json : [];
  const reachable = anonRows.status === 200;

  if (reachable && rows.length > 0) {
    bad("anon sees nothing", `IT RETURNED ${rows.length} ROWS — the timeline is public`);
  } else if (reachable && (serviceRows.total ?? 0) > 0) {
    ok(
      "anon sees nothing",
      `0 rows while ${serviceRows.total} exist — RLS applies through the view, so security_invoker is on`,
    );
    bad(
      "anon is not granted select at all",
      "it can query the view (0 rows, but the grant is wider than 0015 intended)",
    );
  } else if (reachable) {
    console.log("  skip  anon sees nothing — the timeline is empty, so 0 rows proves nothing");
    bad("anon is not granted select at all", "it can query the view");
  } else {
    ok("anon cannot reach the view at all", `${anonRows.status} ${anonRows.json?.code ?? ""}`);
  }
}

// ── 7 · security_invoker, proved rather than assumed ─────────────────────────
if (PROBE) {
  console.log("\nsecurity_invoker");
  if (viewTotal === 0) {
    console.log("  skip  the timeline is empty, so 'sees zero rows' would prove nothing");
    console.log("        log a match or a check-in, then re-run this.");
  } else {
    await probeIsolation(viewTotal);
  }
}

async function probeIsolation(total) {
  const password = `probe-${crypto.randomUUID()}`;
  let userId = null;

  const admin = async (path, init = {}) => {
    const res = await fetch(`${url}/auth/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };

  try {
    // Clean up anything a previous interrupted run left behind, first.
    const existing = await admin(`admin/users?per_page=200`);
    const stale = (existing.json?.users ?? []).find((u) => u.email === PROBE_EMAIL);
    if (stale) await admin(`admin/users/${stale.id}`, { method: "DELETE" });

    const created = await admin("admin/users", {
      method: "POST",
      body: JSON.stringify({ email: PROBE_EMAIL, password, email_confirm: true }),
    });
    userId = created.json?.id ?? null;
    if (!userId) {
      bad("a probe account could be created", created.json?.msg ?? `${created.status}`);
      return;
    }

    const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email: PROBE_EMAIL, password }),
    });
    const session = await signIn.json();
    const token = session.access_token;
    if (!token) {
      bad("the probe account could sign in", session.error_description ?? `${signIn.status}`);
      return;
    }

    const seen = await rest("player_timeline?select=user_id,kind&limit=5", { token });
    const rows = Array.isArray(seen.json) ? seen.json : [];

    if (seen.status !== 200) {
      bad("a signed-in account can query the timeline", `${seen.status} ${seen.json?.message ?? ""}`);
    } else if (rows.length === 0) {
      ok(
        "an account that owns nothing sees nothing",
        `RLS applies through the view — security_invoker is on (${total} rows exist)`,
      );
    } else {
      bad(
        "an account that owns nothing sees nothing",
        `IT SAW ${rows.length} ROWS BELONGING TO SOMEONE ELSE — security_invoker is NOT set`,
      );
    }
  } catch (e) {
    bad("the isolation probe ran", e instanceof Error ? e.message : String(e));
  } finally {
    if (userId) {
      await admin(`admin/users/${userId}`, { method: "DELETE" });
      // Do not trust the delete's own answer — three bugs in this codebase have
      // been exactly that. Ask the list.
      const after = await admin(`admin/users?per_page=200`);
      const still = (after.json?.users ?? []).find((u) => u.id === userId);
      if (still) {
        bad("the probe account was removed", `STILL PRESENT — delete ${userId} by hand`);
      } else {
        ok("the probe account was removed", "confirmed by re-listing, not by the delete's reply");
      }
    }
  }
}

// ── result ───────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Migrations 0015 and 0016 are in, and the view isolates.\n");
